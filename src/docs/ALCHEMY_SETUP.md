# Alchemy webhook + slim tick setup

## What changed

| Piece | Before | After |
|-------|--------|-------|
| Detect Transfer on Sepolia | `/api/tick` polls `queryFilter` + checkpoint | Alchemy Custom Webhook → `/api/alchemy/remittance` |
| Submit proof | `sendRemittanceProofTx` + `inFlightTxStore` | Same (called from webhook) |
| Confirm proof & queue review | Tick section 1 | Same (slim tick) |
| Fire `requestCreditReview` | Tick section 3 | Same (slim tick) — **after** proof confirms |

## Files to drop into your repo

```
app/api/alchemy/remittance/route.ts   ← new
app/api/tick/route.ts                 ← replace existing (scan removed)
server/alchemyWebhook.ts              ← new helper
```

Adjust relative imports if your `shared/` or `server/` paths differ.

## 1. Alchemy dashboard

1. Webhooks → **Create Webhook** → **Custom**
2. Chain: **Ethereum** / Network: **Sepolia**
3. Webhook URL: `https://<your-domain>/api/alchemy/remittance`
4. GraphQL filter (set your real token address):

```graphql
{
  block {
    logs(
      filter: {
        addresses: ["0xYOUR_SOURCE_REMITTANCE_TOKEN_ADDRESS_TESTNET"]
        topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
      }
    ) {
      data
      topics
      index
      account { address }
      transaction {
        hash
        index
        from { address }
        to { address }
      }
    }
  }
}
```

5. Copy the **Signing Key** from the webhook detail page.

## 2. Vercel env

```bash
ALCHEMY_WEBHOOK_SIGNING_KEY=<signing key from Alchemy>
# all existing vars stay the same, including:
WORKER_PRIVATE_KEY=
WORKER_TICK_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NETWORK_ENV=testnet
SEPOLIA_RPC_URL=
SOURCE_REMITTANCE_TOKEN_ADDRESS_TESTNET=
# + Creditcoin RPC, contract addresses, etc.
```

## 3. Cron for the slim tick

`vercel.json` (or Project → Settings → Cron Jobs):

```json
{
  "crons": [
    {
      "path": "/api/tick?worker_tick_secret=YOUR_WORKER_TICK_SECRET",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

Use the same value as `WORKER_TICK_SECRET`. Every 1–2 minutes is enough; the webhook handles detection latency.

## 4. End-to-end flow

1. Declared sender transfers the remittance ERC-20 to the borrower on Sepolia.
2. Alchemy posts to `/api/alchemy/remittance`.
3. Route verifies signature → builds sender→borrower map → `sendRemittanceProofTx` → `inFlightTxStore.add("proof", …)`.
4. Cron hits `/api/tick`:
   - sees proof receipt `status === 1` → `pendingReviewStore.add(borrower)`
   - sends `requestCreditReview(borrower)` → tracks in `inFlightTxStore("review")`
5. Next tick confirms the review tx.

Credit is reviewed **only after** the proof is confirmed on Creditcoin.

## 5. Testing

- Alchemy dashboard → your webhook → **Test Webhook** (should return `{ ok: true, processed: 0 }` for empty payloads).
- Send a real Sepolia transfer from a declared sender to a registered borrower.
- Check Vercel logs for `[alchemy/remittance] proof sent …`.
- Wait for cron; logs should show proof confirmed → review sent.

## 6. Fallback

`/api/remittances/verify` still works for manual proof submission if a webhook is ever missed.

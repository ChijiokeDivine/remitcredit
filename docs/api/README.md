# RemitCredit Public API (v1)

Base: `/api/v1` · OpenAPI: `GET /api/v1/openapi` · Docs UI: `/docs/api`

## Auth (SIWE only)

```bash
# 1. Challenge
curl -s -X POST "$BASE/api/v1/auth/challenge" -H "Content-Type: application/json" \
  -d '{"address":"0xYourWallet"}'

# 2. Sign message with wallet (personal_sign) — never send private key

# 3. Verify
curl -s -X POST "$BASE/api/v1/auth/verify" -H "Content-Type: application/json" \
  -d '{"message":"<siwe>","signature":"0x..."}'

# 4. Use token
curl -s "$BASE/api/v1/wallets/me" -H "Authorization: Bearer <token>"
```

Nonces/sessions/idempotency live in Redis. Business state is on-chain.

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | /auth/challenge | no |
| POST | /auth/verify | no |
| GET/DELETE | /auth/session | yes |
| GET | /wallets/me | yes |
| GET/POST | /senders | yes |
| GET/DELETE | /senders/:address | yes |
| GET | /credit/limit, /available, /risk-score, /rationale, /profile | yes |
| POST | /credit/review | yes |
| GET/POST | /loans | yes |
| POST | /loans/repay | yes |
| GET | /transfers, /transfers/stats | yes |
| POST | /transfers/verify | yes |
| GET | /activity | yes |
| GET | /protocol, /openapi | no |

Idempotency-Key header supported on writes. Amounts are raw integer decimal strings.

## Redis keys (new)

- `api:v1:nonce:<addr>:<nonce>` TTL 10m
- `api:v1:session:<token>` TTL 24h
- `api:v1:idem:<addr>:<key>` TTL 24h

## Env

Existing app env + optional `API_SIWE_DOMAIN`, `API_SIWE_URI`.

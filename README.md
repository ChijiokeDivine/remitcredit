# RemitCredit — Remittance-Backed Micro-Loan Underwriting on Creditcoin

```
README.md
```

Built for **BUIDL CTC 2026 Fall** (AI track).

## The problem

People who receive regular crypto remittances from family abroad often have
no formal credit file, so no lender will extend them a working-capital loan
— even though a stable, recurring inbound payment is a strong underwriting
signal. Today that signal is either self-reported (screenshots, easily
faked) or attested to by a single centralized API (a single point of
failure that can lie, get hacked, or get shut down).

## The fix

RemitCredit verifies a borrower's remittance history **cryptographically**,
using the Attestcoin Protocol's native block-proving precompile on
Creditcoin, and hands the verified (not self-reported) history to a
transparent, rules-based decision agent that sets and adjusts the
borrower's credit line autonomously — no human underwriter, no trusted
oracle.

```
Source chain (Ethereum)        Creditcoin (Attestcoin Protocol)
─────────────────────          ─────────────────────────────────
family sends USDC/ETH   ──▶    Oracle Worker builds Merkle +
to borrower's wallet            continuity proof (usc-sdk)
                                        │
                                        ▼
                         RemittanceMicroLoan.submitRemittanceProof()
                                        │
                         calls the Attestcoin block-prover precompile
                         synchronously, in the same transaction
                                        │
                          ✅ verified → recorded in
                             RemittanceCreditRegistry
                                        │
                                        ▼
                          CreditDecisionEngine (the "agent")
                          reads the verified, on-chain history
                          and computes a credit limit + risk score
                                        │
                                        ▼
                             Borrower draws / repays a loan
```

This is the **Deploy → Prove → Verify → Execute** pattern the Attestcoin
docs describe, applied to one narrow, previously-painful workflow:
proving someone's income without trusting anyone to tell the truth about it.

A borrower isn't limited to a single remittance source — `registerBorrower`
takes a list of approved sender wallets (e.g. one parent and one sibling),
and `addDeclaredSender` / `removeDeclaredSender` let that list change over
time without re-registering. Every verified transfer still has to come
from a currently-approved address, so this doesn't loosen the trust
anchor — it just recognizes that real remittance income often comes from
more than one person.

## Why the "AI" here is a rules engine, not a model

The AI track's emphasis is on **autonomously informing decisions from
verified cross-chain data**, not on model sophistication. `CreditDecisionEngine`
is a deterministic, auditable scoring function — every input (transfer
count, total verified inflow, interval consistency, recency) and every
output (credit limit, risk score, eligibility, and a plain-language
rationale) is inspectable on-chain and off-chain. That's a deliberate
choice: an opaque model scoring an undocumented feature set would be
*harder* to trust, not easier, for a lending decision. The "agent" framing
is accurate — it ingests verified data and autonomously acts (adjusts a
credit line on-chain) without a human in the loop — the internals are just
transparent by design.

## Repo layout

```
contracts/        Solidity — the on-chain half (Creditcoin)
  interfaces/      IAttestcoinBlockProver, IRemittanceCreditRegistry
  mocks/           Local test doubles (MockAttestcoinBlockProver, MockStablecoin)
  RemittanceCreditRegistry.sol   Stores verified transfers, computes rolling stats
  CreditDecisionEngine.sol       Deterministic credit-decision "agent"
  RemittanceMicroLoan.sol        Main ASC: proof submission, loan lifecycle

shared/            TypeScript used by both worker and backend
  config.ts                Network / chain config (env-driven)
  types.ts                 Shared types
  contractAddresses.ts      Deployed-address registry, env-driven
  services/proofService.ts        Wraps @gluwa/usc-sdk proof generation
  services/chainInfoService.ts    Wraps chain/chainKey lookups
  services/contractClient.ts      Typed ethers.js contract bindings
  services/creditAgent.ts         Off-chain mirror of the on-chain decision engine

worker/            Off-chain "oracle worker" — the piece the Attestcoin
                   architecture calls out explicitly
  src/monitor.ts            Watches the source chain for new remittances
  src/submitProof.ts         Full prove → verify pipeline for one tx
  src/runAgentLoop.ts         Periodically re-runs credit decisions
  src/index.ts                Orchestrator / CLI entrypoint

backend/           REST API — pluggable into a future frontend
  src/server.ts
  src/env.ts
  src/store.ts                In-memory/indexer-lite cache (swap for real DB later)
  src/routes/{borrowers,remittances,loans,credit}.ts
  src/middleware/errorHandler.ts

scripts/           Hardhat deploy scripts (testnet + mainnet)
test/              Hardhat/mocha contract tests
```

## Setup

```bash
npm install
cp .env.example .env      # fill in RPC URLs, keys, addresses
npx hardhat compile
npx hardhat test
```

### Deploy to Creditcoin testnet (CC3 Testnet)

```bash
npx hardhat run scripts/deploy.ts --network cc3Testnet
```

### Deploy to Creditcoin mainnet

```bash
npx hardhat run scripts/deploy.ts --network cc3Mainnet
```

The same contracts and scripts target both — only the `--network` flag and
`.env` values (RPC URL, deployer key) change. See `hardhat.config.ts`.

### Run the off-chain worker

```bash
npm run worker
```

By default the worker's monitor detects new remittances via HTTP polling
against `rpcUrl`. Set `SEPOLIA_WSS_RPC_URL` (or `ETHEREUM_MAINNET_WSS_RPC_URL`)
to a `wss://` endpoint — most RPC providers (Infura, Alchemy, QuickNode)
offer one alongside the `https://` URL — and the monitor instead subscribes
over a persistent WebSocket, detecting a transfer the moment it's mined
rather than on the next poll tick. The connection auto-reconnects with
backoff if it drops (`shared/services/wsProvider.ts`); no other config
changes needed either way.

### Run the backend API

```bash
npm run backend
```

## A note on the precompile ABI

`IAttestcoinBlockProver` encodes the verifier call using the field names
Creditcoin documents publicly (`chainKey`, `blockHeight`/`headerNumber`,
`encodedTx`/`txBytes`, `merkleProof`, `continuityProof`) with the proof
structs passed as opaque ABI-encoded `bytes`. Before a mainnet deploy,
confirm the exact selector and struct layout against the live precompile
at `0x0FD2` (Creditcoin's "Native Proof Verifier Precompile") in the
`dApp Builder Infrastructure` docs / `gluwa/creditcoin-usc-networks`
repo, and adjust the interface if the real ABI differs. Everything else
in this repo (registry, decision engine, loan lifecycle, worker, API) is
independent of that detail and doesn't need to change.

## Submission checklist mapping

- **Working Attestcoin Protocol integration code** — `RemittanceMicroLoan.submitRemittanceProof`
  calls the precompile synchronously on-chain; `shared/services/proofService.ts`
  + `worker/src/submitProof.ts` drive real proof generation via `@gluwa/usc-sdk`.
- **Depth of utilization** — batch proof support (`verifyBatch`), chain-key
  resolution, attestation waiting, and a registry that turns verified
  transfers into a reusable on-chain credit history, not a one-off demo call.
- **Technical documentation** — this file, plus inline comments in every
  contract and service describing what it does and why.
# RemitCredit

### Turn verified remittance history into access to credit.

RemitCredit is an onchain micro-lending infrastructure that uses **verified remittance activity as a credit signal**.

Instead of asking borrowers to build a credit history from traditional financial products they may never have had access to, RemitCredit looks at something they already do: **send money home consistently**.

A borrower's recurring remittance behavior is observed, verified, and converted into an onchain attestation that can be used to evaluate creditworthiness. Approved borrowers can then access loans from a funded liquidity pool, with repayment and loan activity continuously monitored onchain.

Built for the **Creditcoin hackathon**.

---

## Demo

> **Demo video**

<!-- Replace with your demo video embed/link -->

<!-- https://www.youtube.com/watch?v=YOUR_VIDEO_ID -->

**[▶ Watch the RemitCredit demo](YOUR_VIDEO_LINK)**

<br />

> **Product walkthrough**

<!-- Replace with your demo screenshot -->

<!-- ![RemitCredit demo](./docs/images/demo.png) -->

`[ DEMO SCREENSHOT / PRODUCT IMAGE ]`

---

## Why RemitCredit?

Millions of people send money across borders regularly, yet consistent remittance behavior is rarely treated as a meaningful financial signal.

Someone may have:

* no traditional credit score
* limited access to formal banking
* no collateral
* no previous loan history

but still send money home every month.

That recurring behavior tells a story.

A person who consistently sends $200, $300, or $500 home every month has demonstrated a pattern of financial activity. RemitCredit turns that pattern into **verifiable credit data**.

The key idea is simple:

> **Don't start creditworthiness from zero when someone's financial behavior already exists onchain.**

RemitCredit creates the infrastructure to turn verified remittance history into a usable lending signal.

---

## How it works

RemitCredit connects four pieces:

```text
Remittance Activity
        │
        ▼
Payment Verification
        │
        ▼
Onchain Attestation
        │
        ▼
Credit Assessment
        │
        ▼
Loan from Liquidity Pool
        │
        ▼
Repayment Monitoring
        │
        └──────────────► Updated credit history
```

### 1. A borrower sends money

A borrower makes recurring remittance payments.

The system does not rely solely on what the borrower claims they have sent. RemitCredit looks for the underlying payment activity and its associated transaction data.

### 2. Remittance is automatically verified

This is one of the core pieces of RemitCredit.

A webhook listens for the relevant payment event and passes the transaction into the verification pipeline.

The system can verify signals such as:

* sender
* recipient
* payment amount
* transaction status
* transaction hash
* payment frequency
* historical payment activity

This means a borrower does not simply submit a spreadsheet or manually declare that they have been sending money.

**The payment itself becomes the evidence.**

Once the payment has been verified, it can be incorporated into the borrower's financial history.

### 3. RemitCredit creates an attestation

Verified remittance activity is transformed into an **attestation** representing the relevant financial signal.

Rather than treating every transaction as an isolated event, the system can use the accumulated history to establish a picture of the borrower's behavior.

For example:

```text
Verified remittance history

12 payments
$4,800 total sent
10 consecutive months
$400 average payment
100% verified onchain
```

That history becomes a much more useful lending signal than an unverified claim.

### 4. Creditworthiness is evaluated

The verified history feeds into the credit assessment.

RemitCredit can consider factors such as:

* consistency
* payment frequency
* total remitted
* average payment size
* length of observed history
* verified transaction history

The result is a credit signal that can be used to determine whether a borrower qualifies for a loan and how much they can access.

### 5. The liquidity pool funds the loan

Capital is supplied to a lending pool.

When a borrower qualifies, RemitCredit can allocate liquidity from that pool to fund the loan.

This separates the system into two important sides:

**Capital providers**

Provide liquidity to the lending pool.

**Borrowers**

Use verified financial history to qualify for credit.

The pool becomes the source of liquidity while the verified remittance history provides the signal used to make lending decisions.

### 6. Repayment is monitored

Loans are not simply issued and forgotten.

Repayment activity is tracked and monitored, with transaction activity providing an observable record of whether the borrower is meeting their obligations.

This creates a feedback loop:

```text
Verified remittance
       ↓
Credit assessment
       ↓
Loan
       ↓
Repayment
       ↓
New financial history
       ↓
Future credit decisions
```

The goal is to create a path where **financial behavior can progressively become financial reputation**.

---

## The verification layer

Traditional lending often depends on documents, declarations, and centralized credit histories.

RemitCredit takes a different approach.

### Evidence first

The system is designed around verifiable payment activity.

A payment event enters through the webhook layer, is processed by the backend, and can then be represented through an attestation that other parts of the lending system can rely on.

This creates a much stronger relationship between:

**what happened**

and

**what the credit system believes happened.**

The attestation acts as a bridge between raw transaction activity and the credit layer.

It gives the lending system a structured representation of verified financial behavior rather than forcing every downstream component to independently reconstruct a borrower's history.

---

## Webhooks: turning payments into financial data

The webhook layer is responsible for listening for payment events and triggering the verification flow.

At a high level:

```text
Payment Provider
      │
      │ webhook
      ▼
RemitCredit API
      │
      ├── Verify event
      ├── Validate transaction
      ├── Record payment
      ├── Update remittance history
      └── Create/update attestation
              │
              ▼
        Credit assessment
```

The important distinction is that the webhook is not merely a notification mechanism.

It is part of the **financial data pipeline**.

A successful payment can automatically become a verified financial event without requiring the borrower to manually report it.

---

## A programmable lending layer

RemitCredit is not only a consumer application.

The verification and lending primitives are designed to become infrastructure that other financial products can integrate with.

Businesses can plug into the API to build experiences around:

* borrower onboarding
* remittance verification
* credit assessment
* loan requests
* loan status
* repayment
* repayment history
* credit rationale
* verified financial history

This means a remittance company, fintech, wallet, lender, or financial application does not need to recreate the entire verification and credit infrastructure themselves.

They can build on top of RemitCredit.

### API integration

A business could eventually build a flow such as:

```text
Customer
   │
   ▼
Business application
   │
   │ RemitCredit API
   ▼
Verified remittance history
   │
   ▼
Credit assessment
   │
   ▼
Loan request
   │
   ▼
Funding pool
   │
   ▼
Loan issued
```

The API is intended to expose the core primitives required to integrate RemitCredit's lending infrastructure into an existing product.

> [!NOTE]
> The developer API is being prepared as an integration layer for businesses. KYB and KYC integrations are planned post-hackathon and will replace the current hackathon-stage onboarding assumptions with production compliance providers.

---

## Funding the pool

The lending pool is the liquidity layer behind RemitCredit.

Capital can be deposited into the pool and made available for qualified borrowers.

The basic lifecycle is:

```text
Liquidity provider
        │
        ▼
   Lending pool
        │
        ▼
Eligible borrower
        │
        ▼
      Loan
        │
        ▼
    Repayment
        │
        ▼
   Pool liquidity
```

The pool gives RemitCredit a clean separation between **where liquidity comes from** and **how borrowers qualify for access to it**.

The credit layer determines who can borrow based on verified financial behavior.

The pool provides the capital required to actually originate the loan.

---

## Onchain monitoring

RemitCredit uses **Ethereum Sepolia** as part of the monitoring and demonstration environment.

This gives the system an observable blockchain layer where loan-related activity can be inspected and verified independently from the application's database.

The architecture combines:

* application-level financial records
* verified payment events
* attestations
* smart-contract state
* blockchain transaction history

This matters because a lending system should not have to rely entirely on an application's internal database to establish what happened.

Onchain activity provides an additional verification layer.

---

## Why this matters

The interesting part of RemitCredit is not simply that it puts loans onchain.

It is the connection between **real financial behavior and programmable credit**.

A borrower may not have a traditional credit score.

But they may have:

```text
10 months of remittances
120+ verified transactions
Consistent payment amounts
A history of meeting financial obligations
```

RemitCredit makes that history usable.

That opens a path toward lending models where **financial behavior can matter even when traditional credit infrastructure does not exist**.

And because the underlying events can be verified, the credit signal does not have to depend entirely on self-reported information.

---

## Core features

| Feature                        | Description                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| **Remittance verification**    | Automatically verify payment activity instead of relying on self-reported history.       |
| **Attestations**               | Turn verified financial activity into structured, reusable credit signals.               |
| **Credit assessment**          | Evaluate borrowers using their verified remittance behavior.                             |
| **Liquidity pool**             | Provide capital that can be allocated to qualified borrowers.                            |
| **Loan origination**           | Request and issue loans against available pool liquidity.                                |
| **Repayment tracking**         | Monitor repayment activity and loan state.                                               |
| **Onchain monitoring**         | Track relevant activity through blockchain transactions and contract state.              |
| **Webhook infrastructure**     | React to payment events automatically as they occur.                                     |
| **Business API**               | Give external applications a programmable interface to RemitCredit's core primitives.    |
| **Credit rationale**           | Surface why a borrower qualifies and which verified signals contributed to the decision. |
| **KYC/KYB-ready architecture** | Designed to integrate production identity and business verification after the hackathon. |

---

## Architecture

At a high level, RemitCredit consists of four layers:

```text
┌──────────────────────────────────────────────┐
│                  Applications                │
│       Borrower UI · Business Integrations    │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│                     API                      │
│    Loans · Repayment · Credit · History      │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│          Verification & Credit Layer         │
│  Webhooks · Remittance Verification          │
│  Attestations · Credit Assessment            │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│              Onchain Infrastructure          │
│     Lending Pool · Loan State · Monitoring   │
│              Ethereum Sepolia                │
└──────────────────────────────────────────────┘
```

The application layer provides the experience.

The API provides programmability.

The verification layer establishes trustworthy financial history.

The blockchain layer provides transparent, independently verifiable state.

---

## Example lending flow

Consider a borrower who regularly sends money home.

```text
1. Borrower makes remittance
            ↓
2. Payment webhook received
            ↓
3. Transaction automatically verified
            ↓
4. Verified payment added to history
            ↓
5. Attestation updated
            ↓
6. Credit profile evaluated
            ↓
7. Borrower requests a loan
            ↓
8. Pool liquidity is checked
            ↓
9. Loan is originated
            ↓
10. Repayment is monitored
            ↓
11. Repayment becomes part of future financial history
```

The important part is that the process does not begin with a loan application.

**It begins with financial behavior.**

---

## Business API

RemitCredit is being built with an API-first direction so businesses can integrate the underlying lending infrastructure without rebuilding the verification and credit pipeline.

The API is intended to support operations around:

### Credit

* Retrieve verified financial history
* Request a credit assessment
* Retrieve credit rationale
* Retrieve available borrowing capacity

### Loans

* Request a loan
* Retrieve loan details
* Retrieve loan status
* Retrieve outstanding balance
* Repay a loan
* Retrieve repayment history

### Verification

* Submit or reference payment activity
* Retrieve verification status
* Retrieve attestation information
* Retrieve verified remittance history

### Monitoring

* Retrieve transaction history
* Monitor loan state
* Monitor repayment events
* Subscribe to relevant webhook events

The API is deliberately designed so that a business can use RemitCredit as a **credit infrastructure layer**, rather than needing to understand every underlying smart-contract interaction.

---

## KYC & KYB

The current implementation is optimized for the hackathon demonstration.

Production-grade identity and business verification are planned as the next layer:

* **KYC** for borrower identity verification
* **KYB** for businesses integrating with RemitCredit
* sanctions and compliance checks
* production identity-provider integrations
* stronger risk controls around loan origination

These are intentionally separated from the core verification and lending architecture so the underlying financial primitives can evolve independently of the identity provider.

---

## Technology

The project combines a web application, API infrastructure, blockchain contracts, and event-driven verification.

Key technologies include:

* **Next.js / TypeScript** — application and API layer
* **PostgreSQL** — application and financial data
* **Prisma** — database access
* **Smart contracts** — lending and onchain state
* **Ethereum Sepolia** — blockchain monitoring and testing
* **Creditcoin** — hackathon target ecosystem
* **Webhooks** — payment event ingestion
* **Attestations** — verified financial history
* **Redis / background processing** — asynchronous jobs where required

---

## Getting started

### Prerequisites

* Node.js 20+
* pnpm
* PostgreSQL
* Redis, if running the background workers
* An Ethereum Sepolia RPC endpoint
* Creditcoin testnet access where required
* Required API credentials and webhook configuration

### Install

```bash
pnpm install
```

### Configure environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Configure the required database, blockchain, webhook, and application secrets.

At minimum, the project requires the appropriate RPC configuration for the environments being used:

```env
SEPOLIA_RPC_URL=
CC3_TESTNET_RPC_URL=
CC3_TESTNET_CHAIN_ID=
```

Do not commit secrets or private keys to the repository.

### Run locally

```bash
pnpm dev
```

Then open:

```text
http://localhost:3000
```

---

## Smart contracts

The contract layer handles the onchain components of the lending system.

The deployed contracts are currently used in a testnet environment for the hackathon.

### Networks

| Network                    | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| **Ethereum Sepolia**       | Onchain monitoring and test integrations |
| **Creditcoin CC3 Testnet** | Creditcoin hackathon deployment          |

> [!WARNING]
> This project is a hackathon-stage implementation. Testnet deployments and loan logic should not be treated as production financial infrastructure or used with real funds.

---

## Project structure

The repository is organized around the application, API, verification, and onchain layers.

```text
app/
├── api/                 # API routes and webhook endpoints
├── ...                  # Application pages and UI

lib/
├── ...                  # Business logic and integrations
├── onchain/             # Blockchain interaction layer
├── ...                  # Verification / credit services

contracts/
├── ...                  # Solidity contracts

scripts/
├── ...                  # Deployment and utility scripts

prisma/
├── schema.prisma        # Database schema
└── migrations/          # Database migrations

public/
└── ...                  # Product assets
```

---

## What makes RemitCredit different?

Most lending systems start with the question:

> **"What credit history does this person have?"**

RemitCredit starts somewhere else:

> **"What financial behavior can we actually verify?"**

That distinction matters.

A person can have little or no traditional credit history while still having months or years of consistent financial activity.

RemitCredit creates a bridge between that activity and programmable credit:

**payment → verification → attestation → credit → liquidity → repayment**

The long-term vision is a financial system where people can build credit from the economic behavior they already demonstrate, rather than being permanently excluded because traditional credit infrastructure has never recorded them.

---

## Roadmap

### Hackathon

* [x] Remittance verification pipeline
* [x] Payment event handling
* [x] Attestation-based credit signals
* [x] Credit assessment
* [x] Lending pool
* [x] Loan origination
* [x] Repayment flow
* [x] Onchain monitoring
* [x] Ethereum Sepolia integration
* [x] Creditcoin testnet deployment
* [x] Initial business API layer

### Post-hackathon

* [ ] Production KYC integration
* [ ] Production KYB integration
* [ ] Expanded business API
* [ ] More robust risk models
* [ ] Additional payment/remittance providers
* [ ] Production-grade compliance controls
* [ ] Mainnet deployment
* [ ] Expanded liquidity-provider tooling

---

## Demo

### Video

<!-- Add final demo video here -->

`[ INSERT DEMO VIDEO HERE ]`

### Screenshots

<!-- Add screenshots here -->

`[ INSERT DEMO SCREENSHOT 1 HERE ]`

`[ INSERT DEMO SCREENSHOT 2 HERE ]`

`[ INSERT ARCHITECTURE / ATTESTATION SCREENSHOT HERE ]`

---

## Built for the Creditcoin Hackathon

RemitCredit explores what happens when **verified financial behavior becomes a portable credit primitive**.

Instead of treating remittance as a simple money-transfer event, RemitCredit treats it as a source of financial reputation.

That creates a foundation where recurring payments can do more than move money.

They can help someone **prove they are creditworthy**.

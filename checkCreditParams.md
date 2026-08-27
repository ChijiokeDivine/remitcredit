| Field | Value | Meaning |
|---|---|---|
| `minTransferCount` | `3` | Need **3 verified remittances** minimum. You have 2 — one more required. |
| `minTotalAmount` | `300000000` | Need **≥300,000,000** in the stablecoin's smallest unit — at $1 decimals implied by your `$250` display (250,000,000 → $250), that's **$300 total**. You're at $250 → need at least **$50 more**, combined across whatever transfers count. |
| `minConsistencyBps` | `5000` (50.00%) | Minimum interval-consistency score required. You're at **100%** — well clear of this, not a blocker. |
| `creditMultiplierBps` | `3000` (30%) | Not a gate — this is how your credit limit gets *computed* once you pass the gates above: roughly `creditLimit = totalVerifiedAmount × 30%`. |
| `maxCreditLimit` | `1000000000` ($1,000) | Hard ceiling on credit limit regardless of what the multiplier computes. |
| `lookbackWindowSeconds` | `15552000` = **180 days** | Only remittances from the last 180 days count toward `transferCount`/`totalAmount` above. |
| `maxStalenessSeconds` | `5184000` = **60 days** | A credit *decision* itself expires after 60 days — even once eligible, you'll need a fresh `requestCreditReview` call if more than 60 days pass without one. |

**What this means for your demo:** you need one more verified remittance, and it needs to be **at least $50** (to push total ≥$300), from your declared sender, landing within the 180-day window your existing two are already in (trivially true for a live demo). Both `minTransferCount` and `minTotalAmount` have to be satisfied together — hitting 3 transfers with a total still under $300 wouldn't be enough either.

Once that third transfer is verified, call `requestCreditReview` for the borrower — eligibility isn't automatic on verification, per the earlier `CreditReviewed` event/`requestCreditReview` function in the ABI, it has to be explicitly triggered (or your app already does this somewhere in the flow — worth checking `route.ts` under `/api/credit/[borrower]/review` if you haven't wired that call in yet).
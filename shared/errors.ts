// shared/errors.ts
//
// Structured errors for failure modes that are expected/recoverable, not
// bugs — so the API layer can map them to sensible HTTP statuses and
// actionable messages instead of a generic 500 + raw Error.message.

export class SenderNotApprovedError extends Error {
  constructor(
    public readonly borrower: string,
    public readonly sender: string,
    public readonly declaredSenders: string[]
  ) {
    super(
      `Sender ${sender} is not among ${borrower}'s declared remittance senders. ` +
        `Add it as a declared sender before this transfer can be verified.`
    );
    this.name = "SenderNotApprovedError";
  }
}

/**
 * Thrown when we give up waiting for a source-chain block to be attested
 * on Creditcoin within our own time budget (see ProofService.buildProofForTransaction).
 * `retryAfterSeconds` is an estimate derived from the attestation rate we
 * actually observed while polling — not a fixed guess — so it degrades
 * gracefully to a generic fallback if we never saw the height move.
 */
export class AttestationPendingError extends Error {
  constructor(
    public readonly chainKey: number,
    public readonly targetHeight: number,
    public readonly latestAttestedHeight: number,
    public readonly retryAfterSeconds: number
  ) {
    const mins = Math.ceil(retryAfterSeconds / 60);
    super(
      `Block ${targetHeight} on chain key ${chainKey} is not yet attested on Creditcoin ` +
        `(latest attested: ${latestAttestedHeight}). This usually finishes within ` +
        `~${mins} minute${mins === 1 ? "" : "s"} — please try again then.`
    );
    this.name = "AttestationPendingError";
  }
}
// backend/src/services/contracts.ts
import { RemitCreditClient } from "../../../shared/services/contractClient";
import { ProofService } from "../../../shared/services/proofService";
import { getConfig } from "../env";

let readClient: RemitCreditClient | undefined;
let relayerClient: RemitCreditClient | undefined;
let proofService: ProofService | undefined;

/// Read-only client — safe to use for every GET endpoint, never signs
/// anything.
export function getReadClient(): RemitCreditClient {
  if (!readClient) readClient = new RemitCreditClient(getConfig());
  return readClient;
}

/// Relayer-signed client, only available if BACKEND_RELAYER_PRIVATE_KEY is
/// set. Use this for a custodial demo flow where the API submits
/// transactions on a borrower's behalf. A production/non-custodial
/// frontend would instead have the connected wallet sign directly and only
/// call the read client + proof-building endpoints here.
export function getRelayerClient(): RemitCreditClient | undefined {
  const config = getConfig();
  if (!config.backend.relayerPrivateKey) return undefined;
  if (!relayerClient) relayerClient = new RemitCreditClient(config, config.backend.relayerPrivateKey);
  return relayerClient;
}

export function getProofService(): ProofService {
  if (!proofService) proofService = new ProofService(getConfig());
  return proofService;
}

export function requireRelayerClient(): RemitCreditClient {
  const client = getRelayerClient();
  if (!client) {
    throw new Error(
      "No relayer configured (BACKEND_RELAYER_PRIVATE_KEY unset) — this action requires the caller's own wallet signature instead. " +
        "A frontend should build the transaction client-side using shared/services/contractClient.ts and have the user sign it."
    );
  }
  return client;
}

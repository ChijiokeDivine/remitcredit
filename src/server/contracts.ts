import { RemitCreditClient } from "../../shared/services/contractClient";
import { ProofService } from "../../shared/services/proofService";
import { getConfig } from "./config";
import { ApiError } from "./api-error";

let readClient: RemitCreditClient | undefined;
let relayerClient: RemitCreditClient | undefined;
let proofService: ProofService | undefined;

export function getReadClient(): RemitCreditClient {
  if (!readClient) readClient = new RemitCreditClient(getConfig());
  return readClient;
}

export function getRelayerClient(): RemitCreditClient | undefined {
  const config = getConfig();
  if (!config.backend.relayerPrivateKey) return undefined;
  if (!relayerClient) {
    relayerClient = new RemitCreditClient(config, config.backend.relayerPrivateKey);
  }
  return relayerClient;
}

export function getProofService(): ProofService {
  if (!proofService) proofService = new ProofService(getConfig());
  return proofService;
}

export function requireRelayerClient(): RemitCreditClient {
  const client = getRelayerClient();
  if (!client) {
    throw new ApiError(
      503,
      "No relayer configured (BACKEND_RELAYER_PRIVATE_KEY unset). " +
        "Write actions need a relayer key on the server, or the user's wallet should sign client-side."
    );
  }
  return client;
}

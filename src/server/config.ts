import { loadConfig, type RemitCreditConfig } from "../../shared/config";

let cached: RemitCreditConfig | undefined;

export function getConfig(): RemitCreditConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Clear cache (useful in tests / hot reload). */
export function resetConfigCache() {
  cached = undefined;
}

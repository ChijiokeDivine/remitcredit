// backend/src/env.ts
import { loadConfig, RemitCreditConfig } from "../../shared/config";

let cached: RemitCreditConfig | undefined;

export function getConfig(): RemitCreditConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

// shared/services/chainInfoService.ts
//
// Small helper around @gluwa/usc-sdk's PrecompileChainInfoProvider. The
// "chainKey" the Attestcoin Protocol uses is a Creditcoin-internal id for
// a source chain — distinct from that chain's own EVM chainId — so this
// module is the one place that translation happens.
import { JsonRpcProvider } from "ethers";
// @ts-ignore — see note in proofService.ts
import { chainInfo } from "@gluwa/usc-sdk";
import { RemitCreditConfig } from "../config";

export interface SupportedChainInfo {
  chainKey: number;
  label?: string;
}

export class ChainInfoService {
  private readonly provider: any;

  constructor(config: RemitCreditConfig) {
    const creditcoinProvider = new JsonRpcProvider(config.creditcoin.rpcUrl);
    this.provider = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);
  }

  async listSupportedChains(): Promise<SupportedChainInfo[]> {
    const chains = await this.provider.getSupportedChains?.();
    if (!chains) return [];
    return Array.isArray(chains) ? chains.map((chainKey: number) => ({ chainKey })) : [];
  }

  async isChainKeySupported(chainKey: number): Promise<boolean> {
    const chains = await this.listSupportedChains();
    return chains.some((c) => c.chainKey === chainKey);
  }
}

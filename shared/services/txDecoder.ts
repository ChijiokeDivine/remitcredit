// shared/services/txDecoder.ts
//
// Decodes a source-chain transaction into the fields RemittanceMicroLoan
// needs (declared sender, amount, timestamp) so the worker can pass them
// alongside a proof. See the trust-boundary note at the top of
// contracts/RemittanceMicroLoan.sol: the precompile proves the raw
// transaction bytes existed and were attested; this module is what
// currently establishes *what the transaction means* (an ERC20 transfer of
// a given amount, from a given sender). Moving this decode on-chain (RLP +
// calldata decoding in Solidity) is the documented next hardening step.
import { JsonRpcProvider, Interface, getAddress } from "ethers";
import { DecodedRemittance } from "../types";

const ERC20_TRANSFER_IFACE = new Interface([
  "function transfer(address to, uint256 amount)",
]);

/// Decodes a plain ERC20 `transfer(to, amount)` call. Supports the common
/// case where a remittance is a direct stablecoin transfer to the
/// borrower's wallet. Extend this (or branch on tx.data's function
/// selector) if you need to support other transfer shapes, e.g.
/// `transferFrom`, native-asset transfers, or a custom remittance contract.
export async function decodeErc20Remittance(
  provider: JsonRpcProvider,
  sourceTxHash: string
): Promise<DecodedRemittance> {
  const tx = await provider.getTransaction(sourceTxHash);
  if (!tx) throw new Error(`Transaction ${sourceTxHash} not found on source chain`);
  if (tx.blockNumber === null) throw new Error(`Transaction ${sourceTxHash} is not yet mined`);

  const block = await provider.getBlock(tx.blockNumber);
  if (!block) throw new Error(`Could not fetch block ${tx.blockNumber}`);

  const decoded = ERC20_TRANSFER_IFACE.parseTransaction({ data: tx.data, value: tx.value });
  if (!decoded || decoded.name !== "transfer") {
    throw new Error(`Transaction ${sourceTxHash} is not a recognized ERC20 transfer() call`);
  }

  return {
    sender: getAddress(tx.from),
    recipient: getAddress(decoded.args.to as string),
    amount: (decoded.args.amount as bigint).toString(),
    sourceTimestamp: block.timestamp,
  };
}

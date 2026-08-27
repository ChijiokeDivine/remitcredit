// scripts/testVerifyRelay.ts
import { JsonRpcProvider, Interface } from "ethers";
import { loadConfig } from "../shared/config";
import { ProofService } from "../shared/services/proofService";

const SCRATCH_ADDRESS = "0x0000000000000000000000000000000000001337";

async function main() {
  const config = loadConfig();
  const provider = new JsonRpcProvider(config.creditcoin.rpcUrl);
  const proofService = new ProofService(config, config.worker.privateKey);

  // Build a fresh proof for this new source tx (waits for attestation internally)
  const proof = await proofService.buildProofForTransaction(
    "0x001743ffbe83a2157ac9791cdfdfd6da118a0b9c4770d1e0831f4929bfd2bcae"
  );
  console.log("proof built, blockHeight:", proof.blockHeight);

  const runtimeBytecode = "0x608060408181526004908136101561001657600080fd5b6000803560e01c63a43f5e551461002c57600080fd5b34610258576003199360c03686011261025b5783356001600160a01b03811695908690036102d15760249586359167ffffffffffffffff928381168091036102cd57604435918483168093036102c95760643590858211610286573660238301121561028657818a013586811161028257368c828501011161028257608435908782116102c557813603938b848601126102c15760a435968988116102bd57873603968d868901126102b957928e9f8f938260a48f601f9f9e9c9a98968397869f9d9b996302f4d16760e01b84528301528582015260a0604482015201520160c48d01378b60c4828d0101528919998a9101168a019060c08b83030160648c01528061010483019f013560c4830152878101356022198095018112156102b957018088019e908e013591908983116102b9578f8360061b3603126102b9579082610124928f60e484015252019d908b5b81811061028a57505050888d03016084890152828b01358c5284830135910181121561028657019882898b01359a0190848b11610286578a60051b9182360381136102825760208281018b9052828b018d90529b6001600160fb1b03106102825788606089858f97958297839685830137010301925af196871561027857859761020c575b888888519015158152f35b909192939495965087933d8911610270575b601f85011685019283118584101761025f5750508591839186528101031261025b5751908115158203610258575090388080808080610201565b80fd5b5080fd5b634e487b7160e01b86526041905284fd5b3d945061021e565b86513d87823e3d90fd5b8880fd5b8780fd5b90919e8f80358252602080910135908115158092036102b5578201528d019e8d01919060010161017c565b8e80fd5b8c80fd5b8b80fd5b8a80fd5b8980fd5b8680fd5b8580fd5b8280fdfea2646970667358221220ad54eb0576cc81c41a054fd058fd2b1b8ce51db8ea263ed5b267d1d5fbff590764736f6c63430008180033"; // <-- paste VerifyRelay's deployedBytecode here

  const relayIface = new Interface([
    "function relayVerifyAndEmit(address precompile, uint64 chainKey, uint64 height, bytes encodedTx, tuple(bytes32 root, tuple(bytes32 hash, bool isLeft)[] siblings) merkleProof, tuple(bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) returns (bool)",
  ]);

  const callData = relayIface.encodeFunctionData("relayVerifyAndEmit", [
    config.usc.precompileAddress,
    proof.chainKey,
    proof.blockHeight,
    proof.txBytes,
    proof.merkleProof,
    proof.continuityProof,
  ]);

  try {
    const result = await provider.send("eth_call", [
      { to: SCRATCH_ADDRESS, data: callData },
      "latest",
      { [SCRATCH_ADDRESS]: { code: runtimeBytecode } },
    ]);
    console.log("eth_call succeeded, raw result:", result);
  } catch (err) {
    console.log("eth_call reverted:", err);
  }
}

main();
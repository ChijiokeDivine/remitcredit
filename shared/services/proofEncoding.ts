// shared/services/proofEncoding.ts
// ABI-encode USC SDK proof objects into `bytes` for RemittanceMicroLoan.
// Precompile tuple shapes (from @gluwa/usc-sdk PrecompileBlockProver):
//   merkle:     (bytes32 root, (bytes32 hash, bool isLeft)[] siblings)
//   continuity: (bytes32 lowerEndpointDigest, bytes32[] roots)

import { AbiCoder, getBytes, hexlify, isHexString } from "ethers";

const coder = AbiCoder.defaultAbiCoder();

const MERKLE_TYPE =
  "tuple(bytes32 root, tuple(bytes32 hash, bool isLeft)[] siblings)";
const CONTINUITY_TYPE = "tuple(bytes32 lowerEndpointDigest, bytes32[] roots)";

type MerkleShape = {
  root: string;
  siblings: Array<{ hash: string; isLeft: boolean }>;
};

type ContinuityShape = {
  lowerEndpointDigest: string;
  roots: string[];
};

/** If value is already hex bytes, return as-is; otherwise ABI-encode the struct. */
export function encodeMerkleProofForContract(value: unknown): string {
  if (typeof value === "string" && isHexString(value)) return value;
  if (value instanceof Uint8Array) return hexlify(value);

  const mp = value as MerkleShape;
  if (!mp?.root || !Array.isArray(mp.siblings)) {
    throw new Error(
      "merkleProof must be hex bytes or { root, siblings: [{ hash, isLeft }] }"
    );
  }
  return coder.encode([MERKLE_TYPE], [
    {
      root: mp.root,
      siblings: mp.siblings.map((s) => ({
        hash: s.hash,
        isLeft: Boolean(s.isLeft),
      })),
    },
  ]);
}

export function encodeContinuityProofForContract(value: unknown): string {
  if (typeof value === "string" && isHexString(value)) return value;
  if (value instanceof Uint8Array) return hexlify(value);

  const cp = value as ContinuityShape;
  if (!cp?.lowerEndpointDigest || !Array.isArray(cp.roots)) {
    throw new Error(
      "continuityProof must be hex bytes or { lowerEndpointDigest, roots: string[] }"
    );
  }
  return coder.encode([CONTINUITY_TYPE], [
    {
      lowerEndpointDigest: cp.lowerEndpointDigest,
      roots: cp.roots,
    },
  ]);
}

export function encodeTxBytesForContract(value: string | Uint8Array): string {
  if (typeof value === "string") {
    if (isHexString(value)) return value;
    throw new Error("txBytes must be hex string or Uint8Array");
  }
  return hexlify(getBytes(value));
}
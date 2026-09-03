// shared/abi.attestation.ts
// ABI fragment for SenderValidationAttestation.sol

export const SENDER_VALIDATION_ATTESTATION_ABI = [
  "function writer() view returns (address)",
  "function setWriter(address newWriter) external",
  "function attest(address senderWallet, address recipient, uint8 verificationStatus, uint32 walletAgeDays, uint8 fundingSourceType, bytes32[] riskFlags) external",
  "function getAttestation(address senderWallet, address recipient) view returns (address sender, address recip, uint8 verificationStatus, uint32 walletAgeDays, uint8 fundingSourceType, bytes32[] riskFlags, uint64 timestamp, bool exists)",
  "function isApproved(address senderWallet, address recipient) view returns (bool)",
  "event WriterUpdated(address indexed previousWriter, address indexed newWriter)",
  "event SenderAttested(address indexed senderWallet, address indexed recipient, uint8 verificationStatus, uint32 walletAgeDays, uint8 fundingSourceType, bytes32[] riskFlags, uint64 timestamp)",
  "error ZeroAddress()",
  "error NotWriter()",
  "error InvalidStatus()",
] as const;

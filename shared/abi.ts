// shared/abi.ts
//
// Hand-written ABI fragments covering only the functions/events worker and
// backend actually call. Kept independent of Hardhat's compiled artifacts
// so this package doesn't need a `hardhat compile` step just to run the
// off-chain services. If you change a contract's function signature,
// update the matching fragment here.

export const REMITTANCE_MICRO_LOAN_ABI = [
  "function registerBorrower(address declaredSender) external",
  "function addDeclaredSender(address sender) external",
  "function submitRemittanceProof(address borrower, uint32 chainKey, uint64 blockHeight, bytes encodedTx, bytes merkleProof, bytes continuityProof, address claimedSender, uint256 claimedAmount, uint64 claimedTimestamp, bytes32 sourceTxHash) external",
  "function submitRemittanceProofBatch(address borrower, uint32 chainKey, uint64[] blockHeights, bytes[] encodedTxs, bytes[] merkleProofs, bytes continuityProof, address[] claimedSenders, uint256[] claimedAmounts, uint64[] claimedTimestamps, bytes32[] sourceTxHashes) external",
  "function requestCreditReview(address borrower) external",
  "function requestLoan(uint256 amount) external",
  "function repay(uint256 amount) external",
  "function getBorrower(address borrower) external view returns (tuple(bool registered, address declaredSender, bool eligible, uint256 creditLimit, uint16 riskScoreBps, uint256 outstandingPrincipal, uint64 lastReviewedAt))",
  "function getDeclaredSenders(address borrower) external view returns (address[])",
  "function availableCredit(address borrower) external view returns (uint256)",
  "event BorrowerRegistered(address indexed borrower, address indexed declaredSender)",
  "event RemittanceVerified(address indexed borrower, address indexed sender, uint256 amount, uint64 sourceTimestamp, bytes32 sourceTxHash)",
  "event CreditReviewed(address indexed borrower, bool eligible, uint256 creditLimit, uint16 riskScoreBps, string rationale)",
  "event LoanDisbursed(address indexed borrower, uint256 amount, uint256 newOutstanding)",
  "event LoanRepaid(address indexed borrower, uint256 amount, uint256 newOutstanding)",
] as const;

export const REMITTANCE_CREDIT_REGISTRY_ABI = [
  "function getTransfers(address borrower) external view returns (tuple(address sender, uint256 amount, uint64 sourceTimestamp, bytes32 sourceTxHash, uint64 recordedAt)[])",
  "function getStats(address borrower, uint64 lookbackWindowSeconds) external view returns (tuple(uint256 transferCount, uint256 totalAmount, uint64 firstTimestamp, uint64 lastTimestamp, uint64 avgIntervalSeconds, uint16 intervalConsistencyBps))",
  "function isTransferRecorded(bytes32 sourceTxHash) external view returns (bool)",
  "event VerifiedTransferRecorded(address indexed borrower, address indexed sender, uint256 amount, uint64 sourceTimestamp, bytes32 sourceTxHash)",
] as const;

export const CREDIT_DECISION_ENGINE_ABI = [
  "function params() external view returns (tuple(uint256 minTransferCount, uint256 minTotalAmount, uint16 minConsistencyBps, uint16 creditMultiplierBps, uint256 maxCreditLimit, uint64 lookbackWindowSeconds, uint64 maxStalenessSeconds))",
  "event DecisionComputed(address indexed borrower, bool eligible, uint256 creditLimit, uint16 riskScoreBps)",
] as const;

export const ERC20_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function mint(address to, uint256 amount) external",
] as const;

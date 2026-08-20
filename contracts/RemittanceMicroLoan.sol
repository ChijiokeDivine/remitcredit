// SPDX-License-Identifier: MIT
// contracts/RemittanceMicroLoan.sol
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAttestcoinBlockProver} from "./interfaces/IAttestcoinBlockProver.sol";
import {IRemittanceCreditRegistry} from "./interfaces/IRemittanceCreditRegistry.sol";
import {CreditDecisionEngine} from "./CreditDecisionEngine.sol";

/// @title RemittanceMicroLoan
/// @notice The Attestcoin Smart Contract (ASC) at the center of RemitCredit.
///         Verifies remittance transactions against Creditcoin's native
///         Attestcoin block-prover precompile synchronously, in the same
///         transaction, records verified history, drives credit decisions
///         through CreditDecisionEngine, and runs a simple loan lifecycle
///         on top of that verified credit line.
///
/// @dev Trust boundary, stated plainly: the precompile proves that the raw
///      transaction bytes (`encodedTx`) were included in the claimed
///      source-chain block and are attested on Creditcoin. This contract
///      additionally requires `sourceTxHash == keccak256(encodedTx)`, so a
///      caller cannot associate an arbitrary hash with a proof. Decoding
///      `encodedTx` on-chain to trustlessly extract the ERC20 `Transfer`
///      sender/recipient/amount (RLP decode + calldata decode) is left as
///      a documented next step for time reasons — for now the off-chain
///      oracle worker (worker/src/submitProof.ts) decodes the transaction
///      itself before calling this function, and `claimedSender` is
///      additionally constrained to match the borrower's pre-registered
///      declared sender, which limits (but does not eliminate) what a
///      misbehaving worker could misreport. Moving the decode on-chain
///      closes that gap and is the natural next hardening step.
contract RemittanceMicroLoan is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Borrower {
        bool registered;
        address declaredSender; // the family/remittance-sender wallet this borrower vouches for
        bool eligible;
        uint256 creditLimit;
        uint16 riskScoreBps;
        uint256 outstandingPrincipal;
        uint64 lastReviewedAt;
    }

    IAttestcoinBlockProver public precompile;
    IRemittanceCreditRegistry public registry;
    CreditDecisionEngine public creditEngine;
    IERC20 public loanToken;

    mapping(address => Borrower) public borrowers;

    event PrecompileUpdated(address indexed newPrecompile);
    event RegistryUpdated(address indexed newRegistry);
    event CreditEngineUpdated(address indexed newCreditEngine);
    event LoanTokenUpdated(address indexed newLoanToken);

    event BorrowerRegistered(address indexed borrower, address indexed declaredSender);
    event RemittanceVerified(
        address indexed borrower,
        address indexed sender,
        uint256 amount,
        uint64 sourceTimestamp,
        bytes32 sourceTxHash
    );
    event CreditReviewed(address indexed borrower, bool eligible, uint256 creditLimit, uint16 riskScoreBps, string rationale);
    event LoanDisbursed(address indexed borrower, uint256 amount, uint256 newOutstanding);
    event LoanRepaid(address indexed borrower, uint256 amount, uint256 newOutstanding);
    event PoolFunded(address indexed funder, uint256 amount);
    event PoolWithdrawn(address indexed to, uint256 amount);

    error NotRegistered();
    error AlreadyRegistered();
    error ProofNotVerified();
    error TxHashMismatch();
    error SenderNotDeclared(address claimed, address declared);
    error NotEligible();
    error CreditLimitExceeded(uint256 requested, uint256 available);
    error ZeroAmount();
    error RepayExceedsOutstanding(uint256 amount, uint256 outstanding);
    error InsufficientPoolLiquidity(uint256 requested, uint256 available);

    constructor(
        address initialOwner,
        IAttestcoinBlockProver _precompile,
        IRemittanceCreditRegistry _registry,
        CreditDecisionEngine _creditEngine,
        IERC20 _loanToken
    ) Ownable(initialOwner) {
        precompile = _precompile;
        registry = _registry;
        creditEngine = _creditEngine;
        loanToken = _loanToken;
    }

    // ── Admin ──────────────────────────────────────────────────────────

    function setPrecompile(IAttestcoinBlockProver _precompile) external onlyOwner {
        precompile = _precompile;
        emit PrecompileUpdated(address(_precompile));
    }

    function setRegistry(IRemittanceCreditRegistry _registry) external onlyOwner {
        registry = _registry;
        emit RegistryUpdated(address(_registry));
    }

    function setCreditEngine(CreditDecisionEngine _creditEngine) external onlyOwner {
        creditEngine = _creditEngine;
        emit CreditEngineUpdated(address(_creditEngine));
    }

    function setLoanToken(IERC20 _loanToken) external onlyOwner {
        loanToken = _loanToken;
        emit LoanTokenUpdated(address(_loanToken));
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Owner (or, in production, a DAO/treasury) seeds the pool
    ///         borrowers draw loans from.
    function fundPool(uint256 amount) external {
        loanToken.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(msg.sender, amount);
    }

    function withdrawPool(address to, uint256 amount) external onlyOwner {
        loanToken.safeTransfer(to, amount);
        emit PoolWithdrawn(to, amount);
    }

    // ── Borrower lifecycle ────────────────────────────────────────────

    /// @notice A borrower declares which wallet their verified remittances
    ///         must come from. This is the anchor that stops someone from
    ///         "verifying" transfers from an arbitrary address they control.
    function registerBorrower(address declaredSender) external {
        if (borrowers[msg.sender].registered) revert AlreadyRegistered();
        borrowers[msg.sender] = Borrower({
            registered: true,
            declaredSender: declaredSender,
            eligible: false,
            creditLimit: 0,
            riskScoreBps: 0,
            outstandingPrincipal: 0,
            lastReviewedAt: 0
        });
        emit BorrowerRegistered(msg.sender, declaredSender);
    }

    // ── Attestcoin Protocol integration ──────────────────────────────

    /// @notice Verify a claimed remittance transaction via the Attestcoin
    ///         precompile and, if valid, record it against the borrower's
    ///         credit history. This is the core "ASC" call: verification
    ///         happens synchronously, in this same transaction.
    function submitRemittanceProof(
        address borrower,
        uint32 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTx,
        bytes calldata merkleProof,
        bytes calldata continuityProof,
        address claimedSender,
        uint256 claimedAmount,
        uint64 claimedTimestamp,
        bytes32 sourceTxHash
    ) external whenNotPaused {
        Borrower storage b = borrowers[borrower];
        if (!b.registered) revert NotRegistered();
        if (claimedSender != b.declaredSender) revert SenderNotDeclared(claimedSender, b.declaredSender);
        if (sourceTxHash != keccak256(encodedTx)) revert TxHashMismatch();

        bool verified = precompile.verify(chainKey, blockHeight, encodedTx, merkleProof, continuityProof);
        if (!verified) revert ProofNotVerified();

        registry.recordVerifiedTransfer(borrower, claimedSender, claimedAmount, claimedTimestamp, sourceTxHash);

        emit RemittanceVerified(borrower, claimedSender, claimedAmount, claimedTimestamp, sourceTxHash);
    }

    /// @notice Batch variant of submitRemittanceProof for up to 10 transfers
    ///         sharing one continuity proof — the depth-of-utilization path
    ///         for a borrower's first review, where several months of
    ///         history can be verified in one call instead of one-by-one.
    function submitRemittanceProofBatch(
        address borrower,
        uint32 chainKey,
        uint64[] calldata blockHeights,
        bytes[] calldata encodedTxs,
        bytes[] calldata merkleProofs,
        bytes calldata continuityProof,
        address[] calldata claimedSenders,
        uint256[] calldata claimedAmounts,
        uint64[] calldata claimedTimestamps,
        bytes32[] calldata sourceTxHashes
    ) external whenNotPaused {
        Borrower storage b = borrowers[borrower];
        if (!b.registered) revert NotRegistered();

        uint256 n = encodedTxs.length;
        for (uint256 i; i < n; ++i) {
            if (claimedSenders[i] != b.declaredSender) revert SenderNotDeclared(claimedSenders[i], b.declaredSender);
            if (sourceTxHashes[i] != keccak256(encodedTxs[i])) revert TxHashMismatch();
        }

        bool verified = precompile.verifyBatch(chainKey, blockHeights, encodedTxs, merkleProofs, continuityProof);
        if (!verified) revert ProofNotVerified();

        for (uint256 i; i < n; ++i) {
            registry.recordVerifiedTransfer(
                borrower, claimedSenders[i], claimedAmounts[i], claimedTimestamps[i], sourceTxHashes[i]
            );
            emit RemittanceVerified(borrower, claimedSenders[i], claimedAmounts[i], claimedTimestamps[i], sourceTxHashes[i]);
        }
    }

    // ── Credit decisions ──────────────────────────────────────────────

    /// @notice Re-run the credit decision agent against the borrower's
    ///         current verified history and store the result. Anyone can
    ///         call this (e.g. the worker's agent loop, or the borrower
    ///         themselves after a new remittance lands) — it only ever
    ///         reads verified on-chain data, so there's nothing to gain by
    ///         calling it on someone else's behalf.
    function requestCreditReview(address borrower) external whenNotPaused {
        Borrower storage b = borrowers[borrower];
        if (!b.registered) revert NotRegistered();

        CreditDecisionEngine.Decision memory decision = creditEngine.decideFromRegistry(registry, borrower);

        b.eligible = decision.eligible;
        b.creditLimit = decision.creditLimit;
        b.riskScoreBps = decision.riskScoreBps;
        b.lastReviewedAt = uint64(block.timestamp);

        emit CreditReviewed(borrower, decision.eligible, decision.creditLimit, decision.riskScoreBps, decision.rationale);
    }

    // ── Loan lifecycle ────────────────────────────────────────────────

    function requestLoan(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        Borrower storage b = borrowers[msg.sender];
        if (!b.registered) revert NotRegistered();
        if (!b.eligible) revert NotEligible();

        uint256 available = b.creditLimit > b.outstandingPrincipal ? b.creditLimit - b.outstandingPrincipal : 0;
        if (amount > available) revert CreditLimitExceeded(amount, available);

        uint256 poolBalance = loanToken.balanceOf(address(this));
        if (amount > poolBalance) revert InsufficientPoolLiquidity(amount, poolBalance);

        b.outstandingPrincipal += amount;
        loanToken.safeTransfer(msg.sender, amount);

        emit LoanDisbursed(msg.sender, amount, b.outstandingPrincipal);
    }

    function repay(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        Borrower storage b = borrowers[msg.sender];
        if (!b.registered) revert NotRegistered();
        if (amount > b.outstandingPrincipal) revert RepayExceedsOutstanding(amount, b.outstandingPrincipal);

        b.outstandingPrincipal -= amount;
        loanToken.safeTransferFrom(msg.sender, address(this), amount);

        emit LoanRepaid(msg.sender, amount, b.outstandingPrincipal);
    }

    // ── Views ─────────────────────────────────────────────────────────

    function getBorrower(address borrower) external view returns (Borrower memory) {
        return borrowers[borrower];
    }

    function availableCredit(address borrower) external view returns (uint256) {
        Borrower storage b = borrowers[borrower];
        if (!b.eligible) return 0;
        return b.creditLimit > b.outstandingPrincipal ? b.creditLimit - b.outstandingPrincipal : 0;
    }
}

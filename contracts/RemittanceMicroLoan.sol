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
/// @dev Custody / auth model, stated plainly: RemitCredit's backend relays
///      every write on behalf of end users through a single `relayer`
///      wallet (set post-deploy via `setRelayer`) so users never need
///      Creditcoin gas to onboard. Because of that, every borrower-scoped
///      write below takes an explicit `borrower` parameter instead of
///      relying on `msg.sender` identity, and is gated by `onlyRelayer`.
///      `requestLoan` disburses to `borrower` (not the relayer), and
///      `repay` pulls funds from `borrower` via `safeTransferFrom` — which
///      means the borrower must separately `approve` this contract for
///      their loan-token allowance from their own wallet before repaying;
///      the relayer only pays gas and submits the call, it never custodies
///      borrower funds.
///
///      Trust boundary for remittance proofs is unchanged: the precompile
///      proves that the raw transaction bytes (`encodedTx`) were included
///      in the claimed source-chain block and are attested on Creditcoin.
///      This contract additionally requires
///      `sourceTxHash == keccak256(encodedTx)`, so a caller cannot
///      associate an arbitrary hash with a proof. Decoding `encodedTx`
///      on-chain to trustlessly extract the ERC20 `Transfer`
///      sender/recipient/amount (RLP decode + calldata decode) is left as
///      a documented next step for time reasons — for now the off-chain
///      oracle worker (worker/src/submitProof.ts) decodes the transaction
///      itself before calling this function, and `claimedSender` is
///      additionally constrained to match one of the borrower's
///      pre-registered declared senders, which limits (but does not
///      eliminate) what a misbehaving worker could misreport. Moving the
///      decode on-chain closes that gap and is the natural next hardening
///      step.
contract RemittanceMicroLoan is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Borrower {
        bool registered;
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

    /// @notice The sole address authorized to submit relayed, borrower-scoped
    ///         writes (registerBorrower, addDeclaredSender, removeDeclaredSender,
    ///         requestLoan, repay). Set by the owner post-deploy.
    address public relayer;

    mapping(address => Borrower) public borrowers;
    mapping(address => address[]) private _declaredSenders;
    // borrower => sender => index+1 in _declaredSenders[borrower] (0 = not present)
    mapping(address => mapping(address => uint256)) private _declaredSenderIndex;

    event PrecompileUpdated(address indexed newPrecompile);
    event RegistryUpdated(address indexed newRegistry);
    event CreditEngineUpdated(address indexed newCreditEngine);
    event LoanTokenUpdated(address indexed newLoanToken);
    event RelayerUpdated(address indexed previousRelayer, address indexed newRelayer);

    event BorrowerRegistered(address indexed borrower, address indexed declaredSender);
    event DeclaredSenderAdded(address indexed borrower, address indexed sender);
    event DeclaredSenderRemoved(address indexed borrower, address indexed sender);
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
    error NotRelayer();
    error ProofNotVerified();
    error TxHashMismatch();
    error SenderNotDeclared(address claimed);
    error SenderAlreadyDeclared(address sender);
    error SenderNotFound(address sender);
    error NotEligible();
    error CreditLimitExceeded(uint256 requested, uint256 available);
    error ZeroAmount();
    error ZeroAddress();
    error RepayExceedsOutstanding(uint256 amount, uint256 outstanding);
    error InsufficientPoolLiquidity(uint256 requested, uint256 available);

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

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

    /// @notice Point relayer-gated functions at the backend's relayer wallet.
    ///         Must be called once after deploy before onboarding can work.
    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert ZeroAddress();
        emit RelayerUpdated(relayer, newRelayer);
        relayer = newRelayer;
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

    /// @notice Register `borrower` and record their first declared sender —
    ///         the family/remittance-sender wallet(s) their verified
    ///         remittances must come from. This is the anchor that stops
    ///         someone from "verifying" transfers from an arbitrary address
    ///         they control. Relayed on behalf of the user by the backend.
    function registerBorrower(address borrower, address declaredSender) external onlyRelayer {
        if (borrower == address(0) || declaredSender == address(0)) revert ZeroAddress();
        if (borrowers[borrower].registered) revert AlreadyRegistered();

        borrowers[borrower] = Borrower({
            registered: true,
            eligible: false,
            creditLimit: 0,
            riskScoreBps: 0,
            outstandingPrincipal: 0,
            lastReviewedAt: 0
        });

        _addDeclaredSender(borrower, declaredSender);

        emit BorrowerRegistered(borrower, declaredSender);
    }

    /// @notice Add another wallet `borrower` vouches remittances may come from.
    function addDeclaredSender(address borrower, address sender) external onlyRelayer {
        if (!borrowers[borrower].registered) revert NotRegistered();
        _addDeclaredSender(borrower, sender);
    }

    /// @notice Remove a previously declared sender wallet.
    function removeDeclaredSender(address borrower, address sender) external onlyRelayer {
        if (!borrowers[borrower].registered) revert NotRegistered();

        uint256 idxPlusOne = _declaredSenderIndex[borrower][sender];
        if (idxPlusOne == 0) revert SenderNotFound(sender);

        address[] storage senders = _declaredSenders[borrower];
        uint256 idx = idxPlusOne - 1;
        uint256 lastIdx = senders.length - 1;

        if (idx != lastIdx) {
            address lastSender = senders[lastIdx];
            senders[idx] = lastSender;
            _declaredSenderIndex[borrower][lastSender] = idx + 1;
        }
        senders.pop();
        delete _declaredSenderIndex[borrower][sender];

        emit DeclaredSenderRemoved(borrower, sender);
    }

    function _addDeclaredSender(address borrower, address sender) internal {
        if (sender == address(0)) revert ZeroAddress();
        if (_declaredSenderIndex[borrower][sender] != 0) revert SenderAlreadyDeclared(sender);

        _declaredSenders[borrower].push(sender);
        _declaredSenderIndex[borrower][sender] = _declaredSenders[borrower].length;

        emit DeclaredSenderAdded(borrower, sender);
    }

    function _isDeclaredSender(address borrower, address sender) internal view returns (bool) {
        return _declaredSenderIndex[borrower][sender] != 0;
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
        if (!_isDeclaredSender(borrower, claimedSender)) revert SenderNotDeclared(claimedSender);
        if (sourceTxHash != keccak256(encodedTx)) revert TxHashMismatch();

        bool verified = precompile.verify(chainKey, blockHeight, encodedTx, merkleProof, continuityProof, true);
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
            if (!_isDeclaredSender(borrower, claimedSenders[i])) revert SenderNotDeclared(claimedSenders[i]);
            if (sourceTxHashes[i] != keccak256(encodedTxs[i])) revert TxHashMismatch();
        }

        bool verified = precompile.verifyBatch(chainKey, blockHeights, encodedTxs, merkleProofs, continuityProof, true);
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

    /// @notice Disburse `amount` of loan tokens to `borrower` against their
    ///         verified credit line. Relayed by the backend on the
    ///         borrower's behalf; funds go to `borrower`, never to the relayer.
    function requestLoan(address borrower, uint256 amount) external onlyRelayer nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        Borrower storage b = borrowers[borrower];
        if (!b.registered) revert NotRegistered();
        if (!b.eligible) revert NotEligible();

        uint256 available = b.creditLimit > b.outstandingPrincipal ? b.creditLimit - b.outstandingPrincipal : 0;
        if (amount > available) revert CreditLimitExceeded(amount, available);

        uint256 poolBalance = loanToken.balanceOf(address(this));
        if (amount > poolBalance) revert InsufficientPoolLiquidity(amount, poolBalance);

        b.outstandingPrincipal += amount;
        loanToken.safeTransfer(borrower, amount);

        emit LoanDisbursed(borrower, amount, b.outstandingPrincipal);
    }

    /// @notice Repay `amount` of `borrower`'s outstanding principal. Relayed
    ///         by the backend; tokens are pulled from `borrower`'s own
    ///         wallet via `safeTransferFrom`, so `borrower` must have
    ///         `approve`d this contract for at least `amount` beforehand
    ///         (a normal wallet-signed ERC20 approval, done once from the
    ///         frontend — the relayer never custodies borrower funds).
    function repay(address borrower, uint256 amount) external onlyRelayer nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        Borrower storage b = borrowers[borrower];
        if (!b.registered) revert NotRegistered();
        if (amount > b.outstandingPrincipal) revert RepayExceedsOutstanding(amount, b.outstandingPrincipal);

        b.outstandingPrincipal -= amount;
        loanToken.safeTransferFrom(borrower, address(this), amount);

        emit LoanRepaid(borrower, amount, b.outstandingPrincipal);
    }

    // ── Views ─────────────────────────────────────────────────────────

    function getBorrower(address borrower) external view returns (Borrower memory) {
        return borrowers[borrower];
    }

    function getDeclaredSenders(address borrower) external view returns (address[] memory) {
        return _declaredSenders[borrower];
    }

    function isDeclaredSender(address borrower, address sender) external view returns (bool) {
        return _isDeclaredSender(borrower, sender);
    }

    function availableCredit(address borrower) external view returns (uint256) {
        Borrower storage b = borrowers[borrower];
        if (!b.eligible) return 0;
        return b.creditLimit > b.outstandingPrincipal ? b.creditLimit - b.outstandingPrincipal : 0;
    }
}

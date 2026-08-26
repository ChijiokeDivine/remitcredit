// SPDX-License-Identifier: MIT
// contracts/interfaces/IAttestcoinBlockProver.sol
pragma solidity ^0.8.24;

/// @title IAttestcoinBlockProver
/// @notice Interface to Creditcoin's native Attestcoin Protocol verifier
///         precompile, deployed at a fixed address
///         (0x0000000000000000000000000000000000000FD2 by default).
///
/// @dev This mirrors the precompile's real ABI exactly (confirmed against
///      the gluwa cc-next-query-builder package's bundled block_prover.json
///      — the same contract family as the gluwa usc-sdk package):
///        - chainKey / height are uint64, not uint32/uint64 as originally
///          guessed.
///        - merkleProof / continuityProof are structured tuples on-chain,
///          NOT opaque bytes. The off-chain worker still sends them as
///          ABI-encoded bytes (see shared/services/proofEncoding.ts) — the
///          caller in RemittanceMicroLoan is responsible for
///          `abi.decode`-ing them into these structs immediately before
///          calling this interface.
///        - There is no `emitEvent` boolean parameter. Instead there are
///          two distinct functions: `verify` (view, no event, no revert
///          side effects beyond the read) and `verifyAndEmit`
///          (state-changing, reverts on failed verification, emits
///          `TransactionVerified`). RemittanceMicroLoan uses
///          `verifyAndEmit` since it wants a real on-chain proof event and
///          a hard revert on failure.
interface IAttestcoinBlockProver {
    struct MerkleProofEntry {
        bytes32 hash;
        bool isLeft;
    }

    struct MerkleProof {
        bytes32 root;
        MerkleProofEntry[] siblings;
    }

    struct ContinuityProof {
        bytes32 lowerEndpointDigest;
        bytes32[] roots;
    }

    event TransactionVerified(uint64 indexed chainKey, uint64 indexed height, uint64 transactionIndex);

    /// @notice Read-only verification — no event, no state change.
    function verify(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external view returns (bool verified);

    /// @notice State-changing verification. Reverts on failed verification;
    ///         emits TransactionVerified on success.
    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external returns (bool verified);

    /// @notice Batch read-only variant — up to 10 transactions sharing one continuity proof.
    function verify(
        uint64 chainKey,
        uint64[] calldata heights,
        bytes[] calldata encodedTransactions,
        MerkleProof[] calldata merkleProofs,
        ContinuityProof calldata sharedContinuityProof
    ) external view returns (bool verified);

    /// @notice Batch state-changing variant.
    function verifyAndEmit(
        uint64 chainKey,
        uint64[] calldata heights,
        bytes[] calldata encodedTransactions,
        MerkleProof[] calldata merkleProofs,
        ContinuityProof calldata sharedContinuityProof
    ) external returns (bool verified);
}

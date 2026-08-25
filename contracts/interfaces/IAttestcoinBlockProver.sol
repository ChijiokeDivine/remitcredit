// SPDX-License-Identifier: MIT
// contracts/interfaces/IAttestcoinBlockProver.sol
pragma solidity ^0.8.24;

/// @title IAttestcoinBlockProver
/// @notice Interface to Creditcoin's native Attestcoin Protocol verifier
///         precompile. A contract that calls this synchronously, in the
///         same transaction as its business logic, is what the docs call
///         an "Attestcoin Smart Contract" (ASC).
///
/// @dev The field names here (chainKey, blockHeight, encodedTx, merkleProof,
///      continuityProof) mirror the signature Creditcoin publishes for the
///      precompile: `verify(chainKey, blockHeight, encodedTx, merkleProof,
///      continuityProof) -> bool`. The two proof structs are treated as
///      opaque ABI-encoded `bytes` here rather than typed structs, since the
///      exact on-chain struct layout for `TransactionMerkleProof` /
///      `ContinuityProof` isn't reproduced in the public marketing/docs
///      pages this repo was built against. Before a mainnet deploy, confirm
///      the real ABI against the live precompile (conventionally deployed
///      at a low, reserved address — placeholder below) and update this
///      interface + PRECOMPILE_ADDRESS in RemittanceMicroLoan if it differs.
///      Everything else in this codebase is independent of that detail.
interface IAttestcoinBlockProver {
    /// @notice Verify a single source-chain transaction's inclusion via
    ///         Merkle proof + continuity proof, synchronously.
    /// @param chainKey Creditcoin-internal identifier for the source chain
    ///        (NOT the same as the chain's EVM chainId — resolve it via
    ///        PrecompileChainInfoProvider off-chain, see shared/services/chainInfoService.ts).
    /// @param blockHeight Height of the source-chain block containing the tx.
    /// @param encodedTx RLP-encoded (or SDK-provided) raw transaction bytes.
    /// @param merkleProof ABI-encoded Merkle inclusion proof for the tx within its block.
    /// @param continuityProof ABI-encoded proof chaining the block back to an attested checkpoint.
    /// @return verified True if the transaction is proven included and attested.
    function verify(
        uint32 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTx,
        bytes calldata merkleProof,
        bytes calldata continuityProof,
        bool emitEvent
    ) external returns (bool verified);

    /// @notice Batch variant — up to 10 transactions sharing one continuity proof.
    function verifyBatch(
        uint32 chainKey,
        uint64[] calldata blockHeights,
        bytes[] calldata encodedTxs,
        bytes[] calldata merkleProofs,
        bytes calldata continuityProof,
        bool emitEvent
    ) external returns (bool verified);
}

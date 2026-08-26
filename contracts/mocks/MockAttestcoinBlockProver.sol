// SPDX-License-Identifier: MIT
// contracts/mocks/MockAttestcoinBlockProver.sol
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAttestcoinBlockProver} from "../interfaces/IAttestcoinBlockProver.sol";

/// @notice Test double for the real Attestcoin precompile, which only
///         exists on actual Creditcoin networks. The owner whitelists
///         specific (encodedTx) hashes as "verified" so contract tests can
///         exercise both the success and failure paths of
///         RemittanceMicroLoan without a live source chain or prover API.
///
/// @dev Merkle/continuity proof contents are intentionally ignored here —
///      only `encodedTx` (or each entry of `encodedTxs` for the batch path)
///      is checked against the whitelist, since the mock's job is to stand
///      in for "did the precompile consider this transaction proven",
///      not to actually validate proof structure.
contract MockAttestcoinBlockProver is Ownable, IAttestcoinBlockProver {
    mapping(bytes32 => bool) public verifiedTxHashes;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setVerified(bytes calldata encodedTx, bool isVerified) external onlyOwner {
        verifiedTxHashes[keccak256(encodedTx)] = isVerified;
    }

    function verify(
        uint64, /* chainKey */
        uint64, /* height */
        bytes calldata encodedTransaction,
        MerkleProof calldata, /* merkleProof */
        ContinuityProof calldata /* continuityProof */
    ) external view returns (bool verified) {
        return verifiedTxHashes[keccak256(encodedTransaction)];
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata, /* merkleProof */
        ContinuityProof calldata /* continuityProof */
    ) external returns (bool verified) {
        bool ok = verifiedTxHashes[keccak256(encodedTransaction)];
        if (ok) emit TransactionVerified(chainKey, height, 0);
        return ok;
    }

    function verify(
        uint64, /* chainKey */
        uint64[] calldata, /* heights */
        bytes[] calldata encodedTransactions,
        MerkleProof[] calldata, /* merkleProofs */
        ContinuityProof calldata /* sharedContinuityProof */
    ) external view returns (bool verified) {
        for (uint256 i; i < encodedTransactions.length; ++i) {
            if (!verifiedTxHashes[keccak256(encodedTransactions[i])]) return false;
        }
        return true;
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64[] calldata heights,
        bytes[] calldata encodedTransactions,
        MerkleProof[] calldata, /* merkleProofs */
        ContinuityProof calldata /* sharedContinuityProof */
    ) external returns (bool verified) {
        for (uint256 i; i < encodedTransactions.length; ++i) {
            if (!verifiedTxHashes[keccak256(encodedTransactions[i])]) return false;
        }
        for (uint256 i; i < encodedTransactions.length; ++i) {
            emit TransactionVerified(chainKey, heights[i], uint64(i));
        }
        return true;
    }
}

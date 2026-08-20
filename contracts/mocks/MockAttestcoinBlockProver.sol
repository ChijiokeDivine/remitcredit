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
contract MockAttestcoinBlockProver is Ownable, IAttestcoinBlockProver {
    mapping(bytes32 => bool) public verifiedTxHashes;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setVerified(bytes calldata encodedTx, bool isVerified) external onlyOwner {
        verifiedTxHashes[keccak256(encodedTx)] = isVerified;
    }

    function verify(
        uint32, /* chainKey */
        uint64, /* blockHeight */
        bytes calldata encodedTx,
        bytes calldata, /* merkleProof */
        bytes calldata /* continuityProof */
    ) external view returns (bool) {
        return verifiedTxHashes[keccak256(encodedTx)];
    }

    function verifyBatch(
        uint32, /* chainKey */
        uint64[] calldata, /* blockHeights */
        bytes[] calldata encodedTxs,
        bytes[] calldata, /* merkleProofs */
        bytes calldata /* continuityProof */
    ) external view returns (bool) {
        for (uint256 i; i < encodedTxs.length; ++i) {
            if (!verifiedTxHashes[keccak256(encodedTxs[i])]) return false;
        }
        return true;
    }
}

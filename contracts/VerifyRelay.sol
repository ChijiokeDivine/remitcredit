// contracts/VerifyRelay.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAttestcoinBlockProver} from "./interfaces/IAttestcoinBlockProver.sol"; // match your real path

contract VerifyRelay {
    function relayVerifyAndEmit(
        address precompile,
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTx,
        IAttestcoinBlockProver.MerkleProof calldata merkleProof,
        IAttestcoinBlockProver.ContinuityProof calldata continuityProof
    ) external returns (bool) {
        return IAttestcoinBlockProver(precompile).verifyAndEmit(
            chainKey, height, encodedTx, merkleProof, continuityProof
        );
    }
}
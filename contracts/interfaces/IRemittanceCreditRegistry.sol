// SPDX-License-Identifier: MIT
// contracts/interfaces/IRemittanceCreditRegistry.sol
pragma solidity ^0.8.24;

interface IRemittanceCreditRegistry {
    struct VerifiedTransfer {
        address sender; // declared remittance sender on the source chain
        uint256 amount; // amount in the source token's smallest unit
        uint64 sourceTimestamp; // block timestamp on the source chain
        bytes32 sourceTxHash; // source-chain tx hash, for dedup + audit trail
        uint64 recordedAt; // Creditcoin block timestamp when verified
    }

    struct RemittanceStats {
        uint256 transferCount;
        uint256 totalAmount;
        uint64 firstTimestamp;
        uint64 lastTimestamp;
        uint64 avgIntervalSeconds; // 0 if fewer than 2 transfers
        uint16 intervalConsistencyBps; // 0-10000, higher = more regular; 0 if undefined
    }

    function recordVerifiedTransfer(
        address borrower,
        address sender,
        uint256 amount,
        uint64 sourceTimestamp,
        bytes32 sourceTxHash
    ) external;

    function isTransferRecorded(bytes32 sourceTxHash) external view returns (bool);

    function getTransfers(address borrower) external view returns (VerifiedTransfer[] memory);

    function getStats(address borrower, uint64 lookbackWindowSeconds)
        external
        view
        returns (RemittanceStats memory stats);
}

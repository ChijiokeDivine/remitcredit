// SPDX-License-Identifier: MIT
// contracts/RemittanceCreditRegistry.sol
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRemittanceCreditRegistry} from "./interfaces/IRemittanceCreditRegistry.sol";

/// @title RemittanceCreditRegistry
/// @notice Append-only ledger of remittance transfers that have already
///         passed Attestcoin Protocol verification. This contract never
///         talks to the precompile itself — it trusts only the designated
///         `recorder` (RemittanceMicroLoan) to have done that check. Keeping
///         verification and storage in separate contracts means the credit
///         history / stats logic can be reused by other ASC products later
///         without re-deriving it from raw proofs each time.
contract RemittanceCreditRegistry is Ownable, IRemittanceCreditRegistry {
    address public recorder;

    mapping(address => VerifiedTransfer[]) private _transfersByBorrower;
    mapping(bytes32 => bool) private _recordedTxHashes;

    event RecorderUpdated(address indexed previousRecorder, address indexed newRecorder);
    event VerifiedTransferRecorded(
        address indexed borrower,
        address indexed sender,
        uint256 amount,
        uint64 sourceTimestamp,
        bytes32 sourceTxHash
    );

    error NotRecorder();
    error DuplicateTransfer(bytes32 sourceTxHash);
    error OutOfOrderTimestamp(uint64 provided, uint64 expectedAtLeast);

    modifier onlyRecorder() {
        if (msg.sender != recorder) revert NotRecorder();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Set the only contract allowed to write verified transfers.
    ///         In production this is the RemittanceMicroLoan ASC, set once
    ///         after deployment (see scripts/deploy.ts).
    function setRecorder(address newRecorder) external onlyOwner {
        emit RecorderUpdated(recorder, newRecorder);
        recorder = newRecorder;
    }

    /// @inheritdoc IRemittanceCreditRegistry
    function recordVerifiedTransfer(
        address borrower,
        address sender,
        uint256 amount,
        uint64 sourceTimestamp,
        bytes32 sourceTxHash
    ) external onlyRecorder {
        if (_recordedTxHashes[sourceTxHash]) revert DuplicateTransfer(sourceTxHash);

        VerifiedTransfer[] storage borrowerTransfers = _transfersByBorrower[borrower];
        uint256 len = borrowerTransfers.length;

        // Enforce strictly non-decreasing timestamps to prevent underflows in calculations
        if (len > 0) {
            uint64 lastTimestamp = borrowerTransfers[len - 1].sourceTimestamp;
            if (sourceTimestamp < lastTimestamp) {
                revert OutOfOrderTimestamp(sourceTimestamp, lastTimestamp);
            }
        }

        _recordedTxHashes[sourceTxHash] = true;

        borrowerTransfers.push(
            VerifiedTransfer({
                sender: sender,
                amount: amount,
                sourceTimestamp: sourceTimestamp,
                sourceTxHash: sourceTxHash,
                recordedAt: uint64(block.timestamp)
            })
        );

        emit VerifiedTransferRecorded(borrower, sender, amount, sourceTimestamp, sourceTxHash);
    }

    /// @inheritdoc IRemittanceCreditRegistry
    function isTransferRecorded(bytes32 sourceTxHash) external view returns (bool) {
        return _recordedTxHashes[sourceTxHash];
    }

    /// @inheritdoc IRemittanceCreditRegistry
    function getTransfers(address borrower) external view returns (VerifiedTransfer[] memory) {
        return _transfersByBorrower[borrower];
    }

    /// @notice Paginated view function for high-volume borrowers to avoid RPC memory limits
    function getTransfersPaginated(
        address borrower,
        uint256 offset,
        uint256 limit
    ) external view returns (VerifiedTransfer[] memory page) {
        VerifiedTransfer[] storage all = _transfersByBorrower[borrower];
        uint256 totalCount = all.length;

        if (offset >= totalCount || limit == 0) {
            return new VerifiedTransfer[](0);
        }

        uint256 end = offset + limit;
        if (end > totalCount) {
            end = totalCount;
        }

        uint256 resultSize = end - offset;
        page = new VerifiedTransfer[](resultSize);

        for (uint256 i = 0; i < resultSize; ++i) {
            page[i] = all[offset + i];
        }
    }

    /// @inheritdoc IRemittanceCreditRegistry
    /// @dev Computes stats over transfers with sourceTimestamp within the
    ///      last `lookbackWindowSeconds` (relative to the most recent
    ///      transfer). Optimized via backward iteration to ensure fixed gas costs.
    function getStats(address borrower, uint64 lookbackWindowSeconds)
        external
        view
        returns (RemittanceStats memory stats)
    {
        VerifiedTransfer[] storage all = _transfersByBorrower[borrower];
        uint256 n = all.length;
        if (n == 0) return stats;

        uint64 lastTs = all[n - 1].sourceTimestamp;
        uint64 windowStart = lookbackWindowSeconds >= lastTs ? 0 : lastTs - lookbackWindowSeconds;

        // Backward pass: Stop immediately when reaching transfers outside the lookback window
        uint256 count;
        uint256 total;
        uint256 startIndex = n;

        for (uint256 i = n; i > 0; --i) {
            VerifiedTransfer storage t = all[i - 1];
            if (t.sourceTimestamp < windowStart) {
                break;
            }
            count++;
            total += t.amount;
            startIndex = i - 1;
        }

        stats.transferCount = count;
        stats.totalAmount = total;

        if (count == 0) return stats;

        stats.firstTimestamp = all[startIndex].sourceTimestamp;
        stats.lastTimestamp = lastTs;

        if (count < 2) return stats;

        // Calculate intervals for in-window elements directly in range [startIndex, n - 1]
        uint256 numIntervals = count - 1;
        uint256[] memory intervals = new uint256[](numIntervals);
        uint256 sumIntervals;

        for (uint256 i = 0; i < numIntervals; ++i) {
            uint256 interval = all[startIndex + i + 1].sourceTimestamp - all[startIndex + i].sourceTimestamp;
            intervals[i] = interval;
            sumIntervals += interval;
        }

        uint256 meanInterval = sumIntervals / numIntervals;
        stats.avgIntervalSeconds = uint64(meanInterval);

        if (meanInterval == 0) {
            // All transfers landed in the same second — treat as perfectly regular
            stats.intervalConsistencyBps = 10000;
            return stats;
        }

        uint256 sumAbsDeviation;
        for (uint256 i = 0; i < numIntervals; ++i) {
            uint256 v = intervals[i];
            sumAbsDeviation += v > meanInterval ? v - meanInterval : meanInterval - v;
        }

        // Precision scaling: Multiply sum before dividing to prevent integer truncation errors
        uint256 deviationRatioBps = (sumAbsDeviation * 10000) / (numIntervals * meanInterval);
        stats.intervalConsistencyBps = deviationRatioBps >= 10000
            ? 0
            : uint16(10000 - deviationRatioBps);
    }
}
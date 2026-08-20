// SPDX-License-Identifier: MIT
// contracts/CreditDecisionEngine.sol
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRemittanceCreditRegistry} from "./interfaces/IRemittanceCreditRegistry.sol";

/// @title CreditDecisionEngine
/// @notice The autonomous decision "agent" for RemitCredit. It is
///         deliberately a deterministic rules engine rather than a
///         black-box model: every input it reads (verified remittance
///         stats) and every parameter it applies is on-chain and
///         inspectable, and it emits a machine- and human-readable
///         rationale with every decision. That's the point — a lending
///         decision an applicant can't audit is a worse decision, not a
///         more impressive one. What makes it an "agent" is that it acts
///         autonomously on freshly verified data with no human
///         underwriter in the loop, not that its internals are opaque.
contract CreditDecisionEngine is Ownable {
    struct Params {
        uint256 minTransferCount; // e.g. 3 — need a track record, not one lucky transfer
        uint256 minTotalAmount; // minimum verified inflow in the window to qualify at all
        uint16 minConsistencyBps; // below this, treat inflow as too irregular to size a line on
        uint16 creditMultiplierBps; // credit line = totalAmount * multiplier / 10000
        uint256 maxCreditLimit; // hard cap regardless of history
        uint64 lookbackWindowSeconds; // how far back the registry stats are computed over
        uint64 maxStalenessSeconds; // if lastTransfer older than this, eligibility drops
    }

    struct Decision {
        bool eligible;
        uint256 creditLimit;
        uint16 riskScoreBps; // 0 = highest risk, 10000 = lowest risk
        string rationale;
    }

    Params public params;

    event ParamsUpdated(Params params);
    event DecisionComputed(address indexed borrower, bool eligible, uint256 creditLimit, uint16 riskScoreBps);

    constructor(address initialOwner, Params memory initialParams) Ownable(initialOwner) {
        params = initialParams;
    }

    function setParams(Params calldata newParams) external onlyOwner {
        params = newParams;
        emit ParamsUpdated(newParams);
    }

    /// @notice Pure decision function — given a borrower's verified stats,
    ///         compute eligibility, credit limit, and risk score. Callable
    ///         as a view so off-chain services (worker, backend, a future
    ///         frontend) can preview a decision without spending gas.
    function decide(IRemittanceCreditRegistry.RemittanceStats memory stats)
        public
        view
        returns (Decision memory decision)
    {
        Params memory p = params;

        if (stats.transferCount < p.minTransferCount) {
            decision.rationale = "Not enough verified remittances yet to establish a pattern.";
            return decision;
        }
        if (stats.totalAmount < p.minTotalAmount) {
            decision.rationale = "Verified inflow below the minimum required to qualify.";
            return decision;
        }
        if (stats.intervalConsistencyBps < p.minConsistencyBps) {
            decision.rationale = "Remittances are too irregular to size a credit line on.";
            return decision;
        }
        bool isStale = block.timestamp > stats.lastTimestamp
            && (block.timestamp - stats.lastTimestamp) > p.maxStalenessSeconds;
        if (isStale) {
            decision.rationale = "Most recent verified remittance is too old.";
            return decision;
        }

        uint256 rawLimit = (stats.totalAmount * p.creditMultiplierBps) / 10000;
        decision.creditLimit = rawLimit > p.maxCreditLimit ? p.maxCreditLimit : rawLimit;
        decision.eligible = decision.creditLimit > 0;

        // Risk score blends interval consistency with a transfer-count
        // confidence factor that saturates at 2x the minimum count, so a
        // longer track record only helps up to a point of diminishing returns.
        uint256 countConfidenceBps = stats.transferCount >= p.minTransferCount * 2
            ? 10000
            : (stats.transferCount * 10000) / (p.minTransferCount * 2);
        decision.riskScoreBps = uint16((uint256(stats.intervalConsistencyBps) + countConfidenceBps) / 2);

        decision.rationale = "Eligible: credit limit sized from verified remittance inflow and regularity.";
    }

    /// @notice Convenience wrapper that pulls stats from the registry and
    ///         emits an event, so off-chain indexers can watch decisions
    ///         without re-reading registry state themselves. Does not
    ///         mutate any loan state — RemittanceMicroLoan is responsible
    ///         for applying the decision.
    function decideFromRegistry(IRemittanceCreditRegistry registry, address borrower)
        external
        returns (Decision memory decision)
    {
        IRemittanceCreditRegistry.RemittanceStats memory stats =
            registry.getStats(borrower, params.lookbackWindowSeconds);
        decision = decide(stats);
        emit DecisionComputed(borrower, decision.eligible, decision.creditLimit, decision.riskScoreBps);
    }
}

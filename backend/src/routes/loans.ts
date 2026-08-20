// backend/src/routes/loans.ts
import { Router } from "express";
import { z } from "zod";
import { isAddress } from "ethers";
import { asyncRoute, ApiError } from "../middleware/errorHandler";
import { getReadClient, requireRelayerClient } from "../services/contracts";
import { activityStore } from "../store";

export const loansRouter = Router();

const amountSchema = z.object({
  borrower: z.string().refine(isAddress, "borrower must be a valid address"),
  amount: z.string().regex(/^\d+$/, "amount must be a decimal string in the token's smallest unit"),
});

/// GET /loans/:borrower — current loan status (limit, outstanding, available).
loansRouter.get(
  "/:borrower",
  asyncRoute(async (req, res) => {
    const borrower = req.params.borrower;
    if (!isAddress(borrower)) throw new ApiError(400, "Invalid address");

    const client = getReadClient();
    const record = await client.getBorrower(borrower);
    if (!record.registered) throw new ApiError(404, "Borrower not registered");
    const available = await client.getAvailableCredit(borrower);

    res.json({
      borrower,
      creditLimit: record.creditLimit,
      outstandingPrincipal: record.outstandingPrincipal,
      availableCredit: available,
    });
  })
);

/// POST /loans/request — draw down a loan against the borrower's credit
/// limit. Requires a relayer for this custodial demo path; a production
/// frontend would instead have the borrower call requestLoan() directly
/// with their own wallet using shared/services/contractClient.ts.
loansRouter.post(
  "/request",
  asyncRoute(async (req, res) => {
    const { borrower, amount } = amountSchema.parse(req.body);

    const client = requireRelayerClient();
    const record = await client.getBorrower(borrower);
    if (!record.registered) throw new ApiError(404, "Borrower not registered");

    const tx = await client.requestLoan(amount);
    const receipt = await tx.wait();
    const updated = await client.getBorrower(borrower);

    activityStore.append({
      borrower,
      type: "loan_disbursed",
      data: { amount, newOutstanding: updated.outstandingPrincipal, txHash: receipt?.hash ?? tx.hash },
    });

    res.status(201).json({ borrower, amount, newOutstanding: updated.outstandingPrincipal, txHash: receipt?.hash ?? tx.hash });
  })
);

/// POST /loans/repay — repay some or all of an outstanding loan.
loansRouter.post(
  "/repay",
  asyncRoute(async (req, res) => {
    const { borrower, amount } = amountSchema.parse(req.body);

    const client = requireRelayerClient();
    const tx = await client.repay(amount);
    const receipt = await tx.wait();
    const updated = await client.getBorrower(borrower);

    activityStore.append({
      borrower,
      type: "loan_repaid",
      data: { amount, newOutstanding: updated.outstandingPrincipal, txHash: receipt?.hash ?? tx.hash },
    });

    res.json({ borrower, amount, newOutstanding: updated.outstandingPrincipal, txHash: receipt?.hash ?? tx.hash });
  })
);

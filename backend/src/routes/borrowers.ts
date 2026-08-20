// backend/src/routes/borrowers.ts
import { Router } from "express";
import { z } from "zod";
import { isAddress } from "ethers";
import { asyncRoute, ApiError } from "../middleware/errorHandler";
import { getReadClient, requireRelayerClient } from "../services/contracts";
import { activityStore } from "../store";

export const borrowersRouter = Router();

const registerSchema = z.object({
  borrower: z.string().refine(isAddress, "borrower must be a valid address"),
  declaredSenders: z.array(z.string().refine(isAddress, "each sender must be a valid address")).min(1),
});

const senderSchema = z.object({
  borrower: z.string().refine(isAddress, "borrower must be a valid address"),
  sender: z.string().refine(isAddress, "sender must be a valid address"),
});

/// POST /borrowers — register a borrower with one or more wallets their
/// verified remittances are allowed to come from (e.g. more than one
/// family member). Uses the relayer if configured; otherwise returns the
/// unsigned call data for a frontend to have the user sign with their own
/// wallet (non-custodial path).
borrowersRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const { borrower, declaredSenders } = registerSchema.parse(req.body);

    const client = requireRelayerClient();
    const tx = await client.registerBorrower(declaredSenders);
    const receipt = await tx.wait();

    activityStore.append({
      borrower,
      type: "borrower_registered",
      data: { declaredSenders, txHash: receipt?.hash ?? tx.hash },
    });

    res.status(201).json({ borrower, declaredSenders, txHash: receipt?.hash ?? tx.hash });
  })
);

/// POST /borrowers/senders — approve an additional remittance source for
/// an already-registered borrower (e.g. adding a second family member).
borrowersRouter.post(
  "/senders",
  asyncRoute(async (req, res) => {
    const { borrower, sender } = senderSchema.parse(req.body);

    const client = requireRelayerClient();
    const tx = await client.addDeclaredSender(sender);
    const receipt = await tx.wait();

    activityStore.append({
      borrower,
      type: "borrower_registered", // reuse the activity type; data disambiguates
      data: { action: "sender_added", sender, txHash: receipt?.hash ?? tx.hash },
    });

    res.status(201).json({ borrower, sender, txHash: receipt?.hash ?? tx.hash });
  })
);

/// DELETE /borrowers/senders — revoke a previously approved remittance
/// source. Past verified transfers from it stay in the credit history;
/// only future proofs from it are rejected afterward.
borrowersRouter.delete(
  "/senders",
  asyncRoute(async (req, res) => {
    const { borrower, sender } = senderSchema.parse(req.body);

    const client = requireRelayerClient();
    const tx = await client.removeDeclaredSender(sender);
    const receipt = await tx.wait();

    activityStore.append({
      borrower,
      type: "borrower_registered",
      data: { action: "sender_removed", sender, txHash: receipt?.hash ?? tx.hash },
    });

    res.json({ borrower, sender, txHash: receipt?.hash ?? tx.hash });
  })
);

/// GET /borrowers/:address/senders — currently approved remittance sources.
borrowersRouter.get(
  "/:address/senders",
  asyncRoute(async (req, res) => {
    const address = req.params.address;
    if (!isAddress(address)) throw new ApiError(400, "Invalid address");

    const client = getReadClient();
    const senders = await client.getDeclaredSenders(address);
    res.json({ borrower: address, declaredSenders: senders });
  })
);

/// GET /borrowers/:address — current on-chain borrower record.
borrowersRouter.get(
  "/:address",
  asyncRoute(async (req, res) => {
    const address = req.params.address;
    if (!isAddress(address)) throw new ApiError(400, "Invalid address");

    const client = getReadClient();
    const record = await client.getBorrower(address);
    if (!record.registered) throw new ApiError(404, "Borrower not registered");

    res.json(record);
  })
);

/// GET /borrowers/:address/activity — recent activity feed for a future
/// frontend timeline view.
borrowersRouter.get(
  "/:address/activity",
  asyncRoute(async (req, res) => {
    const address = req.params.address;
    if (!isAddress(address)) throw new ApiError(400, "Invalid address");
    res.json({ events: activityStore.listForBorrower(address) });
  })
);

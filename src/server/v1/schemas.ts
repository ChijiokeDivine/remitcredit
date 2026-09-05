// src/server/v1/schemas.ts
import { z } from "zod";
import { isAddress, isHexString } from "ethers";

export const addressSchema = z.string().refine((v) => isAddress(v), "Must be a valid EVM address");

export const txHashSchema = z
  .string()
  .refine((v) => isHexString(v, 32), "Must be a 32-byte hex transaction hash");

export const amountRawSchema = z
  .string()
  .regex(/^\d+$/, "Amount must be a non-negative integer decimal string (token smallest units)");

export const challengeBody = z.object({ address: addressSchema });
export const verifyBody = z.object({ message: z.string().min(20), signature: z.string().min(20) });
export const registerBody = z.object({ declaredSenders: z.array(addressSchema).min(1).max(20) });
export const addSenderBody = z.object({ address: addressSchema });
export const loanRequestBody = z.object({ amount: amountRawSchema });
export const repayBody = z.object({ amount: amountRawSchema });
export const verifyTransferBody = z.object({
  txHash: txHashSchema,
  borrower: addressSchema.optional(),
});
export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

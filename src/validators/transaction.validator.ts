import { z } from "zod";

import { TransactionType, PaymentMethod, TransactionStatus, ItemType } from "../db/schema.js";

// Transaction item schema
const transactionItemSchema = z.object({
  itemType: z.enum([ItemType.PRODUCT, ItemType.MENU]),
  id: z.string().uuid("Invalid item ID"),
  quantity: z.number().int().positive("Quantity must be positive"),
  expectedReturnAt: z.string().datetime().optional(), // For rentals
  notes: z.string().optional(), // For condition tracking
});

// Create transaction schema
export const createTransactionSchema = z.object({
  type: z.enum([TransactionType.POS, TransactionType.RENTAL]),
  tableId: z.string().uuid().optional(),
  customerName: z.string().trim().optional(),
  paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.QRIS, PaymentMethod.TRANSFER, PaymentMethod.OTHER]),
  paidAmount: z.number().nonnegative("Paid amount cannot be negative"),
  depositAmount: z.number().nonnegative("Deposit amount cannot be negative").optional(),
  items: z.array(transactionItemSchema).min(1, "At least one item is required"),
});

// Query schema for listing transactions
export const transactionQuerySchema = z.object({
  type: z.enum([TransactionType.POS, TransactionType.RENTAL]).optional(),
  status: z.enum([TransactionStatus.PENDING, TransactionStatus.PAID, TransactionStatus.CANCELLED, TransactionStatus.COMPLETED]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

// Update transaction status schema
export const updateTransactionStatusSchema = z.object({
  status: z.enum([TransactionStatus.PAID, TransactionStatus.CANCELLED, TransactionStatus.COMPLETED]),
});

// Pay transaction schema
export const payTransactionSchema = z.object({
  paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.QRIS, PaymentMethod.TRANSFER, PaymentMethod.OTHER]),
  paidAmount: z.number().nonnegative("Paid amount cannot be negative"),
});

import { z } from "zod";

import { ProductRentStatus } from "../db/schema.js";

export const productRentQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  status: z.enum([ProductRentStatus.ACTIVE, ProductRentStatus.RETURNED, ProductRentStatus.CANCELLED]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const returnRentSchema = z.object({
  returnedAt: z.string().datetime().optional(), // ISO datetime string, default to now
});

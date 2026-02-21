import { z } from "zod";

import { ProductSellStatus } from "../db/schema.js";

export const productSellQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  status: z.enum([ProductSellStatus.ACTIVE, ProductSellStatus.CANCELLED]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

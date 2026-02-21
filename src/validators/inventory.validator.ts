import { z } from "zod";

import { InventoryType, InventoryCondition, InventoryStatus, AdjustmentType } from "../db/schema.js";

// Inventory creation schema
export const inventorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  description: z.string().optional(),
  type: z.enum([InventoryType.ASSET, InventoryType.CONSUMABLE]),
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative").default(0),
  unit: z.string().trim().optional(),
  condition: z.enum([InventoryCondition.GOOD, InventoryCondition.DAMAGED, InventoryCondition.NEED_REPAIR, InventoryCondition.BROKEN]).optional(),
  status: z.enum([InventoryStatus.ACTIVE, InventoryStatus.INACTIVE, InventoryStatus.DISPOSED]).optional(),
  ownerName: z.string().trim().optional(),
  purchaseDate: z.string().datetime().optional(),
  purchasePrice: z.coerce.number().positive("Purchase price must be positive").optional(),
  location: z.string().trim().optional(),
  notes: z.string().optional(),
});

// Inventory update schema
export const inventoryUpdateSchema = inventorySchema.partial();

// Inventory query schema
export const inventoryQuerySchema = z.object({
  type: z.enum([InventoryType.ASSET, InventoryType.CONSUMABLE]).optional(),
  condition: z.enum([InventoryCondition.GOOD, InventoryCondition.DAMAGED, InventoryCondition.NEED_REPAIR, InventoryCondition.BROKEN]).optional(),
  status: z.enum([InventoryStatus.ACTIVE, InventoryStatus.INACTIVE, InventoryStatus.DISPOSED]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

// Stock adjustment schema
export const inventoryAdjustmentSchema = z.object({
  changeType: z.enum([AdjustmentType.ADD, AdjustmentType.REMOVE, AdjustmentType.CORRECTION]),
  amount: z.number().int().positive("Amount must be positive"),
  reason: z.string().min(1, "Reason is required").trim(),
});

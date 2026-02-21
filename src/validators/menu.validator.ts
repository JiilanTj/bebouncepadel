import { z } from "zod";

export const menuSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be positive"),
  costPrice: z.coerce.number().positive("Cost price must be positive").optional(),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative").optional(),
  sku: z.string().optional(),
  menuCategoryId: z.string().uuid("Invalid category ID"),
});

export const menuUpdateSchema = menuSchema.partial().extend({
  isAvailable: z.coerce.boolean().optional(),
});

export const menuQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  available: z.enum(["true", "false"]).optional(),
  active: z.enum(["true", "false"]).optional(),
});

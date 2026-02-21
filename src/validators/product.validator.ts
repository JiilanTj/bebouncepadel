import { z } from "zod";
import { ProductType } from "../db/schema.js";

export const productSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().optional(),
    price: z.coerce.number().positive("Price must be positive"),
    costPrice: z.coerce.number().positive("Cost price must be positive").optional(),
    stock: z.coerce.number().int().min(0, "Stock cannot be negative"),
    sku: z.string().optional(),
    type: z.nativeEnum(ProductType),
    productCategoryId: z.string().uuid("Invalid category ID"),
});

export const productUpdateSchema = productSchema.partial().extend({
    // Allow updating individual fields, but validation rules still apply if field is present
});

export const productQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    search: z.string().optional(),
    type: z.nativeEnum(ProductType).optional(),
    categoryId: z.string().uuid().optional(),
    active: z.enum(["true", "false"]).optional(),
});

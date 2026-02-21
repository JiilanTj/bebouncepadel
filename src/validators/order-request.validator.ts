import { z } from "zod";

// Validate table code
export const validateTableSchema = z.object({
    code: z.string().min(1, "Table code is required"),
});

// Order request item schema
export const orderRequestItemSchema = z.object({
    menuId: z.string().uuid("Invalid menu ID"),
    quantity: z.number().int().positive("Quantity must be positive"),
    unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
    subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid subtotal format"),
    notes: z.string().optional(),
});

// Create order request schema
export const createOrderRequestSchema = z.object({
    tableCode: z.string().min(1, "Table code is required"),
    customerName: z.string().min(1, "Customer name is required"),
    items: z.array(orderRequestItemSchema).min(1, "At least one item is required"),
    notes: z.string().optional(),
});

// Update order request status schema
export const updateOrderRequestStatusSchema = z.object({
    status: z.enum(["APPROVED", "PREPARING", "SERVED", "REJECTED", "CANCELLED"]),
    rejectedReason: z.string().optional(),
});

export type ValidateTableInput = z.infer<typeof validateTableSchema>;
export type CreateOrderRequestInput = z.infer<typeof createOrderRequestSchema>;
export type UpdateOrderRequestStatusInput = z.infer<typeof updateOrderRequestStatusSchema>;

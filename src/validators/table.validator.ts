import { z } from "zod";
import { TableStatus } from "../db/schema.js";

// Phone validation regex (Indonesian format)
const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,9}$/;

export const tableSchema = z.object({
  code: z.string().min(1, "Code is required").trim().toUpperCase(),
  name: z.string().trim().optional(),
  capacity: z.coerce.number().int().min(0, "Capacity cannot be negative").optional(),
  location: z.string().trim().optional(),
});

export const tableUpdateSchema = z.object({
  name: z.string().trim().optional(),
  capacity: z.coerce.number().int().min(0, "Capacity cannot be negative").optional(),
  location: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const tableStatusSchema = z.object({
  status: z.enum([TableStatus.EMPTY, TableStatus.OCCUPIED]),
  customerName: z.string().trim().optional(),
  customerPhone: z
    .string()
    .trim()
    .refine((val) => {
      if (!val) return true; // Optional
      return phoneRegex.test(val);
    }, "Invalid phone number format")
    .optional(),
});

export const tableQuerySchema = z.object({
  status: z.enum([TableStatus.EMPTY, TableStatus.OCCUPIED]).optional(),
  active: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});

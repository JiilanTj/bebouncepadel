import { z } from "zod";

export const createBookingSchema = z.object({
    courtId: z.string().uuid("Invalid court ID"),
    customerName: z.string().min(1, "Customer name is required"),
    customerPhone: z.string().min(1, "Customer phone is required"),
    customerEmail: z.string().email("Invalid email").optional().nullable(),
    startTime: z.string().datetime({ message: "Invalid start time format" }),
    endTime: z.string().datetime({ message: "Invalid end time format" }),
    paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]).optional().default("UNPAID"),
    paidAmount: z.number().min(0, "Paid amount cannot be negative").optional().default(0),
    notes: z.string().optional().nullable(),
}).refine((data) => {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    return end > start;
}, {
    message: "End time must be after start time",
    path: ["endTime"],
}).refine((data) => {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    const durationMs = end.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    return durationHours >= 1;
}, {
    message: "Minimum duration is 1 hour",
    path: ["endTime"],
});

export const updateBookingStatusSchema = z.object({
    status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

import { z } from "zod";

import { CourtType, CourtStatus } from "../db/schema";

export const createCourtSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    type: z.enum([CourtType.INDOOR, CourtType.OUTDOOR]),
    surface: z.string().min(2, "Surface must be at least 2 characters"),
    status: z
        .enum([CourtStatus.ACTIVE, CourtStatus.MAINTENANCE, CourtStatus.INACTIVE])
        .default(CourtStatus.ACTIVE),
    price_per_hour: z.coerce
        .number()
        .positive("Price per hour must be positive"),
    ayo_field_id: z.string().optional(),
    image: z.instanceof(File, { message: "Image is required" }),
});

export const updateCourtSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    type: z.enum([CourtType.INDOOR, CourtType.OUTDOOR]).optional(),
    surface: z.string().min(2, "Surface must be at least 2 characters").optional(),
    status: z
        .enum([CourtStatus.ACTIVE, CourtStatus.MAINTENANCE, CourtStatus.INACTIVE])
        .optional(),
    price_per_hour: z.coerce
        .number()
        .positive("Price per hour must be positive")
        .optional(),
    ayo_field_id: z.string().optional(),
    image: z.instanceof(File).optional(),
    is_visible: z.coerce.boolean().optional(),
});

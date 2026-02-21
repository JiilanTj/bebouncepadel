import { z } from "zod";

export const createFacilitySchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().optional(),
    icon: z.string().optional(),
    display_order: z.coerce.number().min(0, "Display order must be non-negative").default(0),
    is_visible: z.coerce.boolean().default(true),
});

export const updateFacilitySchema = createFacilitySchema.partial().extend({
    is_active: z.coerce.boolean().optional(),
});

import { type Context } from "hono";
import { eq, and, ne, ilike } from "drizzle-orm";

import { db } from "../db";
import { courts, CourtStatus } from "../db/schema";
import { success, error } from "../lib";
import { uploadImage, deleteImage } from "../utils/file-upload";
import { createCourtSchema, updateCourtSchema } from "../validators/courts.validator";
import { generateSlug } from "../lib/slug";

export const getAllCourts = async (c: Context) => {
    const { type, status, search } = c.req.query();
    const user = c.get("user");
    const isAdmin = user?.role === "OWNER" || user?.role === "ADMIN";

    const conditions = [];

    if (!isAdmin) {
        conditions.push(eq(courts.isVisible, true));
        conditions.push(ne(courts.status, CourtStatus.INACTIVE));
    }

    if (type) {
        conditions.push(eq(courts.type, type as "INDOOR" | "OUTDOOR"));
    }

    if (status) {
        conditions.push(eq(courts.status, status as "ACTIVE" | "MAINTENANCE" | "INACTIVE"));
    }

    if (search) {
        // Simple search by name
        conditions.push(ilike(courts.name, `%${search}%`));
    }

    const data = await db
        .select()
        .from(courts)
        .where(and(...conditions))
        .orderBy(courts.createdAt);

    return success(c, data);
};

export const getCourtById = async (c: Context) => {
    const id = c.req.param("id");
    const user = c.get("user");
    const isAdmin = user?.role === "OWNER" || user?.role === "ADMIN";

    const [court] = await db.select().from(courts).where(eq(courts.id, id));

    if (!court) {
        return error(c, "Court not found", 404);
    }

    if (!isAdmin && (court.status === CourtStatus.INACTIVE || !court.isVisible)) {
        return error(c, "Court not found", 404);
    }

    return success(c, court);
};

export const createCourt = async (c: Context) => {
    const body = await c.req.parseBody();

    // Validate
    const validation = createCourtSchema.safeParse(body);
    if (!validation.success) {
        return error(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const data = validation.data;

    // Check slug uniqueness
    let slug = generateSlug(data.name);
    const existing = await db.select().from(courts).where(eq(courts.slug, slug));
    if (existing.length > 0) {
        slug = `${slug}-${Date.now()}`;
    }

    // Upload image
    const image = data.image as File;
    const buffer = Buffer.from(await image.arrayBuffer());
    const { key, url } = await uploadImage(buffer, image.name, image.type);

    // Insert
    const [newCourt] = await db
        .insert(courts)
        .values({
            name: data.name,
            slug,
            type: data.type,
            surface: data.surface,
            status: data.status,
            pricePerHour: data.price_per_hour.toString(),
            ayoFieldId: data.ayo_field_id,
            imageKey: key,
            imageUrl: url,
        })
        .returning();

    return success(c, newCourt, "Court created successfully", 201);
};

export const updateCourt = async (c: Context) => {
    const id = c.req.param("id");
    const body = await c.req.parseBody();

    const [existingCourt] = await db.select().from(courts).where(eq(courts.id, id));
    if (!existingCourt) {
        return error(c, "Court not found", 404);
    }

    // Validate
    const validation = updateCourtSchema.safeParse(body);
    if (!validation.success) {
        return error(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const data = validation.data;

    let newSlug: string | undefined;
    if (data.name && data.name !== existingCourt.name) {
        newSlug = generateSlug(data.name);
        // check uniqueness excluding self
        const existing = await db.select().from(courts).where(and(eq(courts.slug, newSlug), ne(courts.id, id)));
        if (existing.length > 0) {
            newSlug = `${newSlug}-${Date.now()}`;
        }
    }

    // Handle Image
    let imageKey: string | undefined;
    let imageUrl: string | undefined;
    if (data.image && data.image instanceof File) {
        // Delete old
        if (existingCourt.imageKey) {
            await deleteImage(existingCourt.imageKey).catch((err: unknown) => console.error("Failed to delete old image", err));
        }

        // Upload new
        const buffer = Buffer.from(await data.image.arrayBuffer());
        const uploadResult = await uploadImage(buffer, data.image.name, data.image.type);
        imageKey = uploadResult.key;
        imageUrl = uploadResult.url;
    }

    const updateValues: Record<string, unknown> = {
        name: data.name,
        type: data.type,
        surface: data.surface,
        status: data.status,
        ayoFieldId: data.ayo_field_id,
        isVisible: data.is_visible,
        pricePerHour: data.price_per_hour?.toString(),
        slug: newSlug,
        imageKey,
        imageUrl,
        updatedAt: new Date(),
    };

    // Remove undefined values
    Object.keys(updateValues).forEach((key) => {
        if (updateValues[key] === undefined) {
            delete updateValues[key];
        }
    });

    const [updated] = await db
        .update(courts)
        .set(updateValues)
        .where(eq(courts.id, id))
        .returning();

    return success(c, updated, "Court updated successfully");
};

export const deleteCourt = async (c: Context) => {
    const id = c.req.param("id");

    const [existing] = await db.select().from(courts).where(eq(courts.id, id));
    if (!existing) return error(c, "Court not found", 404);

    const [deleted] = await db
        .update(courts)
        .set({
            status: CourtStatus.INACTIVE,
            isVisible: false,
            updatedAt: new Date()
        })
        .where(eq(courts.id, id))
        .returning();

    return success(c, deleted, "Court deleted (soft) successfully");
};

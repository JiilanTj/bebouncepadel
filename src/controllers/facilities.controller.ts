import { eq, and, asc } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db";
import { facilities } from "../db/schema";
import { success, error } from "../lib/response";
import { uploadImage, deleteImage } from "../utils/file-upload";
import { createFacilitySchema, updateFacilitySchema } from "../validators/facilities.validator";
import { generateSlug } from "../lib/slug";

// GET /facilities (Public)
export const getAllFacilities = async (c: Context) => {
    try {
        const data = await db.query.facilities.findMany({
            where: and(
                eq(facilities.isVisible, true),
                eq(facilities.isActive, true)
            ),
            orderBy: [asc(facilities.displayOrder)],
        });

        return success(c, data, "Facilities fetched successfully");
    } catch (e) {
        console.error(e);
        return error(c, "Failed to fetch facilities", 500);
    }
};

// GET /facilities/:id (Protected)
export const getFacilityById = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const facility = await db.query.facilities.findFirst({
            where: eq(facilities.id, id),
        });

        if (!facility) {
            return error(c, "Facility not found", 404);
        }

        return success(c, facility, "Facility fetched successfully");
    } catch (e) {
        console.error(e);
        return error(c, "Failed to fetch facility", 500);
    }
};

// POST /facilities (Owner/Admin)
export const createFacility = async (c: Context) => {
    try {
        const formData = await c.req.parseBody();
        const image = formData["image"] instanceof File ? formData["image"] : undefined;

        // Validate input excluding image first
        const validation = createFacilitySchema.safeParse(formData);
        if (!validation.success) {
            return error(c, "Validation error", 400, validation.error.flatten().fieldErrors);
        }

        if (!image) {
            return error(c, "Image is required", 400);
        }

        // Generate slug
        let slug = generateSlug(validation.data.name);
        const slugExists = await db.query.facilities.findFirst({
            where: eq(facilities.slug, slug),
        });
        if (slugExists) {
            slug = `${slug}-${Date.now()}`; // fast unique slug
        }

        // Upload image
        const buffer = await image.arrayBuffer();
        const uploadResult = await uploadImage(
            Buffer.from(buffer),
            image.name,
            image.type
        );

        // Insert
        const [newFacility] = await db.insert(facilities).values({
            ...validation.data,
            slug,
            imageKey: uploadResult.key,
            imageUrl: uploadResult.url,
        }).returning();

        return success(c, newFacility, "Facility created successfully", 201);
    } catch (e) {
        console.error(e);
        return error(c, "Failed to create facility", 500);
    }
};

// PUT /facilities/:id (Owner/Admin)
export const updateFacility = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const formData = await c.req.parseBody();
        const image = formData["image"] instanceof File ? formData["image"] : undefined;

        const validation = updateFacilitySchema.safeParse(formData);
        if (!validation.success) {
            return error(c, "Validation error", 400, validation.error.flatten().fieldErrors);
        }

        const existingFacility = await db.query.facilities.findFirst({
            where: eq(facilities.id, id),
        });

        if (!existingFacility) {
            return error(c, "Facility not found", 404);
        }

        let imageUpdate = {};
        if (image) {
            // Delete old image
            if (existingFacility.imageKey) {
                await deleteImage(existingFacility.imageKey);
            }

            // Upload new
            const buffer = await image.arrayBuffer();
            const uploadResult = await uploadImage(
                Buffer.from(buffer),
                image.name,
                image.type
            );

            imageUpdate = {
                imageKey: uploadResult.key,
                imageUrl: uploadResult.url
            };
        }

        // Handle slug update if name changed
        let slugUpdate = {};
        if (validation.data.name && validation.data.name !== existingFacility.name) {
            let newSlug = generateSlug(validation.data.name);
            const slugExists = await db.query.facilities.findFirst({
                where: eq(facilities.slug, newSlug),
            });
            if (slugExists) {
                newSlug = `${newSlug}-${Date.now()}`;
            }
            slugUpdate = { slug: newSlug };
        }

        const [updatedFacility] = await db.update(facilities).set({
            ...validation.data,
            ...imageUpdate,
            ...slugUpdate,
            updatedAt: new Date(),
        }).where(eq(facilities.id, id)).returning();

        return success(c, updatedFacility, "Facility updated successfully");
    } catch (e) {
        console.error(e);
        return error(c, "Failed to update facility", 500);
    }
};

// DELETE /facilities/:id (Owner/Admin) - Soft Delete
export const deleteFacility = async (c: Context) => {
    try {
        const id = c.req.param("id");

        const existing = await db.query.facilities.findFirst({
            where: eq(facilities.id, id),
        });
        if (!existing) {
            return error(c, "Facility not found", 404);
        }

        const [deleted] = await db.update(facilities).set({
            isActive: false,
            updatedAt: new Date(),
        }).where(eq(facilities.id, id)).returning();

        return success(c, deleted, "Facility deleted successfully");
    } catch (e) {
        console.error(e);
        return error(c, "Failed to delete facility", 500);
    }
};

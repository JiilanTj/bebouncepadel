import { eq } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db";
import { settings } from "../db/schema";
import { success, error } from "../lib/response";
import { uploadImage, deleteImage } from "../utils/file-upload";

export const getSettings = async (c: Context) => {
    try {
        const allSettings = await db.select().from(settings).limit(1);

        if (allSettings.length === 0) {
            // Create default settings if not exists
            const newSettings = await db.insert(settings).values({}).returning();
            return success(c, newSettings[0], "Settings fetched successfully");
        }

        return success(c, allSettings[0], "Settings fetched successfully");
    } catch (e) {
        console.error(e);
        return error(c, "Failed to fetch settings", 500);
    }
};

export const updateSettings = async (c: Context) => {
    try {
        const formData = await c.req.parseBody();
        const heroImage = formData["heroImage"] instanceof File ? formData["heroImage"] : undefined;

        // Check if settings exist
        const allSettings = await db.select().from(settings).limit(1);
        let currentSettings = allSettings[0];

        if (!currentSettings) {
            // Create default first if not exists
            const newSettings = await db.insert(settings).values({}).returning();
            currentSettings = newSettings[0];
        }

        if (!currentSettings) {
            return error(c, "Failed to load settings", 500);
        }

        // Handle Image Upload
        let imageUpdate = {};
        if (heroImage) {
            if (currentSettings.heroImageKey) {
                await deleteImage(currentSettings.heroImageKey);
            }
            const buffer = await heroImage.arrayBuffer();
            const uploadResult = await uploadImage(
                Buffer.from(buffer),
                heroImage.name,
                heroImage.type
            );
            imageUpdate = {
                heroImageKey: uploadResult.key,
                heroImageUrl: uploadResult.url
            };
        }

        // Prepare update data
        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
            ...imageUpdate,
        };

        // Helper to safely get string or null from formData
        const getString = (key: string) => {
            const val = formData[key];
            if (typeof val === 'string') return val;
            return null; // Or undefined if we don't want to update? 
            // For settings, empty string usually means clear it, so we accept empty string.
            // But invalid type should probably be ignored or null.
            // Let's assume if it's sent, update it.
        }

        if (formData["businessName"] !== undefined) updateData.businessName = getString("businessName");
        if (formData["businessEmail"] !== undefined) updateData.businessEmail = getString("businessEmail");
        if (formData["businessPhone"] !== undefined) updateData.businessPhone = getString("businessPhone");
        if (formData["businessAddress"] !== undefined) updateData.businessAddress = getString("businessAddress");
        if (formData["businessMapLink"] !== undefined) updateData.businessMapLink = getString("businessMapLink");
        if (formData["facebookUrl"] !== undefined) updateData.facebookUrl = getString("facebookUrl");
        if (formData["instagramUrl"] !== undefined) updateData.instagramUrl = getString("instagramUrl");
        if (formData["tiktokUrl"] !== undefined) updateData.tiktokUrl = getString("tiktokUrl");
        if (formData["twitterUrl"] !== undefined) updateData.twitterUrl = getString("twitterUrl");
        if (formData["weekdayOpen"] !== undefined) updateData.weekdayOpen = getString("weekdayOpen");
        if (formData["weekdayClose"] !== undefined) updateData.weekdayClose = getString("weekdayClose");
        if (formData["weekendOpen"] !== undefined) updateData.weekendOpen = getString("weekendOpen");
        if (formData["weekendClose"] !== undefined) updateData.weekendClose = getString("weekendClose");
        // heroImageUrl text input might still be sent if user didn't upload file? 
        // The requirement is to switch to file upload. We should probably ignore the manual URL input unless we want to support both.
        // Let's prioritize file upload. If no file, we preserve existing unless specifically cleared (which logic here does by not adding to updateData).
        // If we want to allow manual clearing or URL setting, we'd need logic. simpler to rely on upload.

        const updatedSettings = await db
            .update(settings)
            .set(updateData)
            .where(eq(settings.id, currentSettings.id))
            .returning();

        return success(c, updatedSettings[0], "Settings updated successfully");
    } catch (e) {
        console.error(e);
        return error(c, "Failed to update settings", 500);
    }
};

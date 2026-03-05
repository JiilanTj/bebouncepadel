import { type Context } from "hono";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { courts } from "../db/schema";
import { success, error } from "../lib";
import { logger } from "../lib/logger";
import { getVenueFields, type AyoField } from "../lib/ayo-client";

interface SyncResult {
    synced: { courtId: string; courtName: string; ayoFieldId: number; ayoFieldName: string }[];
    unmatched_ayo_fields: { id: number; name: string }[];
    unmatched_courts: { id: string; name: string }[];
    total_ayo_fields: number;
    total_internal_courts: number;
}

/**
 * GET /courts/ayo-fields
 * 
 * Fetches the raw list of venue fields directly from the Ayo.co.id API.
 */
export const getAyoFieldsList = async (c: Context) => {
    try {
        logger.info("Fetching Ayo venue fields for mapping...");
        const ayoFields = await getVenueFields();
        return success(c, ayoFields, "Successfully fetched Ayo venue fields");
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        logger.error({ err }, "Failed to fetch Ayo venue fields");
        return error(c, `Failed to fetch venue fields from Ayo API: ${errorMessage}`, 502);
    }
};

/**
 * POST /courts/sync-ayo
 *
 * Synchronizes internal courts with Ayo.co.id venue fields.
 * Matches by name (case-insensitive) and updates `ayo_field_id` in the courts table.
 */
export const syncCourtsWithAyo = async (c: Context) => {
    try {
        // 1. Fetch fields from Ayo API
        logger.info("Starting court sync with Ayo.co.id...");
        let ayoFields: AyoField[];

        try {
            ayoFields = await getVenueFields();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            logger.error({ err }, "Failed to fetch Ayo venue fields");
            return error(c, `Failed to connect to Ayo.co.id API: ${errorMessage}`, 502);
        }

        logger.info({ count: ayoFields.length }, "Fetched Ayo venue fields");

        // 2. Fetch all internal courts
        const internalCourts = await db.select().from(courts);

        logger.info({ count: internalCourts.length }, "Fetched internal courts");

        // 3. Match by name (case-insensitive)
        const result: SyncResult = {
            synced: [],
            unmatched_ayo_fields: [],
            unmatched_courts: [],
            total_ayo_fields: ayoFields.length,
            total_internal_courts: internalCourts.length,
        };

        const matchedAyoFieldIds = new Set<number>();
        const matchedCourtIds = new Set<string>();

        for (const ayoField of ayoFields) {
            const ayoName = (ayoField.name || "").toLowerCase().trim();

            // Try to find a matching internal court
            const matched = internalCourts.find((court) => {
                const courtName = (court.name || "").toLowerCase().trim();
                return courtName === ayoName;
            });

            if (matched) {
                // Update ayo_field_id in the database
                await db
                    .update(courts)
                    .set({
                        ayoFieldId: String(ayoField.id),
                        updatedAt: new Date(),
                    })
                    .where(eq(courts.id, matched.id));

                result.synced.push({
                    courtId: matched.id,
                    courtName: matched.name,
                    ayoFieldId: ayoField.id,
                    ayoFieldName: ayoField.name,
                });

                matchedAyoFieldIds.add(ayoField.id);
                matchedCourtIds.add(matched.id);
            }
        }

        // Collect unmatched
        for (const ayoField of ayoFields) {
            if (!matchedAyoFieldIds.has(ayoField.id)) {
                result.unmatched_ayo_fields.push({
                    id: ayoField.id,
                    name: ayoField.name,
                });
            }
        }

        for (const court of internalCourts) {
            if (!matchedCourtIds.has(court.id)) {
                result.unmatched_courts.push({
                    id: court.id,
                    name: court.name,
                });
            }
        }

        logger.info(
            {
                synced: result.synced.length,
                unmatchedAyo: result.unmatched_ayo_fields.length,
                unmatchedCourts: result.unmatched_courts.length,
            },
            "Court sync completed"
        );

        return success(c, result, `Sync completed: ${result.synced.length} courts matched`);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        logger.error({ err }, "Failed to sync courts with Ayo");
        return error(c, `Failed to sync courts with Ayo: ${errorMessage}`, 500);
    }
};

/**
 * PATCH /courts/:id/map-ayo
 *
 * Manually maps an internal court to an Ayo.co.id venue field.
 * Body: { ayoFieldId: number | string }
 */
export const mapAyoField = async (c: Context) => {
    try {
        const courtId = c.req.param("id");
        const body = await c.req.json();

        if (!body.ayoFieldId) {
            return error(c, "ayoFieldId is required in the request body", 400);
        }

        // Validate court exists
        const existingCourt = await db.select().from(courts).where(eq(courts.id, courtId));
        if (existingCourt.length === 0) {
            return error(c, "Court not found", 404);
        }

        // Update ayoFieldId
        const [updatedCourt] = await db
            .update(courts)
            .set({
                ayoFieldId: String(body.ayoFieldId),
                updatedAt: new Date()
            })
            .where(eq(courts.id, courtId))
            .returning();

        logger.info({ courtId, ayoFieldId: body.ayoFieldId }, "Manually mapped court to Ayo field");

        return success(c, updatedCourt, "Successfully mapped court to Ayo field");
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        logger.error({ err }, "Failed to manually map court");
        return error(c, `Failed to map court: ${errorMessage}`, 500);
    }
};

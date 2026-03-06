import { type Context } from "hono";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { courts, bookings } from "../db/schema";
import { success, error } from "../lib";
import { logger } from "../lib/logger";
import { getVenueFields, getBookings, type AyoField } from "../lib/ayo-client";

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

/**
 * POST /bookings/sync-ayo
 *
 * Synchronize bookings from Ayo.co.id to the internal bookings table.
 * Defaults to fetching bookings for the next 30 days.
 */
export const syncBookingsWithAyo = async (c: Context) => {
    try {
        const query = c.req.query();

        // Setup Date Filters for Ayo API
        const filterParams: Record<string, string> = {};
        if (query.start_date) filterParams.start_date = query.start_date;
        if (query.end_date) filterParams.end_date = query.end_date;

        logger.info({ filters: filterParams }, "Starting Bookings sync from Ayo");

        // 1. Fetch bookings from Ayo API
        const ayoBookings = await getBookings(filterParams) as any[];

        // 2. Fetch mapping of ayo_field_id -> internal court_id
        const internalCourts = await db.select().from(courts);
        const courtMap: Record<string, string> = {};
        for (const court of internalCourts) {
            if (court.ayoFieldId) {
                courtMap[court.ayoFieldId] = court.id;
            }
        }

        let newInserted = 0;
        let existingUpdated = 0;
        let skippedUnmapped = 0;

        // 3. Process each booking
        for (const ayoBooking of ayoBookings) {
            const internalCourtId = courtMap[String(ayoBooking.field_id)];
            if (!internalCourtId) {
                skippedUnmapped++;
                continue; // Can't map this booking because the court isn't mapped
            }

            // Create timestamp bounds
            const startTimeStr = `${ayoBooking.date}T${ayoBooking.start_time}+07:00`; // Assuming WIB timezone
            const endTimeStr = `${ayoBooking.date}T${ayoBooking.end_time}+07:00`;
            const startTime = new Date(startTimeStr);
            const endTime = new Date(endTimeStr);

            const durationMs = endTime.getTime() - startTime.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);

            // Determine Status
            let bookingStatus = "PENDING";
            if (ayoBooking.status === "SUCCESS") bookingStatus = "CONFIRMED";
            else if (ayoBooking.status === "FINISHED") bookingStatus = "COMPLETED";
            else if (ayoBooking.status === "CANCELLED") bookingStatus = "CANCELLED";
            else if (ayoBooking.status === "PENDING") bookingStatus = "PENDING";

            // Determine Payment Status 
            let paymentStatus = "UNPAID";
            if (ayoBooking.status === "SUCCESS" || ayoBooking.status === "FINISHED") {
                paymentStatus = "PAID";
            }

            // Check if exists
            const existingBooking = await db
                .select()
                .from(bookings)
                .where(eq(bookings.bookingNumber, String(ayoBooking.booking_id)));

            if (existingBooking.length > 0) {
                // Update
                await db
                    .update(bookings)
                    .set({
                        bookingStatus: bookingStatus as any,
                        paymentStatus: paymentStatus as any,
                        updatedAt: new Date()
                    })
                    .where(eq(bookings.id, existingBooking[0]!.id));
                existingUpdated++;
            } else {
                // Insert
                await db.insert(bookings).values({
                    bookingNumber: String(ayoBooking.booking_id),
                    courtId: internalCourtId,
                    customerName: String(ayoBooking.booker_name || "Ayo Guest"),
                    customerPhone: String(ayoBooking.booker_phone || "-"),
                    customerEmail: ayoBooking.booker_email || null,
                    startTime,
                    endTime,
                    durationHours: String(durationHours),
                    pricePerHour: String(Number(ayoBooking.total_price) / durationHours || 0),
                    totalPrice: String(ayoBooking.total_price || 0),
                    bookingStatus: bookingStatus as any,
                    paymentStatus: paymentStatus as any,
                    notes: `Source: Ayo.co.id (${ayoBooking.booking_source || "N/A"})`,
                });
                newInserted++;
            }
        }

        const resultStr = `Sync completed. Inserted: ${newInserted}, Updated: ${existingUpdated}, Skipped (Unmapped Court): ${skippedUnmapped}`;
        logger.info({ newInserted, existingUpdated, skippedUnmapped }, "Booking sync finished");

        return success(c, { newInserted, existingUpdated, skippedUnmapped }, resultStr);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        logger.error({ err }, "Failed to sync bookings with Ayo");
        return error(c, `Failed to sync bookings with Ayo: ${errorMessage}`, 500);
    }
};

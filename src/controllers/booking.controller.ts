import { eq, and, gte, lte, sql, desc, ne, lt, gt } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import {
    bookings,
    courts,
    transactions,
    transactionItems,
    BookingStatus,
    PaymentStatus,
    TransactionType,
    TransactionStatus,
    ItemType,
    NotificationType,
} from "../db/schema.js";
import { createBookingSchema } from "../validators/booking.validator.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";
import { createNotification } from "./notification.controller.js";

// Generate booking number: BK-YYYYMMDD-XXXX
async function generateBookingNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");

    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(
            and(
                gte(bookings.createdAt, startOfDay),
                lte(bookings.createdAt, endOfDay)
            )
        );

    const count = (countResult[0]?.count ?? 0) + 1;
    const sequence = count.toString().padStart(4, "0");

    return `BK-${dateStr}-${sequence}`;
}

// Generate invoice number (Copied from transaction controller for consistency)
async function generateInvoiceNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(
            and(
                gte(transactions.createdAt, startOfDay),
                lte(transactions.createdAt, endOfDay)
            )
        );

    const count = (countResult[0]?.count ?? 0) + 1;
    const sequence = count.toString().padStart(4, "0");

    return `INV-${dateStr}-${sequence}`;
}

// POST /bookings
export async function createBooking(c: Context) {
    try {
        const body = await c.req.json();
        const validation = createBookingSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
        }

        const {
            courtId,
            customerName,
            customerPhone,
            customerEmail,
            startTime,
            endTime,
            paymentStatus: initialPaymentStatus,
            paidAmount,
            notes,
        } = validation.data;

        const user = c.get("user"); // Might be null for guest

        // Fetch court
        const court = await db.query.courts.findFirst({
            where: eq(courts.id, courtId),
        });

        if (!court) {
            return errorResponse(c, "Court not found", 404);
        }

        if (court.status !== "ACTIVE") {
            return errorResponse(c, "Court is not available for booking", 400);
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        // Check availability (overlap)
        const existingOverlaps = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.courtId, courtId),
                ne(bookings.bookingStatus, BookingStatus.CANCELLED),
                and(
                    lt(bookings.startTime, end),
                    gt(bookings.endTime, start)
                )
            ),
        });

        if (existingOverlaps) {
            return errorResponse(c, "Time slot is already booked", 409);
        }

        // Calculate duration & price
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const pricePerHour = parseFloat(court.pricePerHour);
        const totalPrice = durationHours * pricePerHour;

        // Determine status
        let bookingStatus: BookingStatus = BookingStatus.PENDING;
        let paymentStatus: PaymentStatus = initialPaymentStatus || PaymentStatus.UNPAID;

        if (paidAmount >= totalPrice) {
            paymentStatus = PaymentStatus.PAID;
            bookingStatus = BookingStatus.CONFIRMED;
        } else if (paidAmount > 0) {
            paymentStatus = PaymentStatus.PARTIAL;
        }

        const bookingNumber = await generateBookingNumber();

        const result = await db.transaction(async (tx) => {
            // 1. Create Transaction first (needed for booking link)
            const invoiceNumber = await generateInvoiceNumber();

            const [transaction] = await tx.insert(transactions).values({
                invoiceNumber,
                type: TransactionType.BOOKING,
                customerName,
                totalAmount: totalPrice.toFixed(2),
                paidAmount: (paidAmount || 0).toFixed(2),
                changeAmount: Math.max(0, (paidAmount || 0) - totalPrice).toFixed(2),
                paymentMethod: "CASH", // Default
                status: paidAmount >= totalPrice ? TransactionStatus.PAID : TransactionStatus.PENDING,
                createdBy: user?.userId || null,
            }).returning();

            // 2. Insert Booking
            const [booking] = await tx.insert(bookings).values({
                bookingNumber,
                courtId,
                customerName,
                customerPhone,
                customerEmail,
                startTime: start,
                endTime: end,
                durationHours: durationHours.toFixed(2),
                pricePerHour: pricePerHour.toFixed(2),
                totalPrice: totalPrice.toFixed(2),
                paymentStatus,
                bookingStatus,
                transactionId: transaction!.id,
                notes,
                createdBy: user?.userId || null,
            }).returning();

            // (Optional) Add dummy transaction item for breakdown
            await tx.insert(transactionItems).values({
                transactionId: transaction!.id,
                itemType: ItemType.BOOKING,
                productId: null,
                quantity: 1,
                unitPrice: totalPrice.toFixed(2),
                subtotal: totalPrice.toFixed(2),
                notes: `Court Booking: ${court.name}`,
            });

            return { booking, transaction };
        });

        // Create notification for new booking
        if (result.booking) {
            await createNotification({
                type: NotificationType.BOOKING,
                title: "Ada Booking Court Baru",
                message: `${customerName} memesan lapangan ${court.name} untuk tanggal ${start.toLocaleDateString("id-ID")}`,
                data: {
                    bookingId: result.booking.id,
                    bookingNumber: result.booking.bookingNumber,
                    customerName,
                    courtName: court.name,
                    totalPrice: totalPrice.toFixed(2),
                },
            });
        }

        return success(c, result, "Booking created successfully", 201);
    } catch (err) {
        logger.error({ error: err }, "Failed to create booking");
        return errorResponse(c, "Failed to create booking: " + (err instanceof Error ? err.message : String(err)), 500);
    }
}

// GET /bookings
export async function getAllBookings(c: Context) {
    try {
        const courtId = c.req.query("court_id");
        const status = c.req.query("status");
        const paymentStatus = c.req.query("payment_status");
        const date = c.req.query("date");
        const page = parseInt(c.req.query("page") || "1");
        const limit = parseInt(c.req.query("limit") || "10");
        const offset = (page - 1) * limit;

        const conditions = [];
        if (courtId) conditions.push(eq(bookings.courtId, courtId));
        if (status) conditions.push(eq(bookings.bookingStatus, status as BookingStatus));
        if (paymentStatus) conditions.push(eq(bookings.paymentStatus, paymentStatus as PaymentStatus));
        if (date) {
            const startOfDay = new Date(date as string);
            if (!isNaN(startOfDay.getTime())) {
                const endOfDay = new Date(startOfDay);
                endOfDay.setDate(endOfDay.getDate() + 1);
                conditions.push(and(gte(bookings.startTime, startOfDay), lt(bookings.startTime, endOfDay)));
            }
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const data = await db.query.bookings.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: [desc(bookings.startTime)],
            with: {
                court: true,
                transaction: true,
            },
        });

        const totalRes = await db.select({ count: sql<number>`count(*)` }).from(bookings).where(whereClause);
        const total = totalRes[0]?.count ?? 0;

        return success(c, {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        }, "Bookings retrieved successfully");
    } catch (err) {
        logger.error({ error: err }, "Failed to fetch bookings");
        return errorResponse(c, "Failed to fetch bookings", 500);
    }
}

// GET /bookings/:id
export async function getBookingById(c: Context) {
    try {
        const id = c.req.param("id");
        const booking = await db.query.bookings.findFirst({
            where: eq(bookings.id, id),
            with: {
                court: true,
                transaction: {
                    with: {
                        items: true
                    }
                },
                creator: true
            },
        });

        if (!booking) {
            return errorResponse(c, "Booking not found", 404);
        }

        return success(c, booking, "Booking retrieved successfully");
    } catch (err) {
        logger.error({ error: err }, "Failed to fetch booking");
        return errorResponse(c, "Failed to fetch booking", 500);
    }
}

// PATCH /bookings/:id/cancel
export async function cancelBooking(c: Context) {
    try {
        const id = c.req.param("id");
        const booking = await db.query.bookings.findFirst({
            where: eq(bookings.id, id),
        });

        if (!booking) {
            return errorResponse(c, "Booking not found", 404);
        }

        if (booking.bookingStatus === BookingStatus.CANCELLED) {
            return errorResponse(c, "Booking is already cancelled", 400);
        }

        await db.transaction(async (tx) => {
            await tx.update(bookings).set({
                bookingStatus: BookingStatus.CANCELLED,
                updatedAt: new Date(),
            }).where(eq(bookings.id, id));

            if (booking.transactionId) {
                await tx.update(transactions).set({
                    status: TransactionStatus.CANCELLED,
                    updatedAt: new Date(),
                }).where(eq(transactions.id, booking.transactionId));
            }
        });

        return success(c, { id }, "Booking cancelled successfully");
    } catch (err) {
        logger.error({ error: err }, "Failed to cancel booking");
        return errorResponse(c, "Failed to cancel booking", 500);
    }
}

// PATCH /bookings/:id/complete
export async function completeBooking(c: Context) {
    try {
        const id = c.req.param("id");
        const [updated] = await db.update(bookings).set({
            bookingStatus: BookingStatus.COMPLETED,
            updatedAt: new Date(),
        }).where(eq(bookings.id, id)).returning();

        if (!updated) {
            return errorResponse(c, "Booking not found", 404);
        }

        return success(c, updated, "Booking marked as completed");
    } catch (err) {
        logger.error({ error: err }, "Failed to complete booking");
        return errorResponse(c, "Failed to complete booking", 500);
    }
}

// GET /courts/:id/availability
export async function getCourtAvailability(c: Context) {
    try {
        const courtId = c.req.param("id");
        const date = c.req.query("date") || new Date().toISOString().split('T')[0];

        const startOfDay = new Date(date as string);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        const bookedSlots = await db.query.bookings.findMany({
            where: and(
                eq(bookings.courtId, courtId),
                ne(bookings.bookingStatus, BookingStatus.CANCELLED),
                and(
                    gte(bookings.startTime, startOfDay),
                    lt(bookings.startTime, endOfDay)
                )
            ),
            columns: {
                startTime: true,
                endTime: true,
                bookingStatus: true
            }
        });

        return success(c, bookedSlots, "Availability retrieved successfully");
    } catch (err) {
        logger.error({ error: err }, "Failed to fetch availability");
        return errorResponse(c, "Failed to fetch availability", 500);
    }
}

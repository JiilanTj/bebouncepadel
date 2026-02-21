import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import {
    orderRequests,
    orderRequestItems,
    tables,
    menus,
    transactions,
    transactionItems,
    OrderRequestStatus,
    TransactionType,
    TransactionStatus,
    ItemType,
    NotificationType,
} from "../db/schema.js";
import {
    validateTableSchema,
    createOrderRequestSchema,
    updateOrderRequestStatusSchema,
} from "../validators/order-request.validator.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";
import { createNotification } from "./notification.controller.js";

// Generate order number (ORD-YYYYMMDD-XXXX)
function generateOrderNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${dateStr}-${randomStr}`;
}

// Generate invoice number: INV-YYYYMMDD-XXXX
async function generateInvoiceNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");

    // Get count of transactions today
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

// POST /order-requests/validate-table
export async function validateTableQr(c: Context) {
    try {
        const body = await c.req.json();
        const validation = validateTableSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
        }

        const { code } = validation.data;

        const table = await db.query.tables.findFirst({
            where: and(
                eq(tables.code, code),
                eq(tables.isActive, true)
            ),
        });

        if (!table) {
            return success(c, { valid: false, message: "Kode meja tidak valid" });
        }

        return success(c, {
            valid: true,
            table: {
                id: table.id,
                code: table.code,
                name: table.name,
                status: table.status,
            },
        });
    } catch (err) {
        logger.error({ error: err }, "Failed to validate table code");
        return errorResponse(c, "Failed to validate table code", 500);
    }
}

// POST /order-requests
export async function createOrderRequest(c: Context) {
    try {
        const body = await c.req.json();
        const validation = createOrderRequestSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
        }

        const { tableCode, customerName, items, notes } = validation.data;

        // Validate table
        const table = await db.query.tables.findFirst({
            where: and(
                eq(tables.code, tableCode),
                eq(tables.isActive, true)
            ),
        });

        if (!table) {
            return errorResponse(c, "Kode meja tidak valid", 400);
        }

        // Validate all menu items exist
        const menuIds = items.map((item) => item.menuId);
        const menuRecords = await db.query.menus.findMany({
            where: sql`${menus.id} IN ${menuIds}`,
        });

        if (menuRecords.length !== menuIds.length) {
            return errorResponse(c, "Beberapa menu tidak ditemukan", 400);
        }

        // Calculate total
        const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

        // Generate order number
        const orderNumber = generateOrderNumber();

        // Create order request
        const [orderRequest] = await db
            .insert(orderRequests)
            .values({
                orderNumber,
                tableId: table.id,
                customerName,
                totalAmount: totalAmount.toFixed(2),
                status: OrderRequestStatus.PENDING,
                notes: notes || null,
            })
            .returning();

        if (!orderRequest) {
            return errorResponse(c, "Failed to create order request", 500);
        }

        // Create order items
        const orderItems = await db
            .insert(orderRequestItems)
            .values(
                items.map((item) => ({
                    orderRequestId: orderRequest.id,
                    menuId: item.menuId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    subtotal: item.subtotal,
                    notes: item.notes || null,
                }))
            )
            .returning();

        // Create notification for new order request
        await createNotification({
            type: NotificationType.ORDER_REQUEST,
            title: "Pesanan Baru",
            message: `${customerName} memesan dari meja ${table.code} sebesar Rp ${totalAmount.toLocaleString("id-ID")}`,
            data: {
                orderRequestId: orderRequest.id,
                orderNumber: orderRequest.orderNumber,
                customerName,
                tableCode: table.code,
                totalAmount: totalAmount.toFixed(2),
                itemCount: items.length,
            },
            orderRequestId: orderRequest.id,
        });

        return success(
            c,
            {
                orderRequest,
                items: orderItems,
            },
            "Pesanan berhasil dibuat",
            201
        );
    } catch (err) {
        logger.error({ error: err }, "Failed to create order request");
        return errorResponse(c, "Failed to create order request", 500);
    }
}

// GET /order-requests
export async function getAllOrderRequests(c: Context) {
    try {
        const page = parseInt(c.req.query("page") || "1");
        const limit = parseInt(c.req.query("limit") || "20");
        const status = c.req.query("status");

        const offset = (page - 1) * limit;

        const conditions = [];

        if (status) {
            conditions.push(eq(orderRequests.status, status as OrderRequestStatus));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const data = await db.query.orderRequests.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: desc(orderRequests.createdAt),
            with: {
                table: true,
                items: {
                    with: {
                        menu: true,
                    },
                },
                approver: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                transaction: true,
            },
        });

        const allItems = await db
            .select({ id: orderRequests.id })
            .from(orderRequests)
            .where(whereClause);
        const total = allItems.length;
        const totalPages = Math.ceil(total / limit);

        return success(c, {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        });
    } catch (err) {
        logger.error({ error: err }, "Failed to fetch order requests");
        return errorResponse(c, "Failed to fetch order requests", 500);
    }
}

// GET /order-requests/:id
export async function getOrderRequestById(c: Context) {
    try {
        const id = c.req.param("id");

        const orderRequest = await db.query.orderRequests.findFirst({
            where: eq(orderRequests.id, id),
            with: {
                table: true,
                items: {
                    with: {
                        menu: true,
                    },
                },
                approver: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                transaction: true,
            },
        });

        if (!orderRequest) {
            return errorResponse(c, "Order request not found", 404);
        }

        return success(c, orderRequest);
    } catch (err) {
        logger.error({ error: err }, "Failed to fetch order request");
        return errorResponse(c, "Failed to fetch order request", 500);
    }
}

// PATCH /order-requests/:id/status
export async function updateOrderRequestStatus(c: Context) {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        const validation = updateOrderRequestStatusSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
        }

        const { status, rejectedReason } = validation.data;

        // Get user from context (set by auth middleware)
        const user = c.get("user");
        if (!user) {
            return errorResponse(c, "Unauthorized", 401);
        }

        const existing = await db.query.orderRequests.findFirst({
            where: eq(orderRequests.id, id),
            with: {
                items: {
                    with: {
                        menu: true,
                    },
                },
            },
        });

        if (!existing) {
            return errorResponse(c, "Order request not found", 404);
        }

        // Validate status transitions
        const validTransitions: Record<string, string[]> = {
            [OrderRequestStatus.PENDING]: [OrderRequestStatus.APPROVED, OrderRequestStatus.REJECTED, OrderRequestStatus.CANCELLED],
            [OrderRequestStatus.APPROVED]: [OrderRequestStatus.PREPARING, OrderRequestStatus.CANCELLED],
            [OrderRequestStatus.PREPARING]: [OrderRequestStatus.SERVED, OrderRequestStatus.CANCELLED],
            [OrderRequestStatus.SERVED]: [],
            [OrderRequestStatus.REJECTED]: [],
            [OrderRequestStatus.CANCELLED]: [],
        };

        const allowedTransitions = validTransitions[existing.status] || [];
        if (!allowedTransitions.includes(status)) {
            return errorResponse(c, `Cannot transition from ${existing.status} to ${status}`, 400);
        }

        // Start database transaction
        const result = await db.transaction(async (tx) => {
            const updateValues: Partial<typeof orderRequests.$inferInsert> = {
                status,
                updatedAt: new Date(),
            };

            if (status === OrderRequestStatus.APPROVED) {
                updateValues.approvedBy = user.userId;
                updateValues.approvedAt = new Date();
            } else if (status === OrderRequestStatus.REJECTED) {
                updateValues.rejectedReason = rejectedReason || null;
            }

            // When status is SERVED, create a transaction record
            let createdTransaction = null;
            if (status === OrderRequestStatus.SERVED) {
                // Generate invoice number
                const invoiceNumber = await generateInvoiceNumber();

                // Create transaction
                const [transaction] = await tx.insert(transactions).values({
                    invoiceNumber,
                    type: TransactionType.POS,
                    tableId: existing.tableId,
                    customerName: existing.customerName,
                    totalAmount: existing.totalAmount,
                    paidAmount: "0",
                    changeAmount: "0",
                    depositAmount: "0",
                    fineAmount: "0",
                    paymentMethod: "OTHER",
                    status: TransactionStatus.PENDING,
                    createdBy: user.userId,
                }).returning();

                createdTransaction = transaction;

                // Create transaction items from order request items
                for (const item of existing.items) {
                    // Reduce menu stock if tracking is enabled
                    const menu = await tx.query.menus.findFirst({
                        where: eq(menus.id, item.menuId),
                    });

                    if (menu && menu.stock !== null && menu.stock !== undefined) {
                        if (menu.stock < item.quantity) {
                            throw new Error(`Insufficient stock for ${menu.name}. Available: ${menu.stock}`);
                        }

                        await tx
                            .update(menus)
                            .set({
                                stock: menu.stock - item.quantity,
                                updatedAt: new Date(),
                            })
                            .where(eq(menus.id, item.menuId));
                    }

                    await tx.insert(transactionItems).values({
                        transactionId: transaction!.id,
                        itemType: ItemType.MENU,
                        menuId: item.menuId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        subtotal: item.subtotal,
                        notes: item.notes,
                    });
                }

                // Update order request with transaction ID
                updateValues.transactionId = transaction!.id;
            }

            const [updated] = await tx
                .update(orderRequests)
                .set(updateValues)
                .where(eq(orderRequests.id, id))
                .returning();

            return { updated, transaction: createdTransaction };
        });

        const message = status === OrderRequestStatus.SERVED && result.transaction
            ? "Status pesanan berhasil diupdate dan transaksi dibuat"
            : "Status pesanan berhasil diupdate";

        return success(c, {
            orderRequest: result.updated,
            transaction: result.transaction,
        }, message);
    } catch (err) {
        logger.error({ error: err }, "Failed to update order request status");
        return errorResponse(c, "Failed to update order request status", 500);
    }
}

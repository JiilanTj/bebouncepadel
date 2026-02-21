import { eq, and, desc, sql } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import { productRentRecords, products, ProductRentStatus } from "../db/schema.js";
import { returnRentSchema } from "../validators/product-rent.validator.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";

// GET /product-rents
export async function getAllRentRecords(c: Context) {
  try {
    const productId = c.req.query("productId");
    const transactionId = c.req.query("transactionId");
    const status = c.req.query("status");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");

    const offset = (page - 1) * limit;

    const conditions = [];

    if (productId) {
      conditions.push(eq(productRentRecords.productId, productId));
    }

    if (transactionId) {
      conditions.push(eq(productRentRecords.transactionId, transactionId));
    }

    if (status) {
      conditions.push(eq(productRentRecords.status, status as ProductRentStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.query.productRentRecords.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(productRentRecords.rentedAt)],
      with: {
        product: true,
        transaction: {
          columns: {
            id: true,
            invoiceNumber: true,
            customerName: true,
            createdAt: true,
          },
        },
      },
    });

    const allItems = await db
      .select({ id: productRentRecords.id })
      .from(productRentRecords)
      .where(whereClause);
    const total = allItems.length;
    const totalPages = Math.ceil(total / limit);

    return success(c, {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    }, "Rent records retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch rent records");
    return errorResponse(c, "Failed to fetch rent records", 500);
  }
}

// GET /product-rents/:id
export async function getRentRecordById(c: Context) {
  try {
    const id = c.req.param("id");

    const record = await db.query.productRentRecords.findFirst({
      where: eq(productRentRecords.id, id),
      with: {
        product: true,
        transaction: {
          with: {
            table: true,
          },
        },
      },
    });

    if (!record) {
      return errorResponse(c, "Rent record not found", 404);
    }

    return success(c, record, "Rent record retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch rent record");
    return errorResponse(c, "Failed to fetch rent record", 500);
  }
}

// GET /product-rents/product/:productId
export async function getRentRecordsByProduct(c: Context) {
  try {
    const productId = c.req.param("productId");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");
    const offset = (page - 1) * limit;

    // Check product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      return errorResponse(c, "Product not found", 404);
    }

    const data = await db.query.productRentRecords.findMany({
      where: eq(productRentRecords.productId, productId),
      limit,
      offset,
      orderBy: [desc(productRentRecords.rentedAt)],
      with: {
        transaction: {
          columns: {
            id: true,
            invoiceNumber: true,
            customerName: true,
            createdAt: true,
          },
        },
      },
    });

    const allItems = await db
      .select({ id: productRentRecords.id })
      .from(productRentRecords)
      .where(eq(productRentRecords.productId, productId));
    const total = allItems.length;
    const totalPages = Math.ceil(total / limit);

    return success(c, {
      product,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    }, "Product rent history retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch product rent history");
    return errorResponse(c, "Failed to fetch product rent history", 500);
  }
}

// GET /product-rents/transaction/:transactionId
export async function getRentRecordsByTransaction(c: Context) {
  try {
    const transactionId = c.req.param("transactionId");

    const data = await db.query.productRentRecords.findMany({
      where: eq(productRentRecords.transactionId, transactionId),
      orderBy: [desc(productRentRecords.rentedAt)],
      with: {
        product: true,
      },
    });

    return success(c, { data }, "Transaction rent records retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch transaction rent records");
    return errorResponse(c, "Failed to fetch transaction rent records", 500);
  }
}

// GET /product-rents/active
export async function getActiveRentals(c: Context) {
  try {
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");
    const offset = (page - 1) * limit;

    const data = await db.query.productRentRecords.findMany({
      where: eq(productRentRecords.status, ProductRentStatus.ACTIVE),
      limit,
      offset,
      orderBy: [desc(productRentRecords.rentedAt)],
      with: {
        product: true,
        transaction: {
          columns: {
            id: true,
            invoiceNumber: true,
            customerName: true,
            createdAt: true,
          },
        },
      },
    });

    const allItems = await db
      .select({ id: productRentRecords.id })
      .from(productRentRecords)
      .where(eq(productRentRecords.status, ProductRentStatus.ACTIVE));
    const total = allItems.length;
    const totalPages = Math.ceil(total / limit);

    return success(c, {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    }, "Active rentals retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch active rentals");
    return errorResponse(c, "Failed to fetch active rentals", 500);
  }
}

// PATCH /product-rents/:id/return
export async function returnRentRecord(c: Context) {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validation = returnRentSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const record = await db.query.productRentRecords.findFirst({
      where: eq(productRentRecords.id, id),
      with: {
        product: true,
      },
    });

    if (!record) {
      return errorResponse(c, "Rent record not found", 404);
    }

    if (record.status !== ProductRentStatus.ACTIVE) {
      return errorResponse(c, "Rent record is not active", 400);
    }

    const returnedAt = validation.data.returnedAt 
      ? new Date(validation.data.returnedAt) 
      : new Date();

    // Update rent record
    const [updatedRecord] = await db
      .update(productRentRecords)
      .set({
        status: ProductRentStatus.RETURNED,
        returnedAt,
      })
      .where(eq(productRentRecords.id, id))
      .returning();

    // Restore product stock
    if (record.product) {
      await db
        .update(products)
        .set({
          stock: record.product.stock + record.quantity,
          updatedAt: new Date(),
        })
        .where(eq(products.id, record.productId));
    }

    return success(c, updatedRecord, "Rent record marked as returned");
  } catch (err) {
    logger.error({ error: err }, "Failed to return rent record");
    return errorResponse(c, "Failed to return rent record", 500);
  }
}

// GET /product-rents/stats/product/:productId
export async function getProductRentStats(c: Context) {
  try {
    const productId = c.req.param("productId");

    // Check product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      return errorResponse(c, "Product not found", 404);
    }

    // Get stats
    const activeStats = await db
      .select({
        totalQuantity: sql<number>`coalesce(sum(${productRentRecords.quantity}), 0)`,
        totalRevenue: sql<string>`coalesce(sum(${productRentRecords.subtotal}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(productRentRecords)
      .where(
        and(
          eq(productRentRecords.productId, productId),
          eq(productRentRecords.status, ProductRentStatus.ACTIVE)
        )
      );

    const returnedStats = await db
      .select({
        totalQuantity: sql<number>`coalesce(sum(${productRentRecords.quantity}), 0)`,
        totalRevenue: sql<string>`coalesce(sum(${productRentRecords.subtotal}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(productRentRecords)
      .where(
        and(
          eq(productRentRecords.productId, productId),
          eq(productRentRecords.status, ProductRentStatus.RETURNED)
        )
      );

    return success(c, {
      product,
      active: activeStats[0],
      returned: returnedStats[0],
    }, "Product rent stats retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch product rent stats");
    return errorResponse(c, "Failed to fetch product rent stats", 500);
  }
}

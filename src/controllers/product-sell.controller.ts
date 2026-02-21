import { eq, and, desc, sql } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import { productSellRecords, products, ProductSellStatus } from "../db/schema.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";

// GET /product-sells
export async function getAllSellRecords(c: Context) {
  try {
    const productId = c.req.query("productId");
    const transactionId = c.req.query("transactionId");
    const status = c.req.query("status");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");

    const offset = (page - 1) * limit;

    const conditions = [];

    if (productId) {
      conditions.push(eq(productSellRecords.productId, productId));
    }

    if (transactionId) {
      conditions.push(eq(productSellRecords.transactionId, transactionId));
    }

    if (status) {
      conditions.push(eq(productSellRecords.status, status as ProductSellStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.query.productSellRecords.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(productSellRecords.soldAt)],
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
      .select({ id: productSellRecords.id })
      .from(productSellRecords)
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
    }, "Sell records retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch sell records");
    return errorResponse(c, "Failed to fetch sell records", 500);
  }
}

// GET /product-sells/:id
export async function getSellRecordById(c: Context) {
  try {
    const id = c.req.param("id");

    const record = await db.query.productSellRecords.findFirst({
      where: eq(productSellRecords.id, id),
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
      return errorResponse(c, "Sell record not found", 404);
    }

    return success(c, record, "Sell record retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch sell record");
    return errorResponse(c, "Failed to fetch sell record", 500);
  }
}

// GET /product-sells/product/:productId
export async function getSellRecordsByProduct(c: Context) {
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

    const data = await db.query.productSellRecords.findMany({
      where: eq(productSellRecords.productId, productId),
      limit,
      offset,
      orderBy: [desc(productSellRecords.soldAt)],
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
      .select({ id: productSellRecords.id })
      .from(productSellRecords)
      .where(eq(productSellRecords.productId, productId));
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
    }, "Product sell history retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch product sell history");
    return errorResponse(c, "Failed to fetch product sell history", 500);
  }
}

// GET /product-sells/transaction/:transactionId
export async function getSellRecordsByTransaction(c: Context) {
  try {
    const transactionId = c.req.param("transactionId");

    const data = await db.query.productSellRecords.findMany({
      where: eq(productSellRecords.transactionId, transactionId),
      orderBy: [desc(productSellRecords.soldAt)],
      with: {
        product: true,
      },
    });

    return success(c, { data }, "Transaction sell records retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch transaction sell records");
    return errorResponse(c, "Failed to fetch transaction sell records", 500);
  }
}

// GET /product-sells/stats/product/:productId
export async function getProductSellStats(c: Context) {
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
    const stats = await db
      .select({
        totalQuantity: sql<number>`coalesce(sum(${productSellRecords.quantity}), 0)`,
        totalRevenue: sql<string>`coalesce(sum(${productSellRecords.subtotal}), 0)`,
        totalTransactions: sql<number>`count(*)`,
      })
      .from(productSellRecords)
      .where(
        and(
          eq(productSellRecords.productId, productId),
          eq(productSellRecords.status, ProductSellStatus.ACTIVE)
        )
      );

    return success(c, {
      product,
      stats: stats[0],
    }, "Product sell stats retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch product sell stats");
    return errorResponse(c, "Failed to fetch product sell stats", 500);
  }
}

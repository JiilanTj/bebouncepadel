import { eq, and, or, sql } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import { tables, TableStatus } from "../db/schema.js";
import {
  tableSchema,
  tableUpdateSchema,
  tableStatusSchema,
} from "../validators/table.validator.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";

// GET /tables
export async function getAllTables(c: Context) {
  try {
    const status = c.req.query("status");
    const active = c.req.query("active");
    const search = c.req.query("search");

    const conditions = [];

    if (status) {
      conditions.push(eq(tables.status, status as TableStatus));
    }

    if (active === "true") {
      conditions.push(eq(tables.isActive, true));
    } else if (active === "false") {
      conditions.push(eq(tables.isActive, false));
    }

    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          sql`lower(${tables.code}) like ${searchLower}`,
          sql`lower(${tables.name}) like ${searchLower}`,
          sql`lower(${tables.location}) like ${searchLower}`
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.query.tables.findMany({
      where: whereClause,
      orderBy: (tables, { asc }) => [asc(tables.code)],
    });

    return success(c, { data }, "Tables retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch tables");
    return errorResponse(c, "Failed to fetch tables", 500);
  }
}

// GET /tables/:id
export async function getTableById(c: Context) {
  try {
    const id = c.req.param("id");
    const table = await db.query.tables.findFirst({
      where: eq(tables.id, id),
    });

    if (!table) {
      return errorResponse(c, "Table not found", 404);
    }

    return success(c, table, "Table retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch table");
    return errorResponse(c, "Failed to fetch table", 500);
  }
}

// POST /tables
export async function createTable(c: Context) {
  try {
    const body = await c.req.json();
    const validation = tableSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const { code } = validation.data;

    // Check code uniqueness
    const codeExists = await db.query.tables.findFirst({
      where: eq(tables.code, code),
    });
    if (codeExists) {
      return errorResponse(c, "Table code already exists", 409);
    }

    // Insert with default status EMPTY
    const [newTable] = await db
      .insert(tables)
      .values({
        ...validation.data,
        status: TableStatus.EMPTY,
      })
      .returning();

    return success(c, newTable, "Table created successfully", 201);
  } catch (err) {
    logger.error({ error: err }, "Failed to create table");
    return errorResponse(c, "Failed to create table", 500);
  }
}

// PUT /tables/:id
export async function updateTable(c: Context) {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validation = tableUpdateSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const existing = await db.query.tables.findFirst({
      where: eq(tables.id, id),
    });
    if (!existing) {
      return errorResponse(c, "Table not found", 404);
    }

    const [updatedTable] = await db
      .update(tables)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(tables.id, id))
      .returning();

    return success(c, updatedTable, "Table updated successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to update table");
    return errorResponse(c, "Failed to update table", 500);
  }
}

// PATCH /tables/:id/status
export async function updateTableStatus(c: Context) {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validation = tableStatusSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const { status, customerName, customerPhone } = validation.data;

    const existing = await db.query.tables.findFirst({
      where: eq(tables.id, id),
    });
    if (!existing) {
      return errorResponse(c, "Table not found", 404);
    }

    // Prepare update values based on status
    const updateValues: Partial<typeof existing> = {
      status,
      updatedAt: new Date(),
    };

    if (status === TableStatus.OCCUPIED) {
      // When occupied: require customer name, set occupied_at
      if (!customerName) {
        return errorResponse(c, "Customer name is required when occupying table", 400);
      }
      updateValues.currentCustomerName = customerName;
      updateValues.currentCustomerPhone = customerPhone || null;
      updateValues.occupiedAt = new Date();
    } else {
      // When empty: clear all customer info and occupied_at
      updateValues.currentCustomerName = null;
      updateValues.currentCustomerPhone = null;
      updateValues.occupiedAt = null;
    }

    const [updatedTable] = await db
      .update(tables)
      .set(updateValues)
      .where(eq(tables.id, id))
      .returning();

    return success(c, updatedTable, "Table status updated successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to update table status");
    return errorResponse(c, "Failed to update table status", 500);
  }
}

// DELETE /tables/:id (Soft delete)
export async function deleteTable(c: Context) {
  try {
    const id = c.req.param("id");

    const existing = await db.query.tables.findFirst({
      where: eq(tables.id, id),
    });
    if (!existing) {
      return errorResponse(c, "Table not found", 404);
    }

    const [deletedTable] = await db
      .update(tables)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(tables.id, id))
      .returning();

    return success(c, deletedTable, "Table deactivated successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to delete table");
    return errorResponse(c, "Failed to delete table", 500);
  }
}

// PATCH /tables/:id/activate
export async function activateTable(c: Context) {
  try {
    const id = c.req.param("id");

    const existing = await db.query.tables.findFirst({
      where: eq(tables.id, id),
    });
    if (!existing) {
      return errorResponse(c, "Table not found", 404);
    }

    const [activatedTable] = await db
      .update(tables)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(tables.id, id))
      .returning();

    return success(c, activatedTable, "Table activated successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to activate table");
    return errorResponse(c, "Failed to activate table", 500);
  }
}

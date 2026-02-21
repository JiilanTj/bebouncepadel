import { eq, and, or, sql, desc } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import { inventories, inventoryAdjustments, AdjustmentType, InventoryStatus } from "../db/schema.js";
import { generateSlug } from "../lib/slug.js";
import {
  inventorySchema,
  inventoryUpdateSchema,
  inventoryAdjustmentSchema,
} from "../validators/inventory.validator.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";
import { uploadImage, deleteImage } from "../utils/file-upload.js";

// GET /inventories
export async function getAllInventories(c: Context) {
  try {
    const type = c.req.query("type");
    const condition = c.req.query("condition");
    const status = c.req.query("status");
    const search = c.req.query("search");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");

    const offset = (page - 1) * limit;

    const conditions = [];

    if (type) {
      conditions.push(eq(inventories.type, type as "ASSET" | "CONSUMABLE"));
    }

    if (condition) {
      conditions.push(eq(inventories.condition, condition as "GOOD" | "DAMAGED" | "NEED_REPAIR" | "BROKEN"));
    }

    if (status) {
      conditions.push(eq(inventories.status, status as "ACTIVE" | "INACTIVE" | "DISPOSED"));
    }

    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          sql`lower(${inventories.name}) like ${searchLower}`,
          sql`lower(${inventories.location}) like ${searchLower}`
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.query.inventories.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(inventories.createdAt)],
    });

    const allItems = await db
      .select({ id: inventories.id })
      .from(inventories)
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
    }, "Inventories retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch inventories");
    return errorResponse(c, "Failed to fetch inventories", 500);
  }
}

// GET /inventories/:id
export async function getInventoryById(c: Context) {
  try {
    const id = c.req.param("id");

    const inventory = await db.query.inventories.findFirst({
      where: eq(inventories.id, id),
      with: {
        adjustments: {
          with: {
            creator: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: [desc(inventoryAdjustments.createdAt)],
        },
      },
    });

    if (!inventory) {
      return errorResponse(c, "Inventory not found", 404);
    }

    return success(c, inventory, "Inventory retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch inventory");
    return errorResponse(c, "Failed to fetch inventory", 500);
  }
}

// POST /inventories
export async function createInventory(c: Context) {
  try {
    const formData = await c.req.parseBody();
    const imageFile = formData["image"] instanceof File ? formData["image"] : undefined;

    // Build payload from form data
    const payload: Record<string, unknown> = {
      name: formData["name"],
      description: formData["description"],
      type: formData["type"],
      quantity: formData["quantity"] ? parseInt(String(formData["quantity"])) : 0,
      unit: formData["unit"],
      condition: formData["condition"],
      status: formData["status"],
      ownerName: formData["owner_name"],
      purchaseDate: formData["purchase_date"],
      purchasePrice: formData["purchase_price"] ? parseFloat(String(formData["purchase_price"])) : undefined,
      location: formData["location"],
      notes: formData["notes"],
    };

    const validation = inventorySchema.safeParse(payload);

    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const { name } = validation.data;

    // Generate slug
    let slug = generateSlug(name);
    const slugExists = await db.query.inventories.findFirst({
      where: eq(inventories.slug, slug),
    });
    if (slugExists) {
      slug = `${slug}-${Date.now()}`;
    }

    // Image Upload
    let imageKey: string | null = null;
    let imageUrl: string | null = null;

    if (imageFile) {
      const buffer = await imageFile.arrayBuffer();
      const uploadResult = await uploadImage(
        Buffer.from(buffer),
        imageFile.name,
        imageFile.type
      );
      imageKey = uploadResult.key;
      imageUrl = uploadResult.url;
    }

    // Prepare values for insert
    const insertValues: Record<string, unknown> = {
      ...validation.data,
      slug,
      imageKey,
      imageUrl,
    };
    
    // Convert purchasePrice to string if exists
    if (validation.data.purchasePrice !== undefined) {
      insertValues.purchasePrice = validation.data.purchasePrice.toString();
    }
    
    // Convert purchaseDate to Date if exists
    if (validation.data.purchaseDate) {
      insertValues.purchaseDate = new Date(validation.data.purchaseDate);
    }

    // Insert
    const [newInventory] = await db.insert(inventories).values(insertValues as typeof inventories.$inferInsert).returning();

    return success(c, newInventory, "Inventory created successfully", 201);
  } catch (err) {
    logger.error({ error: err }, "Failed to create inventory");
    return errorResponse(c, "Failed to create inventory", 500);
  }
}

// PUT /inventories/:id
export async function updateInventory(c: Context) {
  try {
    const id = c.req.param("id");
    const formData = await c.req.parseBody();
    const imageFile = formData["image"] instanceof File ? formData["image"] : undefined;

    // Build payload
    const payload: Record<string, unknown> = {};
    if (formData["name"] !== undefined) payload.name = formData["name"];
    if (formData["description"] !== undefined) payload.description = formData["description"];
    if (formData["condition"] !== undefined) payload.condition = formData["condition"];
    if (formData["status"] !== undefined) payload.status = formData["status"];
    if (formData["owner_name"] !== undefined) payload.ownerName = formData["owner_name"];
    if (formData["purchase_date"] !== undefined) payload.purchaseDate = formData["purchase_date"];
    if (formData["purchase_price"] !== undefined) payload.purchasePrice = parseFloat(String(formData["purchase_price"]));
    if (formData["location"] !== undefined) payload.location = formData["location"];
    if (formData["notes"] !== undefined) payload.notes = formData["notes"];

    const validation = inventoryUpdateSchema.safeParse(payload);
    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const existingInventory = await db.query.inventories.findFirst({
      where: eq(inventories.id, id),
    });
    if (!existingInventory) {
      return errorResponse(c, "Inventory not found", 404);
    }

    // Handle Image Update
    let imageUpdate = {};
    if (imageFile) {
      if (existingInventory.imageKey) {
        await deleteImage(existingInventory.imageKey);
      }
      const buffer = await imageFile.arrayBuffer();
      const uploadResult = await uploadImage(
        Buffer.from(buffer),
        imageFile.name,
        imageFile.type
      );
      imageUpdate = {
        imageKey: uploadResult.key,
        imageUrl: uploadResult.url,
      };
    }

    // Handle Name update
    let slugUpdate = {};
    const newName = payload.name as string | undefined;
    if (newName && newName !== existingInventory.name) {
      let newSlug = generateSlug(newName);
      const slugExists = await db.query.inventories.findFirst({
        where: eq(inventories.slug, newSlug),
      });
      if (slugExists) {
        newSlug = `${newSlug}-${Date.now()}`;
      }
      slugUpdate = { slug: newSlug };
    }

    const updateValues: Record<string, unknown> = { ...validation.data };
    
    // Convert purchasePrice to string if exists
    if (validation.data.purchasePrice !== undefined) {
      updateValues.purchasePrice = validation.data.purchasePrice.toString();
    }
    
    // Convert purchaseDate to Date if exists
    if (validation.data.purchaseDate) {
      updateValues.purchaseDate = new Date(validation.data.purchaseDate);
    }

    // Remove undefined values
    Object.keys(updateValues).forEach((key) => {
      if (updateValues[key] === undefined) {
        delete updateValues[key];
      }
    });

    const [updatedInventory] = await db.update(inventories).set({
      ...updateValues,
      ...imageUpdate,
      ...slugUpdate,
      updatedAt: new Date(),
    }).where(eq(inventories.id, id)).returning();

    return success(c, updatedInventory, "Inventory updated successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to update inventory");
    return errorResponse(c, "Failed to update inventory", 500);
  }
}

// PATCH /inventories/:id/adjust
export async function adjustInventoryStock(c: Context) {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validation = inventoryAdjustmentSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const { changeType, amount, reason } = validation.data;
    const user = c.get("user");

    const inventory = await db.query.inventories.findFirst({
      where: eq(inventories.id, id),
    });

    if (!inventory) {
      return errorResponse(c, "Inventory not found", 404);
    }

    const quantityBefore = inventory.quantity;
    let quantityAfter: number;

    // Calculate new quantity
    if (changeType === AdjustmentType.ADD) {
      quantityAfter = quantityBefore + amount;
    } else if (changeType === AdjustmentType.REMOVE) {
      quantityAfter = quantityBefore - amount;
      if (quantityAfter < 0) {
        return errorResponse(c, "Cannot remove more than current stock", 409);
      }
    } else {
      // CORRECTION
      quantityAfter = amount;
      if (quantityAfter < 0) {
        return errorResponse(c, "Quantity cannot be negative", 409);
      }
    }

    const changeAmount = quantityAfter - quantityBefore;

    // Start database transaction
    await db.transaction(async (tx) => {
      // Create adjustment record
      await tx.insert(inventoryAdjustments).values({
        inventoryId: id,
        changeType,
        quantityBefore,
        quantityAfter,
        changeAmount,
        reason,
        createdBy: user.userId,
      });

      // Update inventory quantity
      await tx
        .update(inventories)
        .set({
          quantity: quantityAfter,
          updatedAt: new Date(),
        })
        .where(eq(inventories.id, id));
    });

    const updatedInventory = await db.query.inventories.findFirst({
      where: eq(inventories.id, id),
    });

    return success(c, updatedInventory, "Inventory stock adjusted successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to adjust inventory stock");
    return errorResponse(c, "Failed to adjust inventory stock", 500);
  }
}

// DELETE /inventories/:id
export async function deleteInventory(c: Context) {
  try {
    const id = c.req.param("id");

    const existing = await db.query.inventories.findFirst({
      where: eq(inventories.id, id),
    });
    if (!existing) {
      return errorResponse(c, "Inventory not found", 404);
    }

    const [updatedInventory] = await db.update(inventories).set({
      status: InventoryStatus.DISPOSED,
      updatedAt: new Date(),
    }).where(eq(inventories.id, id)).returning();

    return success(c, updatedInventory, "Inventory marked as disposed");
  } catch (err) {
    logger.error({ error: err }, "Failed to delete inventory");
    return errorResponse(c, "Failed to delete inventory", 500);
  }
}

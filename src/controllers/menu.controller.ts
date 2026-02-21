import { eq, and, or, sql } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import { menus, menuCategories } from "../db/schema.js";
import { generateSlug } from "../lib/slug.js";
import { menuSchema, menuUpdateSchema } from "../validators/menu.validator.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";
import { uploadImage, deleteImage } from "../utils/file-upload.js";

// GET /menus
export async function getAllMenus(c: Context) {
  try {
    // Query Params
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");
    const categoryId = c.req.query("categoryId");
    const search = c.req.query("search");
    const available = c.req.query("available");
    const active = c.req.query("active");

    const offset = (page - 1) * limit;

    const conditions = [];

    if (categoryId) {
      conditions.push(eq(menus.menuCategoryId, categoryId));
    }

    if (available === "true") {
      conditions.push(eq(menus.isAvailable, true));
    } else if (available === "false") {
      conditions.push(eq(menus.isAvailable, false));
    }

    if (active === "true") {
      conditions.push(eq(menus.isActive, true));
    } else if (active === "false") {
      conditions.push(eq(menus.isActive, false));
    }

    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          sql`lower(${menus.name}) like ${searchLower}`,
          sql`lower(${menus.sku}) like ${searchLower}`
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Data query
    const data = await db.query.menus.findMany({
      where: whereClause,
      limit: limit,
      offset: offset,
      orderBy: (menus, { desc }) => [desc(menus.createdAt)],
      with: {
        category: true,
      },
    });

    const allItems = await db.select({ id: menus.id }).from(menus).where(whereClause);
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
    }, "Menus retrieved successfully");

  } catch (err) {
    logger.error({ error: err }, "Failed to fetch menus");
    return errorResponse(c, "Failed to fetch menus", 500);
  }
}

// GET /menus/:id
export async function getMenuById(c: Context) {
  try {
    const id = c.req.param("id");
    const menu = await db.query.menus.findFirst({
      where: eq(menus.id, id),
      with: {
        category: true,
      },
    });

    if (!menu) {
      return errorResponse(c, "Menu not found", 404);
    }

    return success(c, menu, "Menu retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch menu");
    return errorResponse(c, "Failed to fetch menu", 500);
  }
}

// POST /menus
export async function createMenu(c: Context) {
  try {
    const formData = await c.req.parseBody();
    const imageFile = formData["image"] instanceof File ? formData["image"] : undefined;

    // Initial validation payload
    const payload = {
      name: formData["name"],
      description: formData["description"],
      price: formData["price"],
      costPrice: formData["cost_price"],
      stock: formData["stock"],
      sku: formData["sku"],
      menuCategoryId: formData["menu_category_id"],
    };

    const validation = menuSchema.safeParse(payload);

    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const { name, menuCategoryId, sku } = validation.data;

    // Check category existence
    const category = await db.query.menuCategories.findFirst({
      where: eq(menuCategories.id, menuCategoryId),
    });
    if (!category) {
      return errorResponse(c, "Menu Category not found", 404);
    }

    // Slug generation
    let slug = generateSlug(name);
    const slugExists = await db.query.menus.findFirst({ where: eq(menus.slug, slug) });
    if (slugExists) {
      slug = `${slug}-${Date.now()}`;
    }

    // SKU uniqueness check
    if (sku) {
      const skuExists = await db.query.menus.findFirst({ where: eq(menus.sku, sku) });
      if (skuExists) {
        return errorResponse(c, "SKU already exists", 409);
      }
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

    // Insert
    const [newMenu] = await db.insert(menus).values({
      ...validation.data,
      price: validation.data.price.toString(),
      costPrice: validation.data.costPrice?.toString(),
      slug,
      imageKey: imageKey,
      imageUrl: imageUrl,
    }).returning();

    return success(c, newMenu, "Menu created successfully", 201);

  } catch (err) {
    logger.error({ error: err }, "Failed to create menu");
    return errorResponse(c, "Failed to create menu", 500);
  }
}

// PUT /menus/:id
export async function updateMenu(c: Context) {
  try {
    const id = c.req.param("id");
    const formData = await c.req.parseBody();
    const imageFile = formData["image"] instanceof File ? formData["image"] : undefined;

    const payload: Record<string, unknown> = {};
    if (formData["name"] !== undefined) payload.name = formData["name"];
    if (formData["description"] !== undefined) payload.description = formData["description"];
    if (formData["price"] !== undefined) payload.price = formData["price"];
    if (formData["cost_price"] !== undefined) payload.costPrice = formData["cost_price"];
    if (formData["stock"] !== undefined) payload.stock = formData["stock"];
    if (formData["sku"] !== undefined) payload.sku = formData["sku"];
    if (formData["menu_category_id"] !== undefined) payload.menuCategoryId = formData["menu_category_id"];
    if (formData["is_available"] !== undefined) payload.isAvailable = formData["is_available"];

    const validation = menuUpdateSchema.safeParse(payload);
    if (!validation.success) {
      return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
    }

    const existingMenu = await db.query.menus.findFirst({
      where: eq(menus.id, id),
    });
    if (!existingMenu) {
      return errorResponse(c, "Menu not found", 404);
    }

    // Check new category if provided
    if (payload.menuCategoryId) {
      const category = await db.query.menuCategories.findFirst({
        where: eq(menuCategories.id, payload.menuCategoryId as string),
      });
      if (!category) {
        return errorResponse(c, "Menu Category not found", 404);
      }
    }

    // Handle Image Update
    let imageUpdate = {};
    if (imageFile) {
      if (existingMenu.imageKey) {
        await deleteImage(existingMenu.imageKey);
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

    // Handle SKU update check
    const newSku = payload.sku as string | undefined;
    if (newSku && newSku !== existingMenu.sku) {
      const skuExists = await db.query.menus.findFirst({ where: eq(menus.sku, newSku) });
      if (skuExists) {
        return errorResponse(c, "SKU already exists", 409);
      }
    }

    // Handle Name update
    let slugUpdate = {};
    const newName = payload.name as string | undefined;
    if (newName && newName !== existingMenu.name) {
      let newSlug = generateSlug(newName);
      const slugExists = await db.query.menus.findFirst({ where: eq(menus.slug, newSlug) });
      if (slugExists) {
        newSlug = `${newSlug}-${Date.now()}`;
      }
      slugUpdate = { slug: newSlug };
    }

    const { price, costPrice, isAvailable, ...restData } = validation.data;
    const updateValues: Record<string, unknown> = { ...restData };
    if (price !== undefined) updateValues.price = price.toString();
    if (costPrice !== undefined) updateValues.costPrice = costPrice.toString();
    if (isAvailable !== undefined) updateValues.isAvailable = isAvailable;

    // Remove undefined values
    Object.keys(updateValues).forEach((key) => {
      if (updateValues[key] === undefined) {
        delete updateValues[key];
      }
    });

    const [updatedMenu] = await db.update(menus).set({
      ...updateValues,
      ...imageUpdate,
      ...slugUpdate,
      updatedAt: new Date(),
    }).where(eq(menus.id, id)).returning();

    return success(c, updatedMenu, "Menu updated successfully");

  } catch (err) {
    logger.error({ error: err }, "Failed to update menu");
    return errorResponse(c, "Failed to update menu", 500);
  }
}

// DELETE /menus/:id
export async function deleteMenu(c: Context) {
  try {
    const id = c.req.param("id");

    const existing = await db.query.menus.findFirst({ where: eq(menus.id, id) });
    if (!existing) {
      return errorResponse(c, "Menu not found", 404);
    }

    const [deletedMenu] = await db.update(menus).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(menus.id, id)).returning();

    return success(c, deletedMenu, "Menu deactivated successfully");

  } catch (err) {
    logger.error({ error: err }, "Failed to delete menu");
    return errorResponse(c, "Failed to delete menu", 500);
  }
}

// PATCH /menus/:id/activate
export async function activateMenu(c: Context) {
  try {
    const id = c.req.param("id");

    const existing = await db.query.menus.findFirst({ where: eq(menus.id, id) });
    if (!existing) {
      return errorResponse(c, "Menu not found", 404);
    }

    const [activatedMenu] = await db.update(menus).set({
      isActive: true,
      updatedAt: new Date(),
    }).where(eq(menus.id, id)).returning();

    return success(c, activatedMenu, "Menu activated successfully");

  } catch (err) {
    logger.error({ error: err }, "Failed to activate menu");
    return errorResponse(c, "Failed to activate menu", 500);
  }
}

import { eq } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import { productCategories } from "../db/schema.js";
import { generateSlug } from "../lib/slug.js";
import { categorySchema, categoryUpdateSchema } from "../validators/category.validator.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";

// GET /product-categories
export async function getAllProductCategories(c: Context) {
  try {
    const query = c.req.query("active");
    const showActiveOnly = query === "true";

    // Pagination params
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");
    const offset = (page - 1) * limit;

    const whereClause = showActiveOnly ? eq(productCategories.isActive, true) : undefined;

    // Get data with pagination
    const categories = await db.query.productCategories.findMany({
      where: whereClause,
      orderBy: (categories, { asc }) => [asc(categories.name)],
      limit: limit,
      offset: offset,
    });

    // Get total count
    // Note: Drizzle doesn't have a direct count() method for query builder yet, using raw sql or separate query
    // For simplicity with this ORM setup, we can query all or use sql count
    const allCategories = await db.query.productCategories.findMany({
      where: whereClause,
      columns: { id: true },
    });
    const total = allCategories.length;

    const totalPages = Math.ceil(total / limit);

    return success(c, {
      data: categories,
      meta: {
        total,
        page,
        limit,
        totalPages,
      }
    }, "Categories retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch product categories");
    return errorResponse(c, "Failed to fetch categories", 500);
  }
}

// GET /product-categories/:id
export async function getProductCategoryById(c: Context) {
  try {
    const id = c.req.param("id");

    const category = await db.query.productCategories.findFirst({
      where: eq(productCategories.id, id),
    });

    if (!category) {
      return errorResponse(c, "Category not found", 404);
    }

    return success(c, category, "Category retrieved successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch product category");
    return errorResponse(c, "Failed to fetch category", 500);
  }
}

// POST /product-categories
export async function createProductCategory(c: Context) {
  try {
    const body = await c.req.json();
    const validation = categorySchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(
        c,
        "Validation error",
        400,
        validation.error.flatten().fieldErrors
      );
    }

    const { name, description } = validation.data;
    const slug = generateSlug(name);

    // Check if name already exists
    const existing = await db.query.productCategories.findFirst({
      where: eq(productCategories.name, name),
    });

    if (existing) {
      return errorResponse(c, "Category name already exists", 409);
    }

    const [category] = await db
      .insert(productCategories)
      .values({
        name,
        slug,
        description,
      })
      .returning();

    return success(c, category, "Category created successfully", 201);
  } catch (err) {
    logger.error({ error: err }, "Failed to create product category");
    return errorResponse(c, "Failed to create category", 500);
  }
}

// PUT /product-categories/:id
export async function updateProductCategory(c: Context) {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validation = categoryUpdateSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(
        c,
        "Validation error",
        400,
        validation.error.flatten().fieldErrors
      );
    }

    const { name, description } = validation.data;

    // Check if category exists
    const existing = await db.query.productCategories.findFirst({
      where: eq(productCategories.id, id),
    });

    if (!existing) {
      return errorResponse(c, "Category not found", 404);
    }

    // Check name uniqueness if name is being updated
    if (name && name !== existing.name) {
      const nameExists = await db.query.productCategories.findFirst({
        where: eq(productCategories.name, name),
      });

      if (nameExists) {
        return errorResponse(c, "Category name already exists", 409);
      }
    }

    // Build update values
    const updateValues: Partial<typeof existing> = {
      updatedAt: new Date(),
    };

    if (name) {
      updateValues.name = name;
      updateValues.slug = generateSlug(name);
    }

    if (description !== undefined) {
      updateValues.description = description;
    }

    const [category] = await db
      .update(productCategories)
      .set(updateValues)
      .where(eq(productCategories.id, id))
      .returning();

    return success(c, category, "Category updated successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to update product category");
    return errorResponse(c, "Failed to update category", 500);
  }
}

// DELETE /product-categories/:id (Soft delete)
export async function deleteProductCategory(c: Context) {
  try {
    const id = c.req.param("id");

    // Check if category exists
    const existing = await db.query.productCategories.findFirst({
      where: eq(productCategories.id, id),
    });

    if (!existing) {
      return errorResponse(c, "Category not found", 404);
    }

    // Soft delete - set isActive to false
    const [category] = await db
      .update(productCategories)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(productCategories.id, id))
      .returning();

    return success(c, category, "Category deactivated successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to delete product category");
    return errorResponse(c, "Failed to delete category", 500);
  }
}

// PATCH /product-categories/:id/activate
export async function activateProductCategory(c: Context) {
  try {
    const id = c.req.param("id");

    // Check if category exists
    const existing = await db.query.productCategories.findFirst({
      where: eq(productCategories.id, id),
    });

    if (!existing) {
      return errorResponse(c, "Category not found", 404);
    }

    // Activate - set isActive to true
    const [category] = await db
      .update(productCategories)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(productCategories.id, id))
      .returning();

    return success(c, category, "Category activated successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to activate product category");
    return errorResponse(c, "Failed to activate category", 500);
  }
}

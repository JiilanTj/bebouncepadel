import { eq, and, or, sql } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import { products, productCategories } from "../db/schema.js";
import { generateSlug } from "../lib/slug.js";
import { productSchema, productUpdateSchema } from "../validators/product.validator.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";
import { uploadImage, deleteImage } from "../utils/file-upload.js";

// GET /products
export async function getAllProducts(c: Context) {
    try {
        // Query Params
        const page = parseInt(c.req.query("page") || "1");
        const limit = parseInt(c.req.query("limit") || "10");
        const type = c.req.query("type");
        const categoryId = c.req.query("categoryId");
        const search = c.req.query("search");
        const active = c.req.query("active");

        const offset = (page - 1) * limit;

        const conditions = [];

        if (type) {
            conditions.push(eq(products.type, type as "SELL" | "RENT"));
        }

        if (categoryId) {
            conditions.push(eq(products.productCategoryId, categoryId));
        }

        if (active === "true") {
            conditions.push(eq(products.isActive, true));
        } else if (active === "false") {
            conditions.push(eq(products.isActive, false));
        }

        if (search) {
            const searchLower = `%${search.toLowerCase()}%`;
            conditions.push(
                or(
                    sql`lower(${products.name}) like ${searchLower}`,
                    sql`lower(${products.sku}) like ${searchLower}`
                )
            );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Data query
        const data = await db.query.products.findMany({
            where: whereClause,
            limit: limit,
            offset: offset,
            orderBy: (products, { desc }) => [desc(products.createdAt)],
            with: {
                category: true,
            },
        });

        const allItems = await db.select({ id: products.id }).from(products).where(whereClause);
        const total = allItems.length;
        const totalPages = Math.ceil(total / limit);

        return success(c, {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages,
            }
        }, "Products retrieved successfully");

    } catch (err) {
        logger.error({ error: err }, "Failed to fetch products");
        return errorResponse(c, "Failed to fetch products", 500);
    }
}

// GET /products/:id
export async function getProductById(c: Context) {
    try {
        const id = c.req.param("id");
        const product = await db.query.products.findFirst({
            where: eq(products.id, id),
            with: {
                category: true
            }
        });

        if (!product) {
            return errorResponse(c, "Product not found", 404);
        }

        return success(c, product, "Product retrieved successfully");
    } catch (err) {
        logger.error({ error: err }, "Failed to fetch product");
        return errorResponse(c, "Failed to fetch product", 500);
    }
}

// POST /products
export async function createProduct(c: Context) {
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
            type: formData["type"],
            productCategoryId: formData["product_category_id"],
        };

        const validation = productSchema.safeParse(payload);

        if (!validation.success) {
            return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
        }

        const { name, productCategoryId, sku } = validation.data;

        // Check category existence
        const category = await db.query.productCategories.findFirst({
            where: eq(productCategories.id, productCategoryId)
        });
        if (!category) {
            return errorResponse(c, "Product Category not found", 404);
        }

        // Slug generation
        let slug = generateSlug(name);
        const slugExists = await db.query.products.findFirst({ where: eq(products.slug, slug) });
        if (slugExists) {
            slug = `${slug}-${Date.now()}`;
        }

        // SKU uniqueness check
        if (sku) {
            const skuExists = await db.query.products.findFirst({ where: eq(products.sku, sku) });
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
        const [newProduct] = await db.insert(products).values({
            ...validation.data,
            price: validation.data.price.toString(),
            costPrice: validation.data.costPrice?.toString(),
            slug,
            imageKey: imageKey,
            imageUrl: imageUrl,
        }).returning();

        return success(c, newProduct, "Product created successfully", 201);

    } catch (err) {
        logger.error({ error: err }, "Failed to create product");
        return errorResponse(c, "Failed to create product", 500);
    }
}

// PUT /products/:id
export async function updateProduct(c: Context) {
    try {
        const id = c.req.param("id");
        const formData = await c.req.parseBody();
        const imageFile = formData["image"] instanceof File ? formData["image"] : undefined;

        const payload: Record<string, unknown> = {};
        if (formData["name"]) payload.name = formData["name"];
        if (formData["description"]) payload.description = formData["description"];
        if (formData["price"]) payload.price = formData["price"];
        if (formData["cost_price"]) payload.costPrice = formData["cost_price"];
        if (formData["stock"]) payload.stock = formData["stock"];
        if (formData["sku"]) payload.sku = formData["sku"];
        if (formData["type"]) payload.type = formData["type"];
        if (formData["product_category_id"]) payload.productCategoryId = formData["product_category_id"];

        const validation = productUpdateSchema.safeParse(payload);
        if (!validation.success) {
            return errorResponse(c, "Validation error", 400, validation.error.flatten().fieldErrors);
        }

        const existingProduct = await db.query.products.findFirst({
            where: eq(products.id, id)
        });
        if (!existingProduct) {
            return errorResponse(c, "Product not found", 404);
        }

        // Handle Image Update
        let imageUpdate = {};
        if (imageFile) {
            if (existingProduct.imageKey) {
                await deleteImage(existingProduct.imageKey);
            }
            const buffer = await imageFile.arrayBuffer();
            const uploadResult = await uploadImage(
                Buffer.from(buffer),
                imageFile.name,
                imageFile.type
            );
            imageUpdate = {
                imageKey: uploadResult.key,
                imageUrl: uploadResult.url
            };
        }

        // Handle SKU update check
        const newSku = payload.sku as string | undefined;
        if (newSku && newSku !== existingProduct.sku) {
            const skuExists = await db.query.products.findFirst({ where: eq(products.sku, newSku) });
            if (skuExists) {
                return errorResponse(c, "SKU already exists", 409);
            }
        }

        // Handle Name update
        let slugUpdate = {};
        const newName = payload.name as string | undefined;
        if (newName && newName !== existingProduct.name) {
            let newSlug = generateSlug(newName);
            const slugExists = await db.query.products.findFirst({ where: eq(products.slug, newSlug) });
            if (slugExists) {
                newSlug = `${newSlug}-${Date.now()}`;
            }
            slugUpdate = { slug: newSlug };
        }

        const { price, costPrice, ...restData } = validation.data;
        const updateValues: Record<string, unknown> = { ...restData };
        if (price !== undefined) updateValues.price = price.toString();
        if (costPrice !== undefined) updateValues.costPrice = costPrice.toString();

        // Remove undefined values
        Object.keys(updateValues).forEach(key => updateValues[key] === undefined && delete updateValues[key]);

        const [updatedProduct] = await db.update(products).set({
            ...updateValues,
            ...imageUpdate,
            ...slugUpdate,
            updatedAt: new Date(),
        }).where(eq(products.id, id)).returning();

        return success(c, updatedProduct, "Product updated successfully");

    } catch (err) {
        logger.error({ error: err }, "Failed to update product");
        return errorResponse(c, "Failed to update product", 500);
    }
}

// DELETE /products/:id
export async function deleteProduct(c: Context) {
    try {
        const id = c.req.param("id");

        const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
        if (!existing) {
            return errorResponse(c, "Product not found", 404);
        }

        const [deletedProduct] = await db.update(products).set({
            isActive: false,
            updatedAt: new Date()
        }).where(eq(products.id, id)).returning();

        return success(c, deletedProduct, "Product deactivate successfully");

    } catch (err) {
        logger.error({ error: err }, "Failed to delete product");
        return errorResponse(c, "Failed to delete product", 500);
    }
}

// PATCH /products/:id/activate
export async function activateProduct(c: Context) {
    try {
        const id = c.req.param("id");

        const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
        if (!existing) {
            return errorResponse(c, "Product not found", 404);
        }

        const [activatedProduct] = await db.update(products).set({
            isActive: true,
            updatedAt: new Date()
        }).where(eq(products.id, id)).returning();

        return success(c, activatedProduct, "Product activated successfully");

    } catch (err) {
        logger.error({ error: err }, "Failed to activate product");
        return errorResponse(c, "Failed to activate product", 500);
    }
}

import { Hono } from "hono";

import {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    activateProduct
} from "../controllers/product.controller.js";
import {
    verifyTokenMiddleware,
    requireRole,
} from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const productRoutes = new Hono();

// Auth Middleware for all product routes
// Ideally we can apply verify to all, but let's be explicit per route group if needed.
// Actually, KASIR needs read access.

// Read-only access for KASIR (and implicitly OWNER/ADMIN too as they should be included)
// But requireRole takes an array of allowed roles.
const readAccess = requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]);
const writeAccess = requireRole([Role.OWNER, Role.ADMIN]);

// Public routes - no authentication required
productRoutes.get("/", getAllProducts);
productRoutes.get("/:id", getProductById);

productRoutes.post("/", verifyTokenMiddleware, writeAccess, createProduct);
productRoutes.put("/:id", verifyTokenMiddleware, writeAccess, updateProduct);
productRoutes.delete("/:id", verifyTokenMiddleware, writeAccess, deleteProduct);
productRoutes.patch("/:id/activate", verifyTokenMiddleware, writeAccess, activateProduct);

export default productRoutes;

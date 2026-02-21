import { Hono } from "hono";

import {
  getAllProductCategories,
  getProductCategoryById,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
  activateProductCategory,
} from "../controllers/product-category.controller.js";
import {
  verifyTokenMiddleware,
  requireRole,
} from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const productCategoryRoutes = new Hono();

// Public routes
productCategoryRoutes.get("/", getAllProductCategories);
productCategoryRoutes.get("/:id", getProductCategoryById);

// Protected routes (OWNER & ADMIN only)
const adminOnly = requireRole([Role.OWNER, Role.ADMIN]);

productCategoryRoutes.post(
  "/",
  verifyTokenMiddleware,
  adminOnly,
  createProductCategory
);

productCategoryRoutes.put(
  "/:id",
  verifyTokenMiddleware,
  adminOnly,
  updateProductCategory
);

productCategoryRoutes.delete(
  "/:id",
  verifyTokenMiddleware,
  adminOnly,
  deleteProductCategory
);

productCategoryRoutes.patch(
  "/:id/activate",
  verifyTokenMiddleware,
  adminOnly,
  activateProductCategory
);

export default productCategoryRoutes;

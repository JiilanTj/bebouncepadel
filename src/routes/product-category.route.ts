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

// Protected routes
const manageAccess = requireRole([Role.OWNER, Role.ADMIN, Role.INPUTER]);
const deleteAccess = requireRole([Role.OWNER, Role.ADMIN]);

productCategoryRoutes.post(
  "/",
  verifyTokenMiddleware,
  manageAccess,
  createProductCategory
);

productCategoryRoutes.put(
  "/:id",
  verifyTokenMiddleware,
  manageAccess,
  updateProductCategory
);

productCategoryRoutes.delete(
  "/:id",
  verifyTokenMiddleware,
  deleteAccess,
  deleteProductCategory
);

productCategoryRoutes.patch(
  "/:id/activate",
  verifyTokenMiddleware,
  manageAccess,
  activateProductCategory
);

export default productCategoryRoutes;

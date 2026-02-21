import { Hono } from "hono";

import {
  getAllMenuCategories,
  getMenuCategoryById,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  activateMenuCategory,
} from "../controllers/menu-category.controller.js";
import {
  verifyTokenMiddleware,
  requireRole,
} from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const menuCategoryRoutes = new Hono();

// Public routes
menuCategoryRoutes.get("/", getAllMenuCategories);
menuCategoryRoutes.get("/:id", getMenuCategoryById);

// Protected routes (OWNER & ADMIN only)
const adminOnly = requireRole([Role.OWNER, Role.ADMIN]);

menuCategoryRoutes.post(
  "/",
  verifyTokenMiddleware,
  adminOnly,
  createMenuCategory
);

menuCategoryRoutes.put(
  "/:id",
  verifyTokenMiddleware,
  adminOnly,
  updateMenuCategory
);

menuCategoryRoutes.delete(
  "/:id",
  verifyTokenMiddleware,
  adminOnly,
  deleteMenuCategory
);

menuCategoryRoutes.patch(
  "/:id/activate",
  verifyTokenMiddleware,
  adminOnly,
  activateMenuCategory
);

export default menuCategoryRoutes;

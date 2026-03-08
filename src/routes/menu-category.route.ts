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

// Protected routes
const manageAccess = requireRole([Role.OWNER, Role.ADMIN, Role.INPUTER]);
const deleteAccess = requireRole([Role.OWNER, Role.ADMIN]);

menuCategoryRoutes.post(
  "/",
  verifyTokenMiddleware,
  manageAccess,
  createMenuCategory
);

menuCategoryRoutes.put(
  "/:id",
  verifyTokenMiddleware,
  manageAccess,
  updateMenuCategory
);

menuCategoryRoutes.delete(
  "/:id",
  verifyTokenMiddleware,
  deleteAccess,
  deleteMenuCategory
);

menuCategoryRoutes.patch(
  "/:id/activate",
  verifyTokenMiddleware,
  manageAccess,
  activateMenuCategory
);

export default menuCategoryRoutes;

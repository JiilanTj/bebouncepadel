import { Hono } from "hono";

import {
  getAllMenus,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
  activateMenu,
} from "../controllers/menu.controller.js";
import {
  verifyTokenMiddleware,
  requireRole,
} from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const menuRoutes = new Hono();

// Role-based access control
const readAccess = requireRole([Role.OWNER, Role.ADMIN, Role.INPUTER, Role.KASIR]);
const manageAccess = requireRole([Role.OWNER, Role.ADMIN, Role.INPUTER]);
const deleteAccess = requireRole([Role.OWNER, Role.ADMIN]);

// Public routes - no authentication required (read-only)
menuRoutes.get("/", getAllMenus);
menuRoutes.get("/:id", getMenuById);

// Protected routes - authentication required (write operations)
menuRoutes.post("/", verifyTokenMiddleware, manageAccess, createMenu);
menuRoutes.put("/:id", verifyTokenMiddleware, manageAccess, updateMenu);
menuRoutes.delete("/:id", verifyTokenMiddleware, deleteAccess, deleteMenu);
menuRoutes.patch("/:id/activate", verifyTokenMiddleware, manageAccess, activateMenu);

export default menuRoutes;

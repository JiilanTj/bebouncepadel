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
const readAccess = requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]);
const writeAccess = requireRole([Role.OWNER, Role.ADMIN]);

// Public routes - no authentication required (read-only)
menuRoutes.get("/", getAllMenus);
menuRoutes.get("/:id", getMenuById);

// Protected routes - authentication required (write operations)
menuRoutes.post("/", verifyTokenMiddleware, writeAccess, createMenu);
menuRoutes.put("/:id", verifyTokenMiddleware, writeAccess, updateMenu);
menuRoutes.delete("/:id", verifyTokenMiddleware, writeAccess, deleteMenu);
menuRoutes.patch("/:id/activate", verifyTokenMiddleware, writeAccess, activateMenu);

export default menuRoutes;

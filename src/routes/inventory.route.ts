import { Hono } from "hono";

import {
  getAllInventories,
  getInventoryById,
  createInventory,
  updateInventory,
  adjustInventoryStock,
  deleteInventory,
} from "../controllers/inventory.controller.js";
import {
  verifyTokenMiddleware,
  requireRole,
} from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const inventoryRoutes = new Hono();

// Role-based access control
const ownerAdminAccess = requireRole([Role.OWNER, Role.ADMIN]);
const allStaffAccess = requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]);

// All routes require authentication
inventoryRoutes.use(verifyTokenMiddleware);

// All staff can read inventories
inventoryRoutes.get("/", allStaffAccess, getAllInventories);
inventoryRoutes.get("/:id", allStaffAccess, getInventoryById);

// OWNER/ADMIN can create, update, adjust, and delete
inventoryRoutes.post("/", ownerAdminAccess, createInventory);
inventoryRoutes.put("/:id", ownerAdminAccess, updateInventory);
inventoryRoutes.patch("/:id/adjust", ownerAdminAccess, adjustInventoryStock);
inventoryRoutes.delete("/:id", ownerAdminAccess, deleteInventory);

export default inventoryRoutes;

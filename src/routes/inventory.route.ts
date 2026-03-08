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
const deleteAccess = requireRole([Role.OWNER, Role.ADMIN]);
const manageAccess = requireRole([Role.OWNER, Role.ADMIN, Role.INPUTER]);
const allStaffAccess = requireRole([Role.OWNER, Role.ADMIN, Role.INPUTER, Role.KASIR]);

// All routes require authentication
inventoryRoutes.use(verifyTokenMiddleware);

// All staff can read inventories
inventoryRoutes.get("/", allStaffAccess, getAllInventories);
inventoryRoutes.get("/:id", allStaffAccess, getInventoryById);

// OWNER/ADMIN/INPUTER can create, update, adjust
inventoryRoutes.post("/", manageAccess, createInventory);
inventoryRoutes.put("/:id", manageAccess, updateInventory);
inventoryRoutes.patch("/:id/adjust", manageAccess, adjustInventoryStock);
// Delete is OWNER/ADMIN only
inventoryRoutes.delete("/:id", deleteAccess, deleteInventory);

export default inventoryRoutes;

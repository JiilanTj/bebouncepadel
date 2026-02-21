import { Hono } from "hono";

import {
  getAllTables,
  getTableById,
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable,
  activateTable,
} from "../controllers/table.controller.js";
import {
  verifyTokenMiddleware,
  requireRole,
} from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const tableRoutes = new Hono();

// Role-based access control
const ownerAdminAccess = requireRole([Role.OWNER, Role.ADMIN]);
const allStaffAccess = requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]);

// Public routes - no authentication required
// (If you want tables to be public, otherwise change to allStaffAccess)
tableRoutes.get("/", getAllTables);
tableRoutes.get("/:id", getTableById);

// Protected routes - OWNER/ADMIN only
// Table master data management
tableRoutes.post("/", verifyTokenMiddleware, ownerAdminAccess, createTable);
tableRoutes.put("/:id", verifyTokenMiddleware, ownerAdminAccess, updateTable);
tableRoutes.delete("/:id", verifyTokenMiddleware, ownerAdminAccess, deleteTable);
tableRoutes.patch("/:id/activate", verifyTokenMiddleware, ownerAdminAccess, activateTable);

// KASIR can update table status (occupancy management)
tableRoutes.patch("/:id/status", verifyTokenMiddleware, allStaffAccess, updateTableStatus);

export default tableRoutes;

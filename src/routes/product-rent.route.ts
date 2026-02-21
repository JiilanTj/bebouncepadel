import { Hono } from "hono";

import {
  getAllRentRecords,
  getRentRecordById,
  getRentRecordsByProduct,
  getRentRecordsByTransaction,
  getActiveRentals,
  returnRentRecord,
  getProductRentStats,
} from "../controllers/product-rent.controller.js";
import {
  verifyTokenMiddleware,
  requireRole,
} from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const productRentRoutes = new Hono();

// All routes require authentication
productRentRoutes.use(verifyTokenMiddleware);

// All staff can read rent records
const allStaffAccess = requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]);

// OWNER/ADMIN can return rentals
const ownerAdminAccess = requireRole([Role.OWNER, Role.ADMIN]);

productRentRoutes.get("/", allStaffAccess, getAllRentRecords);
productRentRoutes.get("/active", allStaffAccess, getActiveRentals);
productRentRoutes.get("/:id", allStaffAccess, getRentRecordById);
productRentRoutes.get("/product/:productId", allStaffAccess, getRentRecordsByProduct);
productRentRoutes.get("/product/:productId/stats", allStaffAccess, getProductRentStats);
productRentRoutes.get("/transaction/:transactionId", allStaffAccess, getRentRecordsByTransaction);
productRentRoutes.patch("/:id/return", ownerAdminAccess, returnRentRecord);

export default productRentRoutes;

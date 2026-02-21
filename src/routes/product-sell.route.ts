import { Hono } from "hono";

import {
  getAllSellRecords,
  getSellRecordById,
  getSellRecordsByProduct,
  getSellRecordsByTransaction,
  getProductSellStats,
} from "../controllers/product-sell.controller.js";
import {
  verifyTokenMiddleware,
  requireRole,
} from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const productSellRoutes = new Hono();

// All routes require authentication
productSellRoutes.use(verifyTokenMiddleware);

// All staff can read sell records
const allStaffAccess = requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]);

productSellRoutes.get("/", allStaffAccess, getAllSellRecords);
productSellRoutes.get("/:id", allStaffAccess, getSellRecordById);
productSellRoutes.get("/product/:productId", allStaffAccess, getSellRecordsByProduct);
productSellRoutes.get("/product/:productId/stats", allStaffAccess, getProductSellStats);
productSellRoutes.get("/transaction/:transactionId", allStaffAccess, getSellRecordsByTransaction);

export default productSellRoutes;

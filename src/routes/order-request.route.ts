import { Hono } from "hono";

import {
    validateTableQr,
    createOrderRequest,
    getAllOrderRequests,
    getOrderRequestById,
    updateOrderRequestStatus,
} from "../controllers/order-request.controller.js";
import {
    verifyTokenMiddleware,
    requireRole,
} from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const orderRequestRoutes = new Hono();

// Role-based access control
const staffAccess = requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]);

// Public routes - no authentication required
orderRequestRoutes.post("/validate-table", validateTableQr);
orderRequestRoutes.post("/", createOrderRequest);

// Protected routes - staff only
orderRequestRoutes.get("/", verifyTokenMiddleware, staffAccess, getAllOrderRequests);
orderRequestRoutes.get("/:id", verifyTokenMiddleware, staffAccess, getOrderRequestById);
orderRequestRoutes.patch("/:id/status", verifyTokenMiddleware, staffAccess, updateOrderRequestStatus);

export default orderRequestRoutes;

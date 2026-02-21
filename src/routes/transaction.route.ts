import { Hono } from "hono";

import {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  cancelTransaction,
  completeTransaction,
  payTransaction,
} from "../controllers/transaction.controller.js";
import {
  verifyTokenMiddleware,
  requireRole,
} from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const transactionRoutes = new Hono();

// Role-based access control
const ownerAdminAccess = requireRole([Role.OWNER, Role.ADMIN]);
const kasirAccess = requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]);

// All transaction routes require authentication
transactionRoutes.use(verifyTokenMiddleware);

// KASIR can create and read transactions
transactionRoutes.post("/", kasirAccess, createTransaction);
transactionRoutes.get("/", kasirAccess, getAllTransactions);
transactionRoutes.get("/:id", kasirAccess, getTransactionById);

// Only OWNER/ADMIN can cancel and complete transactions
transactionRoutes.patch("/:id/cancel", ownerAdminAccess, cancelTransaction);
transactionRoutes.patch("/:id/complete", ownerAdminAccess, completeTransaction);
transactionRoutes.patch("/:id/pay", kasirAccess, payTransaction);

export default transactionRoutes;

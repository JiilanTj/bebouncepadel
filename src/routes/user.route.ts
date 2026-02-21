import { Hono } from "hono";

import {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
} from "../controllers/user.controller.js";
import { verifyTokenMiddleware, requireRole } from "../middleware/auth.middleware.js";

const userRoutes = new Hono();

// All routes require authentication
userRoutes.use("*", verifyTokenMiddleware);

// GET / - List all users (OWNER, ADMIN)
userRoutes.get("/", requireRole(["OWNER", "ADMIN"]), getUsers);

// POST / - Create new user (OWNER only)
userRoutes.post("/", requireRole(["OWNER"]), createUser);

// PATCH /:id - Update user (OWNER only)
// Note: Ideally users should be able to update their own profile, but instructions say "Owner only can create and edit".
// Stick to OWNER only for management for now.
userRoutes.patch("/:id", requireRole(["OWNER"]), updateUser);

// DELETE /:id - Delete user (OWNER only)
userRoutes.delete("/:id", requireRole(["OWNER"]), deleteUser);

export default userRoutes;

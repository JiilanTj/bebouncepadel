import { eq, desc } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";

import { db } from "../db/index.js";
import { users, type Role } from "../db/schema.js";
import { hashPassword } from "../lib/hash.js";
import { success, error } from "../lib/response.js";

// Validation schemas
const createUserSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["OWNER", "ADMIN", "KASIR"]).default("ADMIN"),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(), // If status exists in schema, wait checked schema, users table doesn't have status column yet? Re-checking schema...
    // Schema check: users table: id, name, email, password, role, createdAt. No status.
    // OK, will stick to schema.
});

const updateUserSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    email: z.string().email("Invalid email format").optional(),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
    role: z.enum(["OWNER", "ADMIN", "KASIR"]).optional(),
});

export async function getUsers(c: Context) {
    try {
        const allUsers = await db.query.users.findMany({
            orderBy: [desc(users.createdAt)],
            columns: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        return success(c, allUsers, "Users fetched successfully");
    } catch (err) {
        console.error("Get users error:", err);
        return error(c, "Internal server error", 500);
    }
}

export async function createUser(c: Context) {
    try {
        const body = await c.req.json();
        const validation = createUserSchema.safeParse(body);

        if (!validation.success) {
            return error(c, "Validation error", 400, validation.error.flatten().fieldErrors);
        }

        const { name, email, password, role } = validation.data;

        // Check existing email
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (existingUser) {
            return error(c, "Email already registered", 409);
        }

        const hashedPassword = await hashPassword(password);

        const [newUser] = await db
            .insert(users)
            .values({
                name,
                email,
                password: hashedPassword,
                role: role as Role,
            })
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                createdAt: users.createdAt,
            });

        return success(c, newUser, "User created successfully", 201);
    } catch (err) {
        console.error("Create user error:", err);
        return error(c, "Internal server error", 500);
    }
}

export async function updateUser(c: Context) {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        const validation = updateUserSchema.safeParse(body);

        if (!validation.success) {
            return error(c, "Validation error", 400, validation.error.flatten().fieldErrors);
        }

        const { name, email, password, role } = validation.data;

        // Check if user exists
        const userToUpdate = await db.query.users.findFirst({
            where: eq(users.id, id),
        });

        if (!userToUpdate) {
            return error(c, "User not found", 404);
        }

        // Prepare update data
        const updateData: Partial<typeof users.$inferInsert> = {};
        if (name) updateData.name = name;
        if (email) {
            // Check if email is taken by another user
            const existingEmail = await db.query.users.findFirst({
                where: eq(users.email, email),
            });
            if (existingEmail && existingEmail.id !== id) {
                return error(c, "Email already in use", 409);
            }
            updateData.email = email;
        }
        if (password) {
            updateData.password = await hashPassword(password);
        }
        if (role) updateData.role = role as Role;

        if (Object.keys(updateData).length === 0) {
            return success(c, userToUpdate, "No changes made");
        }

        const [updatedUser] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, id))
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                createdAt: users.createdAt,
            });

        return success(c, updatedUser, "User updated successfully");
    } catch (err) {
        console.error("Update user error:", err);
        return error(c, "Internal server error", 500);
    }
}

export async function deleteUser(c: Context) {
    try {
        const id = c.req.param("id");
        const currentUser = c.get("user"); // Context user from auth middleware

        // Prevent deleting self
        if (currentUser && currentUser.id === id) {
            return error(c, "Cannot delete your own account", 403);
        }

        const [deletedUser] = await db
            .delete(users)
            .where(eq(users.id, id))
            .returning({
                id: users.id,
                name: users.name,
            });

        if (!deletedUser) {
            return error(c, "User not found", 404);
        }

        return success(c, deletedUser, "User deleted successfully");
    } catch (err) {
        console.error("Delete user error:", err);
        return error(c, "Internal server error", 500);
    }
}

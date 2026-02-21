import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";

import { db } from "../db/index.js";
import { users, type Role } from "../db/schema.js";
import { hashPassword, comparePassword } from "../lib/hash.js";
import { signToken } from "../lib/jwt.js";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["OWNER", "ADMIN", "KASIR"]).optional().default("ADMIN"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

interface RegisterBody {
  name: string;
  email: string;
  password: string;
  role?: Role;
}

interface LoginBody {
  email: string;
  password: string;
}

export async function register(c: Context) {
  try {
    const body = await c.req.json<RegisterBody>();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          message: "Validation error",
          errors: validation.error.flatten().fieldErrors,
        },
        400
      );
    }

    const { name, email, password, role } = validation.data;

    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return c.json({ message: "Email already registered" }, 409);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        role,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    return c.json(
      {
        message: "User registered successfully",
        user: newUser,
      },
      201
    );
  } catch (error) {
    console.error("Register error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
}

export async function login(c: Context) {
  try {
    const body = await c.req.json<LoginBody>();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          message: "Validation error",
          errors: validation.error.flatten().fieldErrors,
        },
        400
      );
    }

    const { email, password } = validation.data;

    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return c.json({ message: "Invalid credentials" }, 401);
    }

    // Compare password
    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
      return c.json({ message: "Invalid credentials" }, 401);
    }

    // Generate JWT
    const accessToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return c.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
}

export async function logout(c: Context) {
  // JWT is stateless, just return success
  // Client should delete the token
  return c.json({
    message: "Logout successful",
  });
}

import type { Context, Next } from "hono";

import { verifyToken } from "../lib/jwt.js";
import type { JWTPayload } from "../lib/jwt.js";
import type { Role } from "../db/schema.js";

interface HonoContext {
  Variables: {
    user: JWTPayload;
  };
}

export async function verifyTokenMiddleware(
  c: Context<HonoContext>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ message: "Unauthorized - Token required" }, 401);
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    return c.json({ message: "Unauthorized - Invalid token" }, 401);
  }

  c.set("user", payload);
  await next();
}

export async function verifyOptionalTokenMiddleware(
  c: Context<HonoContext>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      c.set("user", payload);
    }
  }
  await next();
}

export function requireRole(allowedRoles: Role[]) {
  return async function roleMiddleware(c: Context<HonoContext>, next: Next) {
    const user = c.get("user");

    if (!user) {
      return c.json({ message: "Unauthorized - User not authenticated" }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json(
        { message: "Forbidden - Insufficient permissions" },
        403
      );
    }

    await next();
  };
}

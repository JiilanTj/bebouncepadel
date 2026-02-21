import { Hono } from "hono";
import type { Context, Next } from "hono";
import {
  sseNotifications,
  getAllNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notification.controller.js";
import { verifyTokenMiddleware } from "../middleware/auth.middleware.js";
import { verifyToken } from "../lib/jwt.js";

const notificationRoutes = new Hono();

// Custom SSE auth middleware that supports token in query param
async function sseAuthMiddleware(c: Context, next: Next) {
  // Try header first
  let authHeader = c.req.header("Authorization");
  
  // If no header, try query param (for EventSource compatibility)
  if (!authHeader) {
    const token = c.req.query("token");
    if (token) {
      authHeader = `Bearer ${token}`;
    }
  }

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

// SSE endpoint for real-time notifications
notificationRoutes.get("/sse", sseAuthMiddleware, sseNotifications);

// Protected routes
notificationRoutes.use("/*", verifyTokenMiddleware);

// Get all notifications
notificationRoutes.get("/", getAllNotifications);

// Get unread count
notificationRoutes.get("/unread-count", getUnreadCount);

// Mark as read
notificationRoutes.patch("/:id/read", markAsRead);

// Mark all as read
notificationRoutes.patch("/read-all", markAllAsRead);

// Delete notification
notificationRoutes.delete("/:id", deleteNotification);

export default notificationRoutes;

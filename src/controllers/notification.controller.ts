import { eq, and, desc, sql } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "../db/index.js";
import { notifications, NotificationType } from "../db/schema.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";

// Store connected SSE clients
const sseClients = new Map<string, { userId: string | null; controller: ReadableStreamDefaultController }>();

// Generate unique client ID
function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Broadcast notification to all connected clients
export function broadcastNotification(notification: unknown) {
  const data = JSON.stringify({ type: "notification", data: notification });
  sseClients.forEach((client) => {
    try {
      client.controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
    } catch (err) {
      logger.error({ error: err }, "Failed to send SSE to client");
    }
  });
}

// GET /notifications/sse - SSE endpoint for real-time notifications
export async function sseNotifications(c: Context) {
  const user = c.get("user");
  const clientId = generateClientId();

  // Use a simple approach with Bun's SSE
  let pingInterval: Timer | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Store client connection
      sseClients.set(clientId, { userId: user?.userId || null, controller });

      // Send initial connection message
      const sendEvent = (data: unknown) => {
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(message));
        } catch {
          return false;
        }
        return true;
      };

      if (!sendEvent({ type: "connected", clientId })) {
        sseClients.delete(clientId);
        return;
      }

      logger.info({ clientId, userId: user?.userId }, "SSE client connected");

      // Keep connection alive with comment lines (less overhead)
      pingInterval = setInterval(() => {
        try {
          // Send comment line as heartbeat (ignored by EventSource but keeps connection alive)
          controller.enqueue(new TextEncoder().encode(`:heartbeat\n\n`));
        } catch {
          if (pingInterval) clearInterval(pingInterval);
          sseClients.delete(clientId);
        }
      }, 5000); // Every 5 seconds

      // Clean up on close
      c.req.raw.signal.addEventListener("abort", () => {
        if (pingInterval) clearInterval(pingInterval);
        sseClients.delete(clientId);
        logger.info({ clientId }, "SSE client disconnected");
      });
    },
    cancel() {
      if (pingInterval) clearInterval(pingInterval);
      sseClients.delete(clientId);
      logger.info({ clientId }, "SSE client cancelled");
    },
  });

  return c.body(stream, 200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // Penting buat Nginx biar gak di-buffer
  });
}

// GET /notifications
export async function getAllNotifications(c: Context) {
  try {
    const user = c.get("user");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const unreadOnly = c.req.query("unread") === "true";

    const offset = (page - 1) * limit;

    const conditions = [];

    // Filter by user (null userId = broadcast to all)
    if (user?.userId) {
      conditions.push(
        sql`${notifications.userId} IS NULL OR ${notifications.userId} = ${user.userId}`
      );
    }

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db.query.notifications.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(notifications.createdAt)],
    });

    const totalRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(whereClause);
    const total = totalRes[0]?.count ?? 0;

    // Get unread count
    const unreadRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.isRead, false),
          user?.userId
            ? sql`${notifications.userId} IS NULL OR ${notifications.userId} = ${user.userId}`
            : undefined
        )
      );
    const unreadCount = unreadRes[0]?.count ?? 0;

    return success(c, {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    });
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch notifications");
    return errorResponse(c, "Failed to fetch notifications", 500);
  }
}

// GET /notifications/unread-count
export async function getUnreadCount(c: Context) {
  try {
    const user = c.get("user");

    const conditions = [eq(notifications.isRead, false)];

    if (user?.userId) {
      conditions.push(
        sql`${notifications.userId} IS NULL OR ${notifications.userId} = ${user.userId}`
      );
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...conditions));

    const count = result[0]?.count ?? 0;

    return success(c, { count });
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch unread count");
    return errorResponse(c, "Failed to fetch unread count", 500);
  }
}

// PATCH /notifications/:id/read
export async function markAsRead(c: Context) {
  try {
    const id = c.req.param("id");
    const user = c.get("user");

    const notification = await db.query.notifications.findFirst({
      where: eq(notifications.id, id),
    });

    if (!notification) {
      return errorResponse(c, "Notification not found", 404);
    }

    // Check if user can access this notification
    if (notification.userId && notification.userId !== user?.userId) {
      return errorResponse(c, "Unauthorized", 403);
    }

    const [updated] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning();

    return success(c, updated, "Notification marked as read");
  } catch (err) {
    logger.error({ error: err }, "Failed to mark notification as read");
    return errorResponse(c, "Failed to mark notification as read", 500);
  }
}

// PATCH /notifications/read-all
export async function markAllAsRead(c: Context) {
  try {
    const user = c.get("user");

    const conditions = [eq(notifications.isRead, false)];

    if (user?.userId) {
      conditions.push(
        sql`${notifications.userId} IS NULL OR ${notifications.userId} = ${user.userId}`
      );
    }

    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(...conditions));

    return success(c, null, "All notifications marked as read");
  } catch (err) {
    logger.error({ error: err }, "Failed to mark all notifications as read");
    return errorResponse(c, "Failed to mark all notifications as read", 500);
  }
}

// DELETE /notifications/:id
export async function deleteNotification(c: Context) {
  try {
    const id = c.req.param("id");
    const user = c.get("user");

    const notification = await db.query.notifications.findFirst({
      where: eq(notifications.id, id),
    });

    if (!notification) {
      return errorResponse(c, "Notification not found", 404);
    }

    // Check if user can delete this notification
    if (notification.userId && notification.userId !== user?.userId) {
      return errorResponse(c, "Unauthorized", 403);
    }

    await db.delete(notifications).where(eq(notifications.id, id));

    return success(c, null, "Notification deleted");
  } catch (err) {
    logger.error({ error: err }, "Failed to delete notification");
    return errorResponse(c, "Failed to delete notification", 500);
  }
}

// Helper function to create notification (used by other controllers)
export async function createNotification({
  type,
  title,
  message,
  data,
  userId,
  orderRequestId,
}: {
  type: typeof NotificationType[keyof typeof NotificationType];
  title: string;
  message: string;
  data?: Record<string, unknown>;
  userId?: string;
  orderRequestId?: string;
}) {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
        userId: userId || null,
        orderRequestId: orderRequestId || null,
        isRead: false,
      })
      .returning();

    // Broadcast to connected SSE clients
    broadcastNotification(notification);

    return notification;
  } catch (err) {
    logger.error({ error: err }, "Failed to create notification");
    return null;
  }
}

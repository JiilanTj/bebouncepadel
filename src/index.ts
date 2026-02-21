import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger as honoLogger } from "hono/logger";

import { checkConnection, closeConnection } from "./db/index.js";
import apiV1 from "./routes/api/v1/index.js";
import { seedOwner } from "./seed/owner.seed.js";
import {
  logger,
  createHonoLogger,
  success,
  error as errorResponse,
  handleError,
  AppError,
} from "./lib/index.js";

const app = new Hono({ strict: false });
const PORT = Number(process.env.PORT) || 3000;

app.use(honoLogger());
app.use(createHonoLogger());

app.use(
  cors({
    origin: (origin) => {
      const allowed = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
        : [
          "http://localhost:3000",
          "http://localhost:5173",
          "https://demobouncepadelvtwo.sapacode.id",
          "http://demobouncepadelvtwo.sapacode.id",
          "https://bouncepadel.id",
          "http://bouncepadel.id/",
          "http://www.bouncepadel.id/",
          "https://www.bouncepadel.id/"
        ];
      // If origin is undefined (non-browser), allow all
      if (!origin) return allowed[0];
      // Allow if matches any allowed origin
      return allowed.includes(origin) ? origin : "";
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Type"],
    credentials: true,
  })
);

// Root - API Documentation
app.get("/", (c) => {
  return success(c, {
    name: "bebouncepadel API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    documentation: "/api/v1",
    timestamp: new Date().toISOString(),
  }, "Welcome to bebouncepadel API");
});

// API v1 Routes
app.route("/api/v1", apiV1);

// 404 handler
app.notFound((c) => {
  return errorResponse(c, "Route not found", 404);
});

// Error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return errorResponse(c, err.message, err.status as unknown as 500);
  }

  if (err instanceof AppError) {
    return errorResponse(c, err.message, err.statusCode as unknown as 500);
  }

  const handledError = handleError(err);
  logger.error(
    { error: handledError.message, stack: handledError.stack },
    "Unhandled error"
  );

  return errorResponse(c, "Internal server error", 500);
});

async function startServer() {
  try {
    logger.info("Starting bebouncepadel server...");

    // Check database connection
    const dbConnected = await checkConnection();
    if (!dbConnected) {
      logger.error("Database not connected, cannot start server");
      process.exit(1);
    }

    // Seed default owner
    await seedOwner();

    // Start server
    const server = Bun.serve({
      port: PORT,
      fetch: app.fetch,
    });

    logger.info(`🚀 Server running at http://localhost:${PORT}`);
    logger.info(`📚 API Documentation: http://localhost:${PORT}/api/v1`);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, "Received signal, shutting down gracefully...");
      await closeConnection();
      server.stop();
      process.exit(0);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (err) {
    logger.error({ error: err }, "Failed to start server");
    await closeConnection();
    process.exit(1);
  }
}

startServer();

export type AppType = typeof app;

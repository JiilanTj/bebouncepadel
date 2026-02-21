import { Hono, type Context } from "hono";

import authRoutes from "../../auth.route.js";
import uploadRoutes from "../../upload.route.js";
import productCategoryRoutes from "../../product-category.route.js";
import menuCategoryRoutes from "../../menu-category.route.js";
import productRoutes from "../../product.route.js";
import menuRoutes from "../../menu.route.js";
import tableRoutes from "../../table.route.js";
import transactionRoutes from "../../transaction.route.js";
import productSellRoutes from "../../product-sell.route.js";
import productRentRoutes from "../../product-rent.route.js";
import inventoryRoutes from "../../inventory.route.js";
import userRoutes from "../../user.route";
import settingsRoutes from "../../settings.route";
import facilitiesRoutes from "../../facilities.route";
import courtsRoutes from "../../courts.route";
import bookingRoutes from "../../booking.route";
import statsRoutes from "../../stats.route";
import orderRequestRoutes from "../../order-request.route.js";
import notificationRoutes from "../../notification.route.js";
import { checkConnection } from "../../../db/index.js";
import { success } from "../../../lib/index.js";

const apiV1 = new Hono();

const apiInfoHandler = (c: Context) => {
  return success(c, {
    name: "bebouncepadel API",
    version: "v1.0.0",
    baseUrl: "/api/v1",
    endpoints: ["/auth", "/upload", "/product-categories", "/menu-categories", "/products", "/menus", "/tables", "/transactions", "/product-sells", "/product-rents", "/inventories", "/health", "/bookings", "/stats", "/order-requests", "/notifications"],
  }, "Welcome to bebouncepadel API v1");
};

// API Info - handle both "/" and ""
apiV1.get("", apiInfoHandler);
apiV1.get("/", apiInfoHandler);

// Health check
apiV1.get("/health", async (c) => {
  const dbConnected = await checkConnection();

  return success(
    c,
    {
      status: "healthy",
      database: dbConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    },
    "Health check",
    dbConnected ? 200 : 503
  );
});

// Auth routes
apiV1.route("/auth", authRoutes);

// Upload routes
apiV1.route("/upload", uploadRoutes);

// Category routes
apiV1.route("/product-categories", productCategoryRoutes);
apiV1.route("/menu-categories", menuCategoryRoutes);

// Product routes
apiV1.route("/products", productRoutes);

// Menu routes
apiV1.route("/menus", menuRoutes);

// Table routes
apiV1.route("/tables", tableRoutes);

// Transaction routes
apiV1.route("/transactions", transactionRoutes);

// Product Sell routes
apiV1.route("/product-sells", productSellRoutes);

// Product Rent routes
apiV1.route("/product-rents", productRentRoutes);

// Inventory routes
apiV1.route("/inventories", inventoryRoutes);

// User routes
apiV1.route("/users", userRoutes);
apiV1.route("/settings", settingsRoutes);
apiV1.route("/facilities", facilitiesRoutes);
apiV1.route("/courts", courtsRoutes);
apiV1.route("/bookings", bookingRoutes);
apiV1.route("/stats", statsRoutes);
apiV1.route("/order-requests", orderRequestRoutes);
apiV1.route("/notifications", notificationRoutes);

export default apiV1;

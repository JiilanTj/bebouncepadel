import { Hono } from "hono";

import { getDashboardStats, getReportsStats, exportReports } from "../controllers/stats.controller.js";
import { verifyTokenMiddleware } from "../middleware/auth.middleware.js";

const statsRoutes = new Hono();

// All stats routes require authentication
statsRoutes.use("*", verifyTokenMiddleware);

statsRoutes.get("/dashboard", getDashboardStats);
statsRoutes.get("/reports", getReportsStats);
statsRoutes.get("/export", exportReports);

export default statsRoutes;

import { Hono } from "hono";

import { getSettings, updateSettings } from "../controllers/settings.controller";
import { verifyTokenMiddleware, requireRole } from "../middleware/auth.middleware";
import { Role } from "../db/schema";

const settingsRoutes = new Hono();

// Public: Read settings (used by landing page, footer, etc.)
settingsRoutes.get("/", getSettings);

// Only ADMIN and OWNER can update settings
settingsRoutes.patch("/", verifyTokenMiddleware, requireRole([Role.ADMIN, Role.OWNER]), updateSettings);

export default settingsRoutes;

import { Hono } from "hono";

import {
    getAllCourts,
    getCourtById,
    createCourt,
    updateCourt,
    deleteCourt,
} from "../controllers/courts.controller";
import { syncCourtsWithAyo, getAyoFieldsList } from "../controllers/ayo-sync.controller";
import { verifyTokenMiddleware, requireRole, verifyOptionalTokenMiddleware } from "../middleware/auth.middleware";
import { Role } from "../db/schema";

const courtsRoutes = new Hono();

// Protected: Fetch Ayo.co.id raw fields list (Owner/Admin)
courtsRoutes.get(
    "/ayo-fields",
    verifyTokenMiddleware,
    requireRole([Role.OWNER, Role.ADMIN]),
    getAyoFieldsList
);

// Protected: Sync courts with Ayo.co.id (Owner/Admin)
courtsRoutes.post(
    "/sync-ayo",
    verifyTokenMiddleware,
    requireRole([Role.OWNER, Role.ADMIN]),
    syncCourtsWithAyo
);

// Public: List courts (Admin aware)
courtsRoutes.get("/", verifyOptionalTokenMiddleware, getAllCourts);

// Public: Get single court (Admin aware)
courtsRoutes.get("/:id", verifyOptionalTokenMiddleware, getCourtById);

// Protected: Create (Owner/Admin)
courtsRoutes.post(
    "/",
    verifyTokenMiddleware,
    requireRole([Role.OWNER, Role.ADMIN]),
    createCourt
);

// Protected: Update (Owner/Admin)
courtsRoutes.put(
    "/:id",
    verifyTokenMiddleware,
    requireRole([Role.OWNER, Role.ADMIN]),
    updateCourt
);

// Protected: Delete (Owner/Admin)
courtsRoutes.delete(
    "/:id",
    verifyTokenMiddleware,
    requireRole([Role.OWNER, Role.ADMIN]),
    deleteCourt
);

export default courtsRoutes;


import { Hono } from "hono";

import {
    getAllFacilities,
    getFacilityById,
    createFacility,
    updateFacility,
    deleteFacility,
} from "../controllers/facilities.controller";
import { verifyTokenMiddleware, requireRole } from "../middleware/auth.middleware";
import { Role } from "../db/schema";

const facilitiesRoutes = new Hono();

// Public: List facilities
facilitiesRoutes.get("/", getAllFacilities);

// Protected: Get single facility
facilitiesRoutes.get("/:id", verifyTokenMiddleware, getFacilityById);

// Protected: Create (Owner/Admin)
facilitiesRoutes.post(
    "/",
    verifyTokenMiddleware,
    requireRole([Role.OWNER, Role.ADMIN]),
    createFacility
);

// Protected: Update (Owner/Admin)
facilitiesRoutes.put(
    "/:id",
    verifyTokenMiddleware,
    requireRole([Role.OWNER, Role.ADMIN]),
    updateFacility
);

// Protected: Delete (Owner/Admin)
facilitiesRoutes.delete(
    "/:id",
    verifyTokenMiddleware,
    requireRole([Role.OWNER, Role.ADMIN]),
    deleteFacility
);

export default facilitiesRoutes;

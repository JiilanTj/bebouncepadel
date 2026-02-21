import { Hono } from "hono";

import {
    createBooking,
    getAllBookings,
    getBookingById,
    cancelBooking,
    completeBooking,
    getCourtAvailability
} from "../controllers/booking.controller.js";
import { verifyTokenMiddleware, requireRole } from "../middleware/auth.middleware.js";
import { Role } from "../db/schema.js";

const bookingRoutes = new Hono();

// Public route for guest booking and checking availability
bookingRoutes.post("/", createBooking);
bookingRoutes.get("/availability/:id", getCourtAvailability);

// Protected routes
bookingRoutes.get("/", verifyTokenMiddleware, requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]), getAllBookings);
bookingRoutes.get("/:id", verifyTokenMiddleware, requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]), getBookingById);
bookingRoutes.patch("/:id/cancel", verifyTokenMiddleware, requireRole([Role.OWNER, Role.ADMIN]), cancelBooking);
bookingRoutes.patch("/:id/complete", verifyTokenMiddleware, requireRole([Role.OWNER, Role.ADMIN, Role.KASIR]), completeBooking);

export default bookingRoutes;

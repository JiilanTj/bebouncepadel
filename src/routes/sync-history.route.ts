import { Hono } from "hono";
import { getSyncHistories } from "../controllers/ayo-sync.controller";
import { verifyTokenMiddleware } from "../middleware/auth.middleware";

const syncHistoriesRoute = new Hono();

syncHistoriesRoute.use("*", verifyTokenMiddleware);

// GET /api/v1/sync-history
syncHistoriesRoute.get("/", getSyncHistories);

export default syncHistoriesRoute;

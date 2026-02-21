import { Hono } from "hono";

import { register, login, logout } from "../controllers/auth.controller.js";
import { verifyTokenMiddleware } from "../middleware/auth.middleware.js";

const authRoutes = new Hono();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/logout", verifyTokenMiddleware, logout);

export default authRoutes;

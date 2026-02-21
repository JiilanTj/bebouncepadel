import { Hono } from "hono";

import {
  uploadSingleImage,
  uploadMultipleSizesImage,
  deleteUploadedImage,
} from "../controllers/upload.controller.js";
import { verifyTokenMiddleware } from "../middleware/auth.middleware.js";

const uploadRoutes = new Hono();

// All upload routes require authentication
uploadRoutes.use("*", verifyTokenMiddleware);

// Upload single image
uploadRoutes.post("/image", uploadSingleImage);

// Upload with multiple sizes (large, medium, thumb)
uploadRoutes.post("/image/sizes", uploadMultipleSizesImage);

// Delete image
uploadRoutes.delete("/image", deleteUploadedImage);

export default uploadRoutes;

import type { Context } from "hono";

import {
  uploadImage,
  uploadMultipleSizes,
  deleteImage,
  validateImage,
} from "../utils/file-upload.js";
import { success, error as errorResponse } from "../lib/response.js";
import { logger } from "../lib/logger.js";

export async function uploadSingleImage(c: Context) {
  try {
    const formData = await c.req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return errorResponse(c, "No image file provided", 400);
    }

    // Validate file type
    const validation = validateImage(file.type, file.size);
    if (!validation.valid) {
      return errorResponse(c, validation.error || "Invalid file", 400);
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload
    const result = await uploadImage(buffer, file.name, file.type);

    return success(
      c,
      {
        key: result.key,
        url: result.url,
      },
      "Upload successful",
      201
    );
  } catch (err) {
    logger.error({ error: err }, "Upload failed");
    return errorResponse(
      c,
      err instanceof Error ? err.message : "Upload failed",
      500
    );
  }
}

export async function uploadMultipleSizesImage(c: Context) {
  try {
    const formData = await c.req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return errorResponse(c, "No image file provided", 400);
    }

    // Validate file type
    const validation = validateImage(file.type, file.size);
    if (!validation.valid) {
      return errorResponse(c, validation.error || "Invalid file", 400);
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload multiple sizes
    const result = await uploadMultipleSizes(buffer, file.name, file.type);

    return success(
      c,
      {
        large: result.large,
        medium: result.medium,
        thumb: result.thumb,
      },
      "Upload successful",
      201
    );
  } catch (err) {
    logger.error({ error: err }, "Upload failed");
    return errorResponse(
      c,
      err instanceof Error ? err.message : "Upload failed",
      500
    );
  }
}

export async function deleteUploadedImage(c: Context) {
  try {
    const { key } = await c.req.json<{ key: string }>();

    if (!key) {
      return errorResponse(c, "Image key is required", 400);
    }

    await deleteImage(key);

    return success(c, { key }, "Image deleted successfully");
  } catch (err) {
    logger.error({ error: err }, "Delete failed");
    return errorResponse(
      c,
      err instanceof Error ? err.message : "Delete failed",
      500
    );
  }
}

import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import { r2Client, bucketName, publicUrl } from "../lib/r2.js";
import {
  resizeImage,
  generateFileName,
  generateMultipleSizes,
  validateImage,
} from "../lib/image.js";
import { logger } from "../lib/logger.js";

export interface UploadResult {
  key: string;
  url: string;
}

export interface MultipleUploadResult {
  large: UploadResult;
  medium: UploadResult;
  thumb: UploadResult;
}

export async function uploadImage(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  // Validate
  const validation = validateImage(mimeType, buffer.length);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Resize
  const resizedBuffer = await resizeImage(buffer, { width: 1200, quality: 85 });

  // Generate unique filename
  const key = generateFileName();

  // Upload to R2
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: resizedBuffer,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000",
  });

  await r2Client.send(command);

  const url = publicUrl ? `${publicUrl}/${key}` : key;

  logger.info({ key, size: resizedBuffer.length }, "Image uploaded successfully");

  return { key, url };
}

export async function deleteImage(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await r2Client.send(command);

  logger.info({ key }, "Image deleted successfully");
}

export async function uploadMultipleSizes(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<MultipleUploadResult> {
  // Validate
  const validation = validateImage(mimeType, buffer.length);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate multiple sizes
  const { large, medium, thumb, key } = await generateMultipleSizes(buffer);

  // Extract base path
  const basePath = key.replace(".webp", "");

  // Upload all sizes
  const sizes = [
    { name: "large", buffer: large, suffix: "-large" },
    { name: "medium", buffer: medium, suffix: "-medium" },
    { name: "thumb", buffer: thumb, suffix: "-thumb" },
  ] as const;

  const results: Partial<MultipleUploadResult> = {};

  for (const size of sizes) {
    const sizeKey = `${basePath}${size.suffix}.webp`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: sizeKey,
      Body: size.buffer,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000",
    });

    await r2Client.send(command);

    const url = publicUrl ? `${publicUrl}/${sizeKey}` : sizeKey;
    results[size.name] = { key: sizeKey, url };

    logger.info(
      { key: sizeKey, size: size.buffer.length, variant: size.name },
      "Image variant uploaded"
    );
  }

  return results as MultipleUploadResult;
}

export { validateImage } from "../lib/image.js";

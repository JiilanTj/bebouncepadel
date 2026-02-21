import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

export interface ResizeOptions {
  width: number;
  quality?: number;
}

export async function resizeImage(
  buffer: Buffer,
  options: ResizeOptions
): Promise<Buffer> {
  const { width, quality = 80 } = options;

  return sharp(buffer)
    .resize(width, undefined, {
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({ quality })
    .toBuffer();
}

export function generateFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const id = uuidv4();

  return `uploads/${year}/${month}/${id}.webp`;
}

export function generateMultipleSizes(
  buffer: Buffer
): Promise<{ large: Buffer; medium: Buffer; thumb: Buffer; key: string }> {
  const baseKey = generateFileName();
  
  return Promise.all([
    resizeImage(buffer, { width: 1200, quality: 85 }),
    resizeImage(buffer, { width: 600, quality: 80 }),
    resizeImage(buffer, { width: 300, quality: 75 }),
  ]).then(([large, medium, thumb]) => ({
    large,
    medium,
    thumb,
    key: baseKey,
  }));
}

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImage(
  mimeType: string,
  size: number
): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }

  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

import { z, type ZodSchema, type ZodError } from "zod";

export { z };

export function parseSchema<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function safeParseSchema<T>(schema: ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: formatZodError(result.error) };
}

export function formatZodError(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path]!.push(issue.message);
  }

  return formatted;
}

export const commonSchemas = {
  uuid: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  phone: z.string().regex(/^\+?[\d\s-]{10,}$/),
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
};

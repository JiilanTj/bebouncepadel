import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

interface PaginationMeta extends Record<string, unknown> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function success<T>(
  c: Context,
  data: T,
  message = "Success",
  statusCode: ContentfulStatusCode = 200,
  meta?: Record<string, unknown>
) {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return c.json(response, statusCode);
}

export function paginated<T>(
  c: Context,
  data: T[],
  pagination: { page: number; limit: number; total: number },
  message = "Success"
) {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  return success(c, data, message, 200, meta);
}

export function created<T>(c: Context, data: T, message = "Created successfully") {
  return success(c, data, message, 201);
}

export function noContent(c: Context) {
  return c.body(null, 204);
}

export function error(
  c: Context,
  message = "Error occurred",
  statusCode: ContentfulStatusCode = 500,
  errors?: Record<string, string[]>
) {
  const response: ApiResponse = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return c.json(response, statusCode);
}

export function badRequest(c: Context, message = "Bad request", errors?: Record<string, string[]>) {
  return error(c, message, 400, errors);
}

export function unauthorized(c: Context, message = "Unauthorized") {
  return error(c, message, 401);
}

export function forbidden(c: Context, message = "Forbidden") {
  return error(c, message, 403);
}

export function notFound(c: Context, message = "Not found") {
  return error(c, message, 404);
}

export function conflict(c: Context, message = "Conflict") {
  return error(c, message, 409);
}

export function validationError(c: Context, errors: Record<string, string[]>) {
  return error(c, "Validation failed", 422, errors);
}

export function tooManyRequests(c: Context, message = "Too many requests") {
  return error(c, message, 429);
}

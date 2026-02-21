import type { Context } from "hono";
import pinoLogger from "pino";

const LOG_LEVEL = process.env.LOG_LEVEL || "info";

export const logger = pinoLogger({
  level: LOG_LEVEL,
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
});

export function createHonoLogger() {
  return async (c: Context, next: () => Promise<void>) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    logger.info(
      {
        method: c.req.method,
        url: c.req.url,
        status: c.res.status,
        duration,
        userAgent: c.req.header("user-agent"),
      },
      `${c.req.method} ${c.req.url} - ${c.res.status} - ${duration}ms`
    );
  };
}

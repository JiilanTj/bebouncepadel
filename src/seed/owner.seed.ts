import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../lib/hash.js";
import { logger } from "../lib/logger.js";

const DEFAULT_OWNER = {
  name: "Owner",
  email: "owner@padel.com",
  password: "123456",
  role: "OWNER" as const,
};

export async function seedOwner(): Promise<void> {
  try {
    // Check if owner already exists
    const existingOwner = await db.query.users.findFirst({
      where: eq(users.email, DEFAULT_OWNER.email),
    });

    if (existingOwner) {
      logger.info("Default owner already exists, skipping seed");
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(DEFAULT_OWNER.password);

    // Create default owner
    await db.insert(users).values({
      name: DEFAULT_OWNER.name,
      email: DEFAULT_OWNER.email,
      password: hashedPassword,
      role: DEFAULT_OWNER.role,
    });

    logger.info(
      { email: DEFAULT_OWNER.email },
      "Default owner account created successfully"
    );
  } catch (error) {
    logger.error({ error }, "Failed to seed default owner");
    throw error;
  }
}

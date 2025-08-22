import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const session = getCookie(c, "session");

  if (!session) {
    return c.json({ error: "Unauthorized - No session token" }, 401);
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session),
    });

    if (!user) {
      return c.json({ error: "Unauthorized - Invalid session" }, 401);
    }

    c.set("user", user);
    await next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};

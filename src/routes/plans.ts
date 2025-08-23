import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { plans, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Variables } from "../types";

const plan = new Hono<{ Variables: Variables }>();

plan.use("*", authMiddleware);

// POST /plans --> Save a new plan
plan.post("/", async (c) => {
  const user = c.get("user");
  const { schedule, ageMonths } = await c.req.json();
  const id = nanoid();
  const createdAt = new Date();

  await db.insert(plans).values({
    id,
    userId: user.id,
    markdown: schedule,
    babyAgeMonths: ageMonths,
    createdAt,
  });

  return c.json({ id });
});

plan.get("/check", async (c) => {
  const user = c.get("user");

  const [dbUser] = await db
    .select({
      subscriptionTier: users.subscriptionTier,
      exportCredits: users.exportCredits,
    })
    .from(users)
    .where(eq(users.id, user.id));

  return c.json({
    active: dbUser?.subscriptionTier !== 'free',
    tier: dbUser?.subscriptionTier || 'free',
    exportCredits: dbUser?.exportCredits ?? 0,
  });
});

// GET /plans --> Get all plans for logged-in user
plan.get("/", async (c) => {
  const user = c.get("user");

  const results = await db
    .select()
    .from(plans)
    .where(eq(plans.userId, user.id));

  return c.json({ plans: results });
});

// GET /plans/:id --> Load a single plan by ID
plan.get("/:id", async (c) => {
  const user = c.get("user");
  const { id } = c.req.param();

  const [plan] = await db.select().from(plans).where(eq(plans.id, id));

  if (!plan || plan.userId != user.id) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ plan });
});

export default plan;

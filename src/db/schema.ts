import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isPremium: integer("is_premium").default(0),
  exportCredits: integer("export_credits").default(0),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  subscriptionTier: text("subscription_tier").default("free"),
  subscriptionStatus: text("subscription_status").default("inactive"),
  currentPeriodEnd: timestamp("current_period_end"),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  stripeCustomerIdx: index("stripe_customer_idx").on(table.stripeCustomerId),
}));

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  markdown: text("markdown").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  babyAgeMonths: integer("baby_age_months"),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

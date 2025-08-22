import { Hono } from "hono";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import bcrypt from "bcrypt";
import { setCookie, deleteCookie } from "hono/cookie";
import { customAlphabet } from "nanoid";
import { sendEmail } from "../lib/sendEmail";
import { addMinutes } from "date-fns";

const auth = new Hono();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

auth.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = registerSchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ 
        error: "Validation failed", 
        details: parsed.error.issues 
      }, 400);
    }

    const { email, password } = parsed.data;

    // Check if user already exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (existing) {
      return c.json({ error: "Email already registered" }, 400);
    }

    const hash = await bcrypt.hash(password, 10);
    const id = uuid();
    const token = customAlphabet("1234567890abcdef", 32)();
    const expires = addMinutes(new Date(), 15); // 15-minute window

    await db.insert(users).values({
      id,
      email,
      passwordHash: hash,
      stripeCustomerId: null,
      createdAt: new Date(),
      emailVerified: false,
      emailVerificationToken: token,
      emailVerificationExpires: expires,
    });

    // Send email verification
    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `
        <p>Thanks for signing up! Click below to verify your email:</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5175'}/verify-email/${token}">Verify Email</a>
      `,
    });

    setCookie(c, "session", id, { path: "/", httpOnly: true });

    return c.json({ success: true, userId: id });
  } catch (error) {
    console.error("Registration error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ 
        error: "Validation failed", 
        details: parsed.error.issues 
      }, 400);
    }

    const { email, password } = parsed.data;

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    if (!user.passwordHash) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    setCookie(c, "session", user.id, { path: "/", httpOnly: true });
    return c.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

auth.post("/logout", async (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.json({ success: true });
});

auth.post("/verify-email/:token", async (c) => {
  try {
    const token = c.req.param("token");
    if (!token) {
      return c.json({ success: false, message: "Missing token" }, 400);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token));

    if (
      !user ||
      !user.emailVerificationExpires ||
      new Date() > new Date(user.emailVerificationExpires)
    ) {
      return c.json({ success: false, message: "Invalid or expired token" }, 400);
    }

    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      })
      .where(eq(users.id, user.id));

    setCookie(c, "session", user.id, { path: "/", httpOnly: true });

    return c.json({
      success: true,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default auth;

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import "dotenv/config";

import { authMiddleware } from "./middleware/auth";
import type { Variables } from "./types";
import { getDatabase } from "./db";

import auth from "./routes/auth";
import pdf from "./routes/pdf";
import plans from "./routes/plans";
import schedule from "./routes/schedule";
import stripeRoutes from "./routes/stripe";
import stripeWebhook from "./routes/stripe-webhook";

const app = new Hono<{ Variables: Variables }>();

// CORS middleware
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5175",
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

// Health check endpoint
app.get("/", (c) => c.text("AI Sleep Schedule Builder is running..."));

// User profile endpoint
app.get("/me", authMiddleware, (c) => {
  const user = c.get("user");
  return c.json({ 
    email: user.email, 
    isPremium: user.subscriptionTier === 'premium', 
    exportCredits: user.exportCredits,
    stripeCustomerId: user.stripeCustomerId,
    subscriptionTier: user.subscriptionTier,
    hasActiveSubscription: user.subscriptionTier !== 'free'
  });
});

// Route registration
app.route("/auth", auth);
app.route("/pdf", pdf);
app.route("/plans", plans);
app.route("/schedule", schedule);
app.route("/stripe", stripeRoutes);
app.route("/stripe-webhook", stripeWebhook);

// Initialize database and start server
async function startServer() {
  try {
    console.log('🔄 Initializing database...');
    await getDatabase();
    console.log('✅ Database initialized successfully');
    
    const port = parseInt(process.env.PORT || "3000");
    serve({
      fetch: app.fetch,
      port,
    });
    
    console.log(`🚀 Server running on port ${port}`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();



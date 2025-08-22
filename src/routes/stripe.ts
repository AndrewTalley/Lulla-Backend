import { Hono } from "hono";
import { stripe } from "../lib/stripe";
import { authMiddleware } from "../middleware/auth";
import { users } from "../db/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import type { Variables } from "../types";

const stripeApp = new Hono<{ Variables: Variables }>();

stripeApp.use("*", authMiddleware);

// Define subscription tiers and their features
const SUBSCRIPTION_TIERS = {
  'basic': {
    name: 'Basic Plan',
    priceId: process.env.STRIPE_BASIC_SUBSCRIPTION_PRICE,
    exportCredits: 10,
    features: ['basic_support', 'standard_templates']
  },
  'premium': {
    name: 'Premium Plan',
    priceId: process.env.STRIPE_PREMIUM_SUBSCRIPTION_PRICE,
    exportCredits: 50,
    features: ['priority_support', 'premium_templates', 'advanced_analytics']
  }
};

// POST /stripe/checkout --> Create Stripe Checkout session for tiered subscriptions
stripeApp.post("/checkout", async (c) => {
  try {
    const body = await c.req.json();
    const tier = body?.tier as "basic" | "premium" | undefined;
    const user = c.get("user");
    


    if (!tier || !SUBSCRIPTION_TIERS[tier]) {
      return c.json({ error: "Invalid subscription tier" }, 400);
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier];
    const priceId = tierConfig.priceId;
    const frontendUrl = process.env.FRONTEND_URL;

    if (!priceId) {
      console.error(`Missing Stripe price ID for ${tier} tier`);
      return c.json({ error: "Configuration error" }, 500);
    }
    if (!frontendUrl) {
      console.error("Missing FRONTEND_URL env var");
      return c.json({ error: "Configuration error" }, 500);
    }

    let customerId = user.stripeCustomerId;

    // Create customer if missing
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });

      customerId = customer.id;

      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, user.id));
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: { 
        userId: user.id, 
        tier: tier,
        checkoutType: 'subscription' 
      },
      success_url: `${frontendUrl}/success?purchase=subscription_success&tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/pricing`,
      subscription_data: {
        metadata: {
          userId: user.id,
          tier: tier
        }
      }
    });


    
    return c.json({ 
      url: session.url, 
      id: session.id,
      tier: tier,
      tierName: tierConfig.name
    });
  } catch (err: any) {
    console.error("❌ Checkout creation failed", err?.message || err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// POST /stripe/confirm --> Finalize entitlements after returning from Checkout
stripeApp.post("/confirm", async (c) => {
  try {
    const { sessionId } = await c.req.json();
    if (!sessionId) return c.json({ error: "Missing sessionId" }, 400);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const userId = (session.metadata as any)?.userId as string | undefined;
    const tier = (session.metadata as any)?.tier as string | undefined;
    
    if (!userId) return c.json({ error: "Missing userId in session" }, 400);
    if (!tier) return c.json({ error: "Missing tier in session" }, 400);

    if (session.mode === "subscription") {
      const subscriptionId = session.subscription as string | undefined;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (subscription.status === "active" || subscription.status === "trialing") {
          const tierConfig = SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];
          
          await db
            .update(users)
            .set({ 
              isPremium: tier === 'premium' ? 1 : 0, // Only premium users get isPremium=1
              stripeCustomerId: String(session.customer),
              exportCredits: tierConfig.exportCredits,
              subscriptionTier: tier,
              subscriptionStatus: 'active',

            })
            .where(eq(users.id, userId));
          

          
          return c.json({ 
            success: true, 
            isPremium: true,
            tier: tier,
            tierName: tierConfig.name,
            exportCredits: tierConfig.exportCredits
          });
        }
      }
      
      // Fallback: if payment succeeded
      if ((session.payment_status as any) === "paid") {
        const tierConfig = SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];
        
                 await db
           .update(users)
           .set({ 
             isPremium: tier === 'premium' ? 1 : 0, // Only premium users get isPremium=1
             stripeCustomerId: String(session.customer),
             exportCredits: tierConfig.exportCredits,
             subscriptionTier: tier,
             subscriptionStatus: 'active',
             
           })
           .where(eq(users.id, userId));
        
        
        
        return c.json({ 
          success: true, 
          isPremium: true,
          tier: tier,
          tierName: tierConfig.name,
          exportCredits: tierConfig.exportCredits
        });
      }
      
      return c.json({ success: false, message: "Subscription not active yet" }, 409);
    }

    return c.json({ success: false, message: "Invalid session mode" }, 400);
  } catch (err: any) {
    console.error("❌ /stripe/confirm error", err?.message || err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// GET /stripe/tiers --> Get available subscription tiers
stripeApp.get("/tiers", async (c) => {
  try {
    const tiers = Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => ({
      id: key,
      name: tier.name,
      exportCredits: tier.exportCredits,
      features: tier.features,
      priceId: tier.priceId
    }));
    
    return c.json({ tiers });
  } catch (err: any) {
    console.error("❌ Failed to get tiers:", err?.message || err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

stripeApp.post("/portal", async (c) => {
  try {
    const user = c.get("user");
    let customerId = user.stripeCustomerId;

    // ✅ If user has no Stripe customer ID, create one
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });

      customerId = customer.id;

      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, user.id));
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });

    return c.json({ url: portalSession.url });
  } catch (err: any) {
    console.error(
      "❌ Failed to create billing portal session:",
      err.message,
      err
    );
    return c.json({ error: "Internal Server Error" }, 500);
  }
});



export default stripeApp;

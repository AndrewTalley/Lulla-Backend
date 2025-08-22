import { Hono } from "hono";
import { stripe } from "../lib/stripe";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import type { Variables } from "../types";

const app = new Hono<{ Variables: Variables }>();

// Define subscription tiers and their features
const SUBSCRIPTION_TIERS = {
  [process.env.STRIPE_BASIC_SUBSCRIPTION_PRICE || '']: { // $3/month tier
    name: 'basic',
    exportCredits: 10, // 10 PDFs per month
    features: ['basic_support', 'standard_templates']
  },
  [process.env.STRIPE_PREMIUM_SUBSCRIPTION_PRICE || '']: { // $10/month tier
    name: 'premium',
    exportCredits: 50, // 50 PDFs per month
    features: ['priority_support', 'premium_templates', 'advanced_analytics']
  }
};

app.post("/", async (c) => {
  const sig = c.req.header("stripe-signature");
  if (!sig) return c.text("Missing signature", 400);

  const rawBody = await getRawBodyAsText(c.req.raw!);
  let event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Webhook error:", err.message);
    return c.text("Invalid signature", 400);
  }



  // Handle successful checkout completion
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const userId = session.metadata?.userId;
    


    if (userId && session.mode === "subscription") {
      try {
        // Get subscription details to determine tier
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        if (!subscription || !subscription.items || !subscription.items.data[0]) {
  
          return c.text("Invalid subscription data", 400);
        }
        const priceId = subscription.items.data[0].price.id;

        
        const tier = SUBSCRIPTION_TIERS[priceId as keyof typeof SUBSCRIPTION_TIERS];
        
        if (tier) {
          const result = await db
            .update(users)
            .set({
              isPremium: tier.name === 'premium' ? 1 : 0, // Only premium users get isPremium=1
              stripeCustomerId: session.customer,
              exportCredits: tier.exportCredits, // Reset credits based on tier
              subscriptionTier: tier.name,
              subscriptionStatus: 'active',

            })
            .where(eq(users.id, userId));
          

        } else {

          
          // Fallback: try to get tier from session metadata
          const fallbackTier = session.metadata?.tier;
          if (fallbackTier && (fallbackTier === 'basic' || fallbackTier === 'premium')) {
            const fallbackCredits = fallbackTier === 'basic' ? 10 : 50;
            
                         const result = await db
               .update(users)
               .set({
                 isPremium: fallbackTier === 'premium' ? 1 : 0, // Only premium users get isPremium=1
                 stripeCustomerId: session.customer,
                 exportCredits: fallbackCredits,
                 subscriptionTier: fallbackTier,
                 subscriptionStatus: 'active',

               })
               .where(eq(users.id, userId));
            
            
          } else {
            console.error(`❌ Could not determine tier for user ${userId}`);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to update user ${userId}:`, error);
      }
    } else if (!userId) {
      // No userId found in session metadata
    }
  }

  // Handle subscription cancellations and deletions
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as any;
    const customerId: string | undefined = subscription.customer;
    
    if (customerId) {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.stripeCustomerId, customerId),
        });
        
        if (user) {
          await db
            .update(users)
            .set({ 
              isPremium: 0,
              exportCredits: 0,
              subscriptionTier: 'free',
              subscriptionStatus: 'canceled'
            })
            .where(eq(users.id, user.id));
          

        }
      } catch (error) {
        console.error(`❌ Failed to cancel subscription for customer ${customerId}:`, error);
      }
    }
  }

  return c.text("ok");
});

// ✅ Must return string, not Buffer
async function getRawBodyAsText(req: Request): Promise<string> {
  const arrayBuffer = await req.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("utf8");
}

export default app;

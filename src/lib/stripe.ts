import Stripe from "stripe";

if (!process.env.STRIPE_API_KEY) {
  throw new Error("STRIPE_API_KEY environment variable is required");
}

// Use the SDK's pinned API version for maximum compatibility.
export const stripe = new Stripe(process.env.STRIPE_API_KEY, {
  apiVersion: "2025-07-30.basil",
});

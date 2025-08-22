import type { Context, Next } from "hono";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Variables, SubscriptionTier } from "../types";

// Access control middleware for different subscription tiers
export const requireAccessLevel = (requiredLevel: 'basic' | 'premium') => {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    const user = c.get("user");
    
    try {
      // Get current user data from database
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      if (!currentUser) {
        return c.json({ error: "User not found" }, 404);
      }

      // Check if user has required access level
      const userLevel = currentUser.subscriptionTier || 'free';
      const hasAccess = checkAccessLevel(userLevel, requiredLevel);

      if (!hasAccess) {
        return c.json({ 
          error: "Access denied", 
          requiredLevel,
          currentLevel: userLevel,
          message: `This feature requires ${requiredLevel} access or higher`
        }, 403);
      }

      // Add user data to context for use in routes
      // Convert database user to User type
      const userForContext = {
        ...currentUser,
        isPremium: currentUser.isPremium ?? 0,
        exportCredits: currentUser.exportCredits ?? 0,
        createdAt: currentUser.createdAt,
        currentPeriodEnd: currentUser.currentPeriodEnd,
        subscriptionTier: currentUser.subscriptionTier ?? 'free',
        subscriptionStatus: currentUser.subscriptionStatus ?? 'inactive'
      };
      c.set("currentUser", userForContext);
      await next();
    } catch (error) {
      console.error("Access control error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  };
};

// Check if user level meets required level
function checkAccessLevel(userLevel: string, requiredLevel: 'basic' | 'premium'): boolean {
  const levels: Record<SubscriptionTier, number> = {
    'free': 0,
    'basic': 1,
    'premium': 2
  };

  const userLevelNum = levels[userLevel as SubscriptionTier] || 0;
  const requiredLevelNum = levels[requiredLevel];

  return userLevelNum >= requiredLevelNum;
}

// Middleware for basic access (basic + premium)
export const requireBasicAccess = requireAccessLevel('basic');

// Middleware for premium access (premium only)
export const requirePremiumAccess = requireAccessLevel('premium');

// Check if user has dashboard access (premium only)
export const requireDashboardAccess = requireAccessLevel('premium');

// Check if user can export PDFs (basic + premium)
export const requireExportAccess = requireAccessLevel('basic');

// Check if user can create unlimited schedules (basic + premium)
export const requireScheduleAccess = requireAccessLevel('basic');

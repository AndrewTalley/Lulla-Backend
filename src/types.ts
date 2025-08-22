// src/types.ts

export type User = {
  id: string;
  email: string;
  passwordHash?: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  isPremium: number;
  exportCredits: number;
  emailVerified: boolean;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: Date | null;
  subscriptionTier: string;
  subscriptionStatus: string;
  currentPeriodEnd: Date | null;
};

export type Plan = {
  id: string;
  userId: string;
  markdown: string;
  createdAt: string;
  babyAgeMonths?: number | null;
};

export type Variables = {
  user: User;
  currentUser?: User;
};

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type SubscriptionTier = 'free' | 'basic' | 'premium';
export type SubscriptionStatus = 'active' | 'inactive' | 'canceled' | 'past_due';

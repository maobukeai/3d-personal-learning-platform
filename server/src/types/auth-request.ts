import type { Subscription, SubscriptionPlan } from '@prisma/client';
import type { SafeUser } from '../utils/workspace-utils';

export interface AuthRequest {
  userId?: string;
  user?: SafeUser & {
    subscription?: (Subscription & { plan: SubscriptionPlan }) | null;
  };
  workspaceId?: string;
  body?: unknown;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: unknown;
}

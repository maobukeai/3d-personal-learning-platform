import { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

type RequestWithUserId = Request & { userId?: string };

export const createAiRateLimitKeyGenerator =
  (userPrefix: string, ipPrefix: string) =>
  (req: Request): string => {
    const userId = (req as RequestWithUserId).userId;
    return userId ? `${userPrefix}_${userId}` : `${ipPrefix}_${ipKeyGenerator(req.ip || '')}`;
  };

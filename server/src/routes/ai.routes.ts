import { Router } from 'express';
import * as aiController from '../controllers/ai.controller';
import { authenticate } from '../middlewares/auth.middleware';
import rateLimit from 'express-rate-limit';
import { createRateLimitHandler } from '../middlewares/rate-limit.middleware';
import { createAiRateLimitKeyGenerator } from '../utils/ai-rate-limit';

const router = Router();

// Rate limiter for resource-heavy AI endpoints to prevent abuse and API cost exploitation
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 8, // Max 8 streaming writing requests per minute
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: createRateLimitHandler('AI 接口请求过于频繁，请稍后再试。', 'AI_RATE_LIMITED'),
  keyGenerator: createAiRateLimitKeyGenerator('ai_user', 'ai_ip'),
});

// Require authentication for AI writing assistant
router.post('/write-assist', authenticate, aiRateLimiter, aiController.writeAssist);
router.post('/optimize-prompt', authenticate, aiRateLimiter, aiController.optimizePrompt);
router.post('/generate-image', authenticate, aiRateLimiter, aiController.generateImage);

export default router;

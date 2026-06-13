import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/auth.middleware';
import { createRateLimitHandler } from '../middlewares/rate-limit.middleware';
import * as aiBotController from '../controllers/ai-bot.controller';

const router = Router();

const callbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('AI 机器人回调请求过于频繁，请稍后再试', 'AI_BOT_RATE_LIMITED'),
  validate: false,
});

router.get('/callback/:token', callbackLimiter, aiBotController.handleCallbackChallenge);
router.post('/callback/:token', callbackLimiter, aiBotController.handleCallback);

router.use(authenticate);

router.get('/entitlement', aiBotController.getEntitlement);
router.get('/analytics', aiBotController.getAnalytics);
router.get('/operations', aiBotController.getOperationsReport);
router.get('/models', aiBotController.listModels);
router.get('/templates', aiBotController.listTemplates);
router.post('/payload-preview', aiBotController.previewPayload);
router.get('/integrations', aiBotController.listIntegrations);
router.post('/integrations', aiBotController.createIntegration);
router.put('/integrations/:id', aiBotController.updateIntegration);
router.delete('/integrations/:id', aiBotController.deleteIntegration);
router.post('/integrations/:id/rotate-token', aiBotController.rotatePublicToken);
router.get('/integrations/:id/diagnostics', aiBotController.diagnoseIntegration);
router.get('/integrations/:id/runbook', aiBotController.getIntegrationRunbook);
router.get('/integrations/:id/knowledge', aiBotController.listKnowledgeSources);
router.post('/integrations/:id/knowledge', aiBotController.createKnowledgeSource);
router.put('/integrations/:id/knowledge/:sourceId', aiBotController.updateKnowledgeSource);
router.delete('/integrations/:id/knowledge/:sourceId', aiBotController.deleteKnowledgeSource);
router.get('/integrations/:id/insights', aiBotController.getEvolutionInsights);
router.post('/integrations/:id/evaluations', aiBotController.runEvaluation);
router.post('/integrations/:id/prompt-optimization', aiBotController.optimizePrompt);
router.post('/integrations/:id/playground', aiBotController.runPlayground);
router.post('/integrations/:id/test', aiBotController.testIntegration);
router.get('/integrations/:id/messages', aiBotController.listMessages);
router.post('/integrations/:id/messages/:messageId/replay', aiBotController.replayMessage);

export default router;

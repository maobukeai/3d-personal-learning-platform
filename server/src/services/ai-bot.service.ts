/**
 * AI Bot 服务架构代理桶 (Facade Barrel)。
 * 将 3000+ 行原巨型服务彻底降维拆解为关注点分离的微型 TypeScript 服务子模块，
 * 满足全局单文件 <= 300-500 行规则，并保持 100% 零破坏向后兼容。
 */

export * from './ai-bot/types';
export * from './ai-bot/bot-entitlement.service';
export * from './ai-bot/bot-knowledge.service';
export * from './ai-bot/bot-analytics.service';
export * from './ai-bot/bot-diagnostics.service';
export * from './ai-bot/bot-operations.service';
export * from './ai-bot/bot-runbook.service';
export * from './ai-bot/bot-evolution.service';
export * from './ai-bot/bot-evaluation.service';
export * from './ai-bot/bot-messaging.service';

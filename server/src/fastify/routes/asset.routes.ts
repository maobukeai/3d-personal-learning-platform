import type { FastifyInstance } from 'fastify';
import { registerAssetQueryRoutes } from './asset/asset-query.routes';
import { registerAssetMutationRoutes } from './asset/asset-mutation.routes';
import { registerAssetOptimizationRoutes } from './asset/asset-optimization.routes';

/**
 * Fastify 资产库主挂载入口。
 * 遵循行数约束拆分为子路由模块，保证强类型与无缝兼容。
 */
export const registerAssetRoutes = (app: FastifyInstance): void => {
  registerAssetQueryRoutes(app);
  registerAssetMutationRoutes(app);
  registerAssetOptimizationRoutes(app);
};

import type { FastifyInstance } from 'fastify';
import * as bannerController from '../../controllers/banner.controller';

/**
 * Fastify Banner 路由（原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/banners
 *  - GET /  公开获取启用的 Banner 列表（无需鉴权）
 *
 * 路由级限流：30/min（对齐 Express bannerLimiter）
 */

export const registerBannerRoutes = (app: FastifyInstance): void => {
  // GET /banners —— 公开获取启用中的 Banner
  app.get(
    '/banners',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    bannerController.getActiveBanners,
  );
};

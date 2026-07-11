import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import prisma from '../../services/prisma';
import { redisService } from '../../services/redis.service';
import { AppError } from '../../utils/error';
import { logger } from '../../utils/logger';
import { selectFields, resolveWorkspaceId, type SafeUser } from '../../utils/workspace-utils';
export type { SafeUser };

/**
 * Module augmentation —— 让所有 FastifyRequest 实例都暴露
 * `user` / `userId` / `workspaceId` 三个可选字段。
 *
 * fastifyAuthenticate 写入 user/userId；fastifyResolveWorkspace 写入 workspaceId。
 * 这与 Express AuthRequest 的字段语义一致，路由 handler 可直接访问
 * `request.userId` / `request.user` / `request.workspaceId` 而无需逐处 cast。
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: SafeUser;
    userId?: string;
    workspaceId?: string;
  }
}

/**
 * Fastify 鉴权插件 —— 与 Express 版本 (auth.middleware.ts) 保持一致：
 *  - 同样的 JWT secret (config.JWT_SECRET, HS256)
 *  - 同样的 cookie 名 (token) + 同样的 Bearer header 兜底
 *  - 同样的 Prisma selectFields（剔除敏感字段）
 *  - 同样的 Redis 缓存策略 (user_auth:${userId}, TTL 600s)
 *  - 同样的 BANNED 用户拦截逻辑
 *
 * 仅做了 Fastify request/reply 接口适配；不引入 workspaceId 解析
 * （model.routes 当前路由不需要工作空间维度鉴权）。
 */

const USER_CACHE_TTL_SECONDS = 600;

// 复用 Express 版的 Date 反序列化逻辑（缓存中存的 Date 会被 JSON.stringify 成字符串）
const reviveUserDates = (user: Record<string, unknown>) => {
  if (!user) return user;
  if (user.createdAt && typeof user.createdAt === 'string')
    user.createdAt = new Date(user.createdAt as string);
  if (user.updatedAt && typeof user.updatedAt === 'string')
    user.updatedAt = new Date(user.updatedAt as string);
  return user;
};

const getTokenFromRequest = (request: FastifyRequest): string | null => {
  // 1) Authorization: Bearer <token>
  const authHeader = request.headers.authorization;
  const [scheme, token] = authHeader?.split(' ') ?? [];
  if (scheme?.toLowerCase() === 'bearer' && token) {
    return token;
  }

  // 2) cookie.token —— @fastify/cookie 解析后挂在 request.cookies
  const cookieToken = (request.cookies as { token?: string } | undefined)?.token;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
};

const attachAuthenticatedUser = async (
  request: FastifyRequest & { user?: SafeUser; userId?: string },
  userId: string,
): Promise<void> => {
  const cacheKey = `user_auth:${userId}`;
  let user: SafeUser | null = await redisService.get<SafeUser>(cacheKey);

  if (user) {
    reviveUserDates(user as unknown as Record<string, unknown>);
  } else {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: selectFields,
    });

    if (user) {
      await redisService.set(cacheKey, user, USER_CACHE_TTL_SECONDS);
    }
  }

  if (!user) {
    throw new AppError('Unauthorized: User not found', 401, 'USER_NOT_FOUND');
  }

  if (user.status === 'BANNED') {
    throw new AppError('您的账号已被封禁', 403, 'USER_BANNED');
  }

  request.userId = user.id;
  request.user = user;
};

/**
 * Fastify preHandler —— 等价于 Express 的 authenticate 中间件。
 * 在路由上通过 `{ preHandler: [fastifyAuthenticate] }` 使用。
 */
export const fastifyAuthenticate = async (
  request: FastifyRequest & { user?: SafeUser; userId?: string },
  _reply: FastifyReply,
): Promise<void> => {
  const token = getTokenFromRequest(request);

  if (!token) {
    throw new AppError('Unauthorized: No token provided', 401, 'TOKEN_REQUIRED');
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
    };
    await attachAuthenticatedUser(request, decoded.id);
    await fastifyResolveWorkspace(request, _reply);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('[fastifyAuthenticate] Expired token rejected');
      throw new AppError('Unauthorized: Token expired', 401, 'TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('[fastifyAuthenticate] Invalid token rejected');
      throw new AppError('Unauthorized: Invalid token', 401, 'INVALID_TOKEN');
    }
    throw error;
  }
};

/**
 * Fastify 轻量级认证 preHandler —— 仅验证 JWT 并附加 user/userId，
 * 不解析工作区维度。用于用户个人设置、可信设备、帐户导出等不涉及
 * 工作区的路由，避免客户端发送无效 workspace ID 时加载得到虽然已登录但显示 403。
 */
export const fastifyAuthenticateOnly = async (
  request: FastifyRequest & { user?: SafeUser; userId?: string },
  _reply: FastifyReply,
): Promise<void> => {
  const token = getTokenFromRequest(request);

  if (!token) {
    throw new AppError('Unauthorized: No token provided', 401, 'TOKEN_REQUIRED');
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
    };
    await attachAuthenticatedUser(request, decoded.id);
    // Intentionally skips fastifyResolveWorkspace — workspace context is not
    // needed for personal-scoped endpoints (user-settings, trusted-devices, etc.)
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('[fastifyAuthenticateOnly] Expired token rejected');
      throw new AppError('Unauthorized: Token expired', 401, 'TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('[fastifyAuthenticateOnly] Invalid token rejected');
      throw new AppError('Unauthorized: Invalid token', 401, 'INVALID_TOKEN');
    }
    throw error;
  }
};

/**
 * Fastify 可选鉴权 —— 等价于 Express 的 optionalAuthenticate。
 * 有 token 则附加 user，无 token 或 token 无效时静默放行（guest 模式）。
 */
export const fastifyOptionalAuthenticate = async (
  request: FastifyRequest & { user?: SafeUser; userId?: string },
  _reply: FastifyReply,
): Promise<void> => {
  const token = getTokenFromRequest(request);
  if (!token) return;

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
    };
    await attachAuthenticatedUser(request, decoded.id);
    await fastifyResolveWorkspace(request, _reply);
  } catch {
    // 可选鉴权：token 无效时静默放行，不抛错
  }
};

/**
 * Fastify 管理员校验 preHandler —— 等价于 Express 的 isAdmin 中间件。
 * 必须在 fastifyAuthenticate 之后使用（依赖 request.user 已填充）。
 * 非 ADMIN 角色直接抛 403。
 */
export const fastifyRequireAdmin = async (
  request: FastifyRequest & { user?: SafeUser },
  _reply: FastifyReply,
): Promise<void> => {
  if (!request.user || request.user.role !== 'ADMIN') {
    throw new AppError('Forbidden: Admin access required', 403, 'ADMIN_REQUIRED');
  }
};

/**
 * Fastify 工作空间解析 preHandler —— 等价于 Express attachAuthenticatedUser 中
 * 解析 req.workspaceId 的逻辑。读取 `x-workspace-id` 请求头，复用 Express 同款
 * resolveWorkspaceId（含个人空间兜底、mirror/manual/admin 虚拟空间、成员校验、
 * Redis 缓存），失败时回退到个人空间（与 Express 行为一致）。
 *
 * 仅在需要工作空间维度鉴权的路由（如 task）上以
 * `{ preHandler: [fastifyAuthenticate, fastifyResolveWorkspace] }` 使用。
 */
export const fastifyResolveWorkspace = async (
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> => {
  if (!request.user) return;

  const requested =
    (request.headers['x-workspace-id'] as string | string[] | undefined) &&
    typeof request.headers['x-workspace-id'] === 'string'
      ? (request.headers['x-workspace-id'] as string)
      : undefined;

  try {
    request.workspaceId = await resolveWorkspaceId(
      request.user as unknown as Parameters<typeof resolveWorkspaceId>[0],
      requested,
    );
  } catch (error) {
    // 与 Express attachAuthenticatedUser 一致：403 时回退到个人空间
    if (error instanceof AppError && error.statusCode === 403) {
      request.workspaceId = await resolveWorkspaceId(
        request.user as unknown as Parameters<typeof resolveWorkspaceId>[0],
        undefined,
      );
    } else {
      throw error;
    }
  }
};

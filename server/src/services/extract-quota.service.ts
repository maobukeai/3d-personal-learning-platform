import { redisService } from './redis.service';
import prisma from './prisma';

export interface DailyExtractQuotaInfo {
  total: number | 'UNLIMITED';
  used: number;
  remaining: number | 'UNLIMITED';
  planName: string;
  isAdmin: boolean;
}

export class ExtractQuotaService {
  private getTodayKey(userId: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return `quota:extract:${userId}:${today}`;
  }

  /**
   * 获取用户当天的网盘提取配额与使用详情
   */
  async getDailyQuotaInfo(userId: string, userRole?: string): Promise<DailyExtractQuotaInfo> {
    const isAdmin = userRole === 'ADMIN';
    const key = this.getTodayKey(userId);

    // 获取今日已提取次数
    const cachedVal = await redisService.get<number | string>(key);
    let used = 0;
    if (typeof cachedVal === 'number') {
      used = cachedVal;
    } else if (typeof cachedVal === 'string') {
      used = parseInt(cachedVal, 10) || 0;
    }

    if (isAdmin) {
      return {
        total: 'UNLIMITED',
        used,
        remaining: 'UNLIMITED',
        planName: '系统管理员',
        isAdmin: true,
      };
    }

    // 查询用户的有效会员订阅
    const sub = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const isSubActive =
      sub?.status === 'ACTIVE' && (!sub.endDate || new Date(sub.endDate) > new Date());
    const priority = isSubActive ? (sub?.plan?.priority ?? 0) : 0;

    let total = 0;
    let planName = '普通用户';

    if (priority >= 2) {
      total = 50;
      planName = sub?.plan?.displayName || 'SVIP 旗舰会员';
    } else if (priority === 1) {
      total = 30;
      planName = sub?.plan?.displayName || 'VIP 专业会员';
    } else {
      total = 0;
      planName = '普通用户';
    }

    const remaining = Math.max(0, total - used);

    return {
      total,
      used,
      remaining,
      planName,
      isAdmin: false,
    };
  }

  /**
   * 检查并扣减 1 次今日网盘提取配额（主站与代理站统一调用）
   */
  async checkAndConsumeQuota(
    userId: string,
    userRole?: string,
  ): Promise<{ success: boolean; info: DailyExtractQuotaInfo; error?: string }> {
    const info = await this.getDailyQuotaInfo(userId, userRole);

    if (info.isAdmin) {
      const key = this.getTodayKey(userId);
      const newUsed = await redisService.incr(key);
      info.used = newUsed;
      return { success: true, info };
    }

    if (typeof info.total === 'number' && info.total <= 0) {
      return {
        success: false,
        info,
        error:
          '普通免费用户暂无网盘提取额度，开通 VIP 会员每日享 30 次提取，SVIP 会员每日享 50 次提取！',
      };
    }

    if (typeof info.remaining === 'number' && info.remaining <= 0) {
      return {
        success: false,
        info,
        error: `您今日的网盘提取配额已用完（${info.total}次/天），将在明日零点自动重置。升级 SVIP 旗舰会员可享每日 50 次提取！`,
      };
    }

    // 递增已用次数
    const key = this.getTodayKey(userId);
    const newUsed = await redisService.incr(key);

    info.used = newUsed;
    if (typeof info.total === 'number') {
      info.remaining = Math.max(0, info.total - newUsed);
    }

    return { success: true, info };
  }
}

export const extractQuotaService = new ExtractQuotaService();

<script setup lang="ts">
import {
  Activity,
  Ban,
  Clock,
  CreditCard,
  Fingerprint,
  KeyRound,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  TimerReset,
  Trash2,
  UserCog,
  X,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import type { AdminUser } from '../UsersView.vue';

const props = defineProps<{
  modelValue: boolean;
  user: AdminUser | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit', user: AdminUser): void;
  (e: 'subscription', user: AdminUser): void;
  (e: 'reset-password', user: AdminUser): void;
  (e: 'revoke-sessions', user: AdminUser): void;
  (e: 'toggle-status', user: AdminUser): void;
  (e: 'delete', user: AdminUser): void;
}>();

// Helpers copied from parent
const roleLabel = (role: string) => {
  const map: Record<string, string> = {
    ADMIN: '管理员',
    INSTRUCTOR: '导师',
    USER: '普通用户',
  };
  return map[role] || role;
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: '正常',
    BANNED: '封禁',
  };
  return map[status] || status;
};

const safeDateTime = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const formatDate = (value?: string | null) => {
  const time = safeDateTime(value);
  if (!time) return '未记录';
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getDaysSince = (value?: string | null) => {
  const time = safeDateTime(value);
  if (!time) return null;
  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
};

const relativeTime = (value?: string | null) => {
  const time = safeDateTime(value);
  if (!time) return null;
  const diff = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
};

const activityText = (user: AdminUser) => {
  const distance = relativeTime(user.lastActivityAt);
  if (!distance) return '暂无操作';
  if (!user.lastActivityAction) return distance;
  return `${distance} / ${user.lastActivityModule || 'SYSTEM'}:${user.lastActivityAction}`;
};

const shortUserAgent = (value?: string | null) => {
  if (!value) return '未知设备';
  if (/Edg/i.test(value)) return 'Edge';
  if (/Chrome/i.test(value)) return 'Chrome';
  if (/Firefox/i.test(value)) return 'Firefox';
  if (/Safari/i.test(value) && !/Chrome/i.test(value)) return 'Safari';
  return value.slice(0, 30);
};

const planLabel = (user: AdminUser) =>
  user.subscription?.plan?.displayName || user.subscription?.plan?.name || '未订阅';

const roleClass = (role: string) => ({
  'tone-purple': role === 'ADMIN',
  'tone-blue': role === 'INSTRUCTOR',
  'tone-slate': role === 'USER',
});

const statusClass = (status: string) => ({
  'tone-green': status === 'ACTIVE',
  'tone-red': status === 'BANNED',
});

interface RiskInfo {
  label: string;
  tone: 'green' | 'amber' | 'red' | 'slate' | 'blue';
  priority: number;
}

const riskInfo = (user: AdminUser): RiskInfo => {
  const days = getDaysSince(user.lastLoginAt);
  if (user.status === 'BANNED') return { label: '高风险', tone: 'red', priority: 5 };
  if (!user.lastLoginAt) return { label: '未登录', tone: 'amber', priority: 3 };
  if (days !== null && days > 30) return { label: '沉睡', tone: 'amber', priority: 3 };
  if ((user.activeSessions || 0) >= 5) return { label: '会话偏多', tone: 'amber', priority: 3 };
  if (!user.emailVerified) return { label: '邮箱未验', tone: 'amber', priority: 2 };
  if ((user._count?.feedbacks || 0) >= 5) return { label: '反馈偏多', tone: 'amber', priority: 2 };
  if (user.twoFactorEnabled) return { label: '稳健', tone: 'green', priority: 0 };
  return { label: '正常', tone: 'slate', priority: 0 };
};

const riskLabel = (user: AdminUser) => riskInfo(user).label;

const riskClass = (user: AdminUser) => ({
  'tone-red': riskInfo(user).tone === 'red',
  'tone-amber': riskInfo(user).tone === 'amber',
  'tone-green': riskInfo(user).tone === 'green',
  'tone-blue': riskInfo(user).tone === 'blue',
  'tone-slate': riskInfo(user).tone === 'slate',
});
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :size="560"
    :with-header="false"
    class="user-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="user" class="drawer-body">
      <div class="drawer-hero">
        <UserAvatar :user="user" size="xl" />
        <div>
          <h2>{{ user.name || '未命名用户' }}</h2>
          <p>{{ user.email }}</p>
          <div class="drawer-pills">
            <span class="pill" :class="roleClass(user.role)">
              {{ roleLabel(user.role) }}
            </span>
            <span class="pill" :class="statusClass(user.status)">
              {{ statusLabel(user.status) }}
            </span>
            <span class="pill" :class="riskClass(user)">
              {{ riskLabel(user) }}
            </span>
          </div>
        </div>
      </div>

      <div class="drawer-actions">
        <el-button @click="emit('edit', user)">
          <UserCog :size="15" />
          编辑
        </el-button>
        <el-button @click="emit('subscription', user)">
          <CreditCard :size="15" />
          订阅
        </el-button>
        <el-button @click="emit('reset-password', user)">
          <KeyRound :size="15" />
          密码
        </el-button>
        <el-button type="danger" plain @click="emit('revoke-sessions', user)">
          <TimerReset :size="15" />
          清退
        </el-button>
      </div>

      <section class="detail-section">
        <h3>账号状态</h3>
        <div class="detail-grid">
          <div>
            <span>积分</span>
            <strong>{{ user.points || 0 }}</strong>
          </div>
          <div>
            <span>订阅</span>
            <strong>{{ planLabel(user) }}</strong>
          </div>
          <div>
            <span>邮箱验证</span>
            <strong>{{ user.emailVerified ? '已验证' : '未验证' }}</strong>
          </div>
          <div>
            <span>双因素认证</span>
            <strong>{{ user.twoFactorEnabled ? '已开启' : '未开启' }}</strong>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <h3>登录与活跃</h3>
        <div class="detail-list">
          <div>
            <Clock :size="16" />
            <span>最后登录</span>
            <strong>{{ formatDate(user.lastLoginAt) }}</strong>
          </div>
          <div>
            <Activity :size="16" />
            <span>最后活动</span>
            <strong>{{ activityText(user) }}</strong>
          </div>
          <div>
            <MonitorSmartphone :size="16" />
            <span>活跃会话</span>
            <strong>{{ user.activeSessions || 0 }} 个</strong>
          </div>
          <div>
            <Fingerprint :size="16" />
            <span>可信设备</span>
            <strong>{{ user.trustedDevices || 0 }} 台</strong>
          </div>
          <div>
            <Mail :size="16" />
            <span>登录 IP</span>
            <strong>{{ user.lastLoginIp || '未记录' }}</strong>
          </div>
          <div>
            <ShieldCheck :size="16" />
            <span>设备环境</span>
            <strong>{{ shortUserAgent(user.lastLoginUserAgent) }}</strong>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <h3>平台贡献</h3>
        <div class="detail-grid three">
          <div>
            <span>资产</span>
            <strong>{{ user._count?.assets || 0 }}</strong>
          </div>
          <div>
            <span>素材</span>
            <strong>{{ user._count?.materials || 0 }}</strong>
          </div>
          <div>
            <span>作品</span>
            <strong>{{ user._count?.showcases || 0 }}</strong>
          </div>
          <div>
            <span>团队</span>
            <strong>{{ user._count?.teamMemberships || 0 }}</strong>
          </div>
          <div>
            <span>项目</span>
            <strong>{{ user._count?.projects || 0 }}</strong>
          </div>
          <div>
            <span>任务</span>
            <strong>{{ user._count?.tasks || 0 }}</strong>
          </div>
          <div>
            <span>反馈</span>
            <strong>{{ user._count?.feedbacks || 0 }}</strong>
          </div>
          <div>
            <span>审计记录</span>
            <strong>{{ user._count?.auditLogs || 0 }}</strong>
          </div>
          <div>
            <span>累计登录</span>
            <strong>{{ user.loginCount || 0 }}</strong>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <h3>时间线</h3>
        <div class="timeline-list">
          <div>
            <span>注册</span>
            <strong>{{ formatDate(user.createdAt) }}</strong>
          </div>
          <div>
            <span>资料更新</span>
            <strong>{{ formatDate(user.updatedAt) }}</strong>
          </div>
          <div>
            <span>最后活动 IP</span>
            <strong>{{ user.lastActivityIp || '未记录' }}</strong>
          </div>
        </div>
      </section>

      <div class="drawer-danger">
        <el-button plain @click="emit('toggle-status', user)">
          <Ban :size="15" />
          {{ user.status === 'BANNED' ? '恢复账号' : '封禁账号' }}
        </el-button>
        <el-button type="danger" plain @click="emit('delete', user)">
          <Trash2 :size="15" />
          永久删除
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.drawer-hero {
  display: flex;
  align-items: center;
  gap: 18px;
}

.drawer-hero h2 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 850;
  letter-spacing: 0;
}

.drawer-hero p {
  margin: 6px 0 10px;
  color: #64748b;
  font-size: 14px;
}

.drawer-pills {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.drawer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.detail-section {
  padding-top: 18px;
  border-top: 1px solid #e8eef5;
}

.detail-section h3 {
  margin: 0 0 12px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 850;
  letter-spacing: 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.detail-grid > div {
  min-height: 68px;
  padding: 12px;
  border: 1px solid #e8eef5;
  border-radius: 8px;
  background: #fbfdff;
}

.detail-grid span,
.timeline-list span,
.detail-list span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.detail-grid strong {
  display: block;
  margin-top: 7px;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.1;
  font-weight: 850;
  word-break: break-word;
}

.detail-list {
  display: grid;
  gap: 8px;
}

.detail-list > div {
  display: grid;
  grid-template-columns: 20px 92px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 36px;
  color: #475569;
}

.detail-list strong,
.timeline-list strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  word-break: break-word;
}

.timeline-list {
  display: grid;
  gap: 10px;
}

.timeline-list > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed #e2e8f0;
}

.drawer-danger {
  padding-top: 16px;
  border-top: 1px solid #fee2e2;
  display: flex;
  gap: 10px;
}

.pill {
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12px;
  line-height: 1;
  font-weight: 800;
  white-space: nowrap;
}

.tone-purple {
  color: #7c3aed;
  background: #f3e8ff;
  border-color: #e9d5ff;
}

.tone-blue {
  color: #0369a1;
  background: #e0f2fe;
  border-color: #bae6fd;
}

.tone-green {
  color: #047857;
  background: #d1fae5;
  border-color: #a7f3d0;
}

.tone-amber {
  color: #b45309;
  background: #fef3c7;
  border-color: #fde68a;
}

.tone-red {
  color: #be123c;
  background: #ffe4e6;
  border-color: #fecdd3;
}

.tone-slate {
  color: #475569;
  background: #f1f5f9;
  border-color: #e2e8f0;
}
</style>

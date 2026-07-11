<script setup lang="ts">
import { Activity } from 'lucide-vue-next';
import { Box } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Tabs from '@/components/ui/Tabs.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import type { Asset, User } from '@/types';

interface CourseInsight {
  id: string;
  title: string;
  status: string;
  category?: { name: string } | null;
  _count?: {
    lessons: number;
    enrollments: number;
    reviews: number;
  };
}

interface FeedbackItem {
  id: string;
  type: string;
  title: string;
  priority: string;
  status: string;
  updatedAt: string;
  user?: User | null;
}

interface AuditLogItem {
  id: string;
  module: string;
  action: string;
  description?: string | null;
  createdAt: string;
  user?: User | null;
}

interface Props {
  recentAssets: Asset[];
  topCourses: CourseInsight[];
  recentFeedbacks: FeedbackItem[];
  recentUsers: User[];
  recentAuditLogs: AuditLogItem[];
  activeActivityTab: 'assets' | 'courses' | 'feedback';
  activeFeedTab: 'users' | 'logs';
  getActionLabel: (action: string) => string;
}

defineProps<Props>();

const emit = defineEmits(['update:activeActivityTab', 'update:activeFeedTab', 'navigate']);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusBadgeVariant = (status?: string) => {
  if (
    status === 'APPROVED' ||
    status === 'RESOLVED' ||
    status === 'ACTIVE' ||
    status === 'PUBLISHED'
  ) {
    return 'success';
  }
  if (status === 'REJECTED' || status === 'BANNED' || status === 'FAILED') {
    return 'danger';
  }
  return 'warning';
};
</script>

<template>
  <div class="space-y-3">
    <!-- Platform Real-time Activity & Insights Panel -->
    <Card padding="sm">
      <template #header>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
          <h2
            class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
          >
            <Activity class="h-4 w-4 text-[var(--accent)]" />
            平台动态监测
          </h2>
          <Tabs
            :model-value="activeActivityTab"
            :options="[
              { label: '最新资产', value: 'assets' },
              { label: '热门课程', value: 'courses' },
              { label: '用户反馈', value: 'feedback' },
            ]"
            size="sm"
            variant="solid"
            @update:model-value="
              emit('update:activeActivityTab', $event as 'assets' | 'courses' | 'feedback')
            "
          />
        </div>
      </template>

      <div class="tab-content min-h-[170px]">
        <!-- Tab: Latest Assets -->
        <div v-show="activeActivityTab === 'assets'" class="space-y-2">
          <div class="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>最新提交且已处理或待审的资产。</span>
            <Button variant="link" size="sm" @click="emit('navigate', '/admin/audits?tab=assets')">
              查看资产审核
            </Button>
          </div>
          <div class="asset-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <button
              v-for="asset in recentAssets"
              :key="asset.id"
              type="button"
              class="asset-row flex items-center gap-2.5 p-2 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs cursor-pointer w-full"
              @click="emit('navigate', '/admin/audits?tab=assets')"
            >
              <span
                class="asset-thumb border border-base flex items-center justify-center shrink-0 w-10 h-10 rounded-md overflow-hidden bg-slate-100 dark:bg-zinc-800"
              >
                <img
                  v-if="asset.thumbnail"
                  :src="asset.thumbnail"
                  :alt="asset.title"
                  class="w-full h-full object-cover"
                />
                <Box v-else class="h-4 w-4 text-slate-400" />
              </span>
              <span class="min-w-0 flex-1 text-left">
                <b class="text-xs font-bold block truncate text-[var(--text-primary)]">{{
                  asset.title
                }}</b>
                <small class="text-[9px] text-[var(--text-secondary)] mt-0.5 block truncate">{{
                  asset.user?.name || asset.user?.email || '未知作者'
                }}</small>
              </span>
              <Badge :variant="getStatusBadgeVariant(asset.status)">{{ asset.status }}</Badge>
            </button>
            <div
              v-if="!recentAssets?.length"
              class="empty-line w-full col-span-full py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
            >
              暂无资产提交
            </div>
          </div>
        </div>

        <!-- Tab: Popular Courses -->
        <div v-show="activeActivityTab === 'courses'" class="space-y-2">
          <div class="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>按学员报名人数排序的热门课程排行。</span>
            <Button variant="link" size="sm" @click="emit('navigate', '/admin/courses')">
              课程管理
            </Button>
          </div>
          <div class="list-stack">
            <button
              v-for="course in topCourses"
              :key="course.id"
              type="button"
              class="list-row flex items-center justify-between gap-2.5 p-2 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs cursor-pointer w-full"
              @click="emit('navigate', '/admin/courses')"
            >
              <div class="min-w-0 flex-1 text-left">
                <p class="truncate text-xs font-black text-[var(--text-primary)]">
                  {{ course.title }}
                </p>
                <p class="mt-0.5 text-[10px]" style="color: var(--text-secondary)">
                  {{ course.category?.name || '未分类' }} · {{ course._count?.lessons || 0 }} 节课
                </p>
              </div>
              <Badge variant="primary" outline>
                {{ course._count?.enrollments || 0 }} 人报名
              </Badge>
            </button>
            <div
              v-if="!topCourses?.length"
              class="empty-line py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
            >
              暂无课程数据
            </div>
          </div>
        </div>

        <!-- Tab: Recent Feedback -->
        <div v-show="activeActivityTab === 'feedback'" class="space-y-2">
          <div class="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>最新的用户工单与产品反馈信息。</span>
            <Button variant="link" size="sm" @click="emit('navigate', '/admin/feedback')">
              处理反馈
            </Button>
          </div>
          <div class="list-stack">
            <button
              v-for="feedback in recentFeedbacks"
              :key="feedback.id"
              type="button"
              class="list-row flex items-center justify-between gap-2.5 p-2 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs cursor-pointer w-full"
              @click="emit('navigate', '/admin/feedback')"
            >
              <div class="min-w-0 flex-1 text-left">
                <p class="truncate text-xs font-black text-[var(--text-primary)]">
                  {{ feedback.title }}
                </p>
                <p class="mt-0.5 text-[10px]" style="color: var(--text-secondary)">
                  {{ feedback.user?.name || feedback.user?.email || '匿名用户' }} ·
                  {{ formatDate(feedback.updatedAt) }}
                </p>
              </div>
              <Badge :variant="getStatusBadgeVariant(feedback.status)">{{ feedback.status }}</Badge>
            </button>
            <div
              v-if="!recentFeedbacks?.length"
              class="empty-line py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
            >
              暂无用户反馈
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- System Activity Feed Card (Tabbed) -->
    <Card padding="sm">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <h2
            class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
          >
            <Activity class="h-4 w-4 text-[var(--accent)]" />
            系统活动流
          </h2>
          <Tabs
            :model-value="activeFeedTab"
            :options="[
              { label: '新用户', value: 'users' },
              { label: '审计日志', value: 'logs' },
            ]"
            size="sm"
            variant="solid"
            @update:model-value="emit('update:activeFeedTab', $event as 'users' | 'logs')"
          />
        </div>
      </template>

      <div class="tab-content min-h-[170px]">
        <!-- Tab: Users -->
        <div v-show="activeFeedTab === 'users'" class="space-y-2">
          <div class="list-stack">
            <button
              v-for="user in recentUsers"
              :key="user.id"
              type="button"
              class="user-row flex items-center gap-2.5 p-2 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs cursor-pointer w-full"
              @click="emit('navigate', '/admin/users')"
            >
              <UserAvatar :user="user" size="sm" />
              <span class="min-w-0 flex-1 text-left">
                <b class="text-xs font-bold block truncate text-[var(--text-primary)]">{{
                  user.name || '未命名用户'
                }}</b>
                <small class="truncate block text-[9px] text-slate-400 mt-0.5">{{
                  user.email
                }}</small>
              </span>
              <Badge :variant="getStatusBadgeVariant(user.status)">{{ user.status }}</Badge>
            </button>
            <div
              v-if="!recentUsers?.length"
              class="empty-line py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
            >
              暂无新用户
            </div>
          </div>
          <Button
            v-if="recentUsers?.length"
            variant="link"
            size="sm"
            full-width
            class="mt-1"
            @click="emit('navigate', '/admin/users')"
          >
            进入用户管理
          </Button>
        </div>

        <!-- Tab: Audit Logs -->
        <div v-show="activeFeedTab === 'logs'" class="space-y-2">
          <div class="timeline flex flex-col gap-1.5">
            <button
              v-for="log in recentAuditLogs"
              :key="log.id"
              type="button"
              class="timeline-item flex items-start gap-2.5 p-2 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs cursor-pointer w-full"
              @click="emit('navigate', '/admin/audit-logs')"
            >
              <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"></span>
              <div class="text-left flex-1 min-w-0">
                <p class="font-bold text-xs text-[var(--text-primary)]">
                  {{ getActionLabel(log.action) }}
                </p>
                <small class="block text-slate-500 mt-0.5"
                  >{{ log.user?.name || log.user?.email || 'System' }} ·
                  {{ formatDate(log.createdAt) }}</small
                >
              </div>
            </button>
            <div
              v-if="!recentAuditLogs?.length"
              class="empty-line py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
            >
              暂无审计记录
            </div>
          </div>
          <Button
            v-if="recentAuditLogs?.length"
            variant="link"
            size="sm"
            full-width
            class="mt-1"
            @click="emit('navigate', '/admin/audit-logs')"
          >
            查看全部审计日志
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Sparkles, Filter, MessageSquare } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import type { Feedback } from '@/types';

interface Props {
  feedbacks: Feedback[];
  title: string;
  description: string;
  pageUrl: string;
  attachmentUrl: string;
}

defineProps<Props>();

const emit = defineEmits(['select']);

const ticketNo = (id?: string) => (id ? `#${id.slice(0, 8).toUpperCase()}` : '#NEW');

const formatRelativeDate = (value?: string | null) => {
  if (!value) return '无记录';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    OPEN: '待处理',
    IN_PROGRESS: '处理中',
    RESOLVED: '已解决',
    CLOSED: '已关闭',
  };
  return map[status] || status;
};
</script>

<template>
  <aside class="assist-panel">
    <Card>
      <div class="side-title">
        <Sparkles />
        <h3>处理流程</h3>
      </div>
      <div
        class="process-timeline relative pl-4 mt-2 before:content-[''] before:absolute before:left-[6px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--border-base)]"
      >
        <div class="timeline-item relative pb-4">
          <span
            class="absolute left-[-16px] top-1 w-2.5 h-2.5 rounded-full border border-[var(--border-base)] bg-[var(--bg-card)] flex items-center justify-center text-[8px] font-bold text-[var(--accent)] shrink-0"
            >1</span
          >
          <h4 class="text-xs font-bold text-[var(--text-primary)] pl-2">提交接收</h4>
          <p class="text-[11px] text-[var(--text-muted)] mt-1 pl-2">
            系统记录问题截图、关联链接与工单优先级，并即时推送到后台管理员队列。
          </p>
        </div>
        <div class="timeline-item relative pb-4">
          <span
            class="absolute left-[-16px] top-1 w-2.5 h-2.5 rounded-full border border-[var(--border-base)] bg-[var(--bg-card)] flex items-center justify-center text-[8px] font-bold text-[var(--accent)] shrink-0"
            >2</span
          >
          <h4 class="text-xs font-bold text-[var(--text-primary)] pl-2">分析与处理</h4>
          <p class="text-[11px] text-[var(--text-muted)] mt-1 pl-2">
            管理员根据您填写的重现信息与链接进行分析定位，并更新工单解决进度。
          </p>
        </div>
        <div class="timeline-item relative">
          <span
            class="absolute left-[-16px] top-1 w-2.5 h-2.5 rounded-full border border-[var(--border-base)] bg-[var(--bg-card)] flex items-center justify-center text-[8px] font-bold text-[var(--accent)] shrink-0"
            >3</span
          >
          <h4 class="text-xs font-bold text-[var(--text-primary)] pl-2">确认与回访</h4>
          <p class="text-[11px] text-[var(--text-muted)] mt-1 pl-2">
            您将在“我的工单”和通知中心收到反馈，确认已解决后即可自主关闭工单。
          </p>
        </div>
      </div>
    </Card>

    <Card>
      <div class="side-title">
        <Filter />
        <h3>提交质量</h3>
      </div>
      <div class="quality-list space-y-2 mt-2">
        <div class="flex items-center justify-between text-xs py-1 border-b border-base/40">
          <span class="text-[var(--text-secondary)]">标题长度 (≥3字)</span>
          <span
            class="font-mono text-[11px]"
            :class="title.trim().length >= 3 ? 'text-emerald-500 font-bold' : 'text-amber-500'"
          >
            {{ title.trim().length }}/3
          </span>
        </div>
        <div class="flex items-center justify-between text-xs py-1 border-b border-base/40">
          <span class="text-[var(--text-secondary)]">问题描述 (≥15字)</span>
          <span
            class="font-mono text-[11px]"
            :class="
              description.trim().length >= 15 ? 'text-emerald-500 font-bold' : 'text-amber-500'
            "
          >
            {{ description.trim().length }}/15
          </span>
        </div>
        <div class="flex items-center justify-between text-xs py-1 border-b border-base/40">
          <span class="text-[var(--text-secondary)]">页面链接关联</span>
          <Badge
            :variant="pageUrl.trim() ? 'success' : 'warning'"
            size="sm"
            class="!px-1.5 !py-0.5 text-[10px]"
          >
            {{ pageUrl.trim() ? '已关联' : '无链接' }}
          </Badge>
        </div>
        <div class="flex items-center justify-between text-xs py-1">
          <span class="text-[var(--text-secondary)]">图片截图附件</span>
          <Badge
            :variant="attachmentUrl ? 'success' : 'primary'"
            size="sm"
            class="!px-1.5 !py-0.5 text-[10px]"
          >
            {{ attachmentUrl ? '已上传' : '无附件' }}
          </Badge>
        </div>
      </div>
    </Card>

    <Card class="mini-feed">
      <div class="side-title">
        <MessageSquare />
        <h3>最近工单</h3>
      </div>
      <button
        v-for="item in feedbacks.slice(0, 4)"
        :key="item.id"
        type="button"
        class="mini-ticket"
        @click="emit('select', item)"
      >
        <span>{{ ticketNo(item.id) }}</span>
        <strong>{{ item.title }}</strong>
        <small>{{ statusLabel(item.status) }} · {{ formatRelativeDate(item.updatedAt) }}</small>
      </button>
      <div v-if="feedbacks.length === 0" class="empty-mini">还没有历史反馈</div>
    </Card>
  </aside>
</template>

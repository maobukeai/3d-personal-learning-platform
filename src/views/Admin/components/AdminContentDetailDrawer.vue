<script setup lang="ts">
import { X, CheckCircle2, AlertTriangle, Trash2, Edit3 } from 'lucide-vue-next';
import { formatDateTime } from '@/utils/format';
import UserAvatar from '@/components/UserAvatar.vue';
import UiButton from '@/components/ui/Button.vue';
import AdminContentStatusBadge from './AdminContentStatusBadge.vue';
import type { ContentItem, PageConfig } from '../composables/useAdminContents';

const props = defineProps<{
  item: ContentItem | null;
  open: boolean;
  pageConfig: PageConfig;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'edit', item: ContentItem): void;
  (e: 'delete', item: ContentItem): void;
  (e: 'approve', item: ContentItem): void;
  (e: 'reject', item: ContentItem): void;
}>();
</script>

<template>
  <div
    v-if="open && item"
    class="w-full lg:w-96 border-l border-slate-100 dark:border-white/5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex flex-col h-full shrink-0 z-10"
  >
    <!-- Header -->
    <div
      class="p-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <AdminContentStatusBadge :status="item.status" />
        <span class="text-xs font-semibold text-[var(--text-muted)] truncate max-w-[180px]">
          ID: {{ item.id }}
        </span>
      </div>
      <button
        type="button"
        class="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        @click="emit('close')"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Media Preview -->
      <div
        class="w-full h-44 rounded-xl border border-slate-100 dark:border-white/5 overflow-hidden bg-slate-950 flex items-center justify-center relative"
      >
        <img
          v-if="item.thumbnail || item.thumbnailUrl || item.previewUrl"
          :src="item.thumbnail || item.thumbnailUrl || item.previewUrl || ''"
          class="w-full h-full object-contain"
        />
        <div v-else class="text-xs text-slate-500">无预览图</div>
      </div>

      <!-- Content Info -->
      <div>
        <h3 class="text-sm font-bold text-[var(--text-primary)]">{{ item.title }}</h3>
        <p class="text-xs text-[var(--text-secondary)] mt-1 whitespace-pre-wrap leading-relaxed">
          {{ item.description || '暂无详细描述' }}
        </p>
      </div>

      <!-- Author -->
      <div
        class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5"
      >
        <div class="flex items-center gap-2">
          <UserAvatar :user="item.user" size="sm" />
          <div class="text-xs">
            <div class="font-semibold text-[var(--text-primary)]">
              {{ item.user?.name || '未知发布者' }}
            </div>
            <div class="text-[var(--text-muted)] text-[10px]">
              {{ item.user?.email || '无邮箱信息' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Meta stats -->
      <div class="grid grid-cols-3 gap-2 text-center text-xs">
        <div
          class="p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5"
        >
          <div class="text-[var(--text-muted)] text-[10px]">浏览</div>
          <div class="font-semibold text-[var(--text-primary)] mt-0.5">{{ item.views || 0 }}</div>
        </div>
        <div
          class="p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5"
        >
          <div class="text-[var(--text-muted)] text-[10px]">点赞</div>
          <div class="font-semibold text-[var(--text-primary)] mt-0.5">{{ item.likes || 0 }}</div>
        </div>
        <div
          class="p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5"
        >
          <div class="text-[var(--text-muted)] text-[10px]">下载</div>
          <div class="font-semibold text-[var(--text-primary)] mt-0.5">
            {{ item.downloads || 0 }}
          </div>
        </div>
      </div>

      <div class="text-[10px] text-[var(--text-muted)] space-y-1">
        <div>发布时间：{{ formatDateTime(item.createdAt) }}</div>
        <div v-if="item.updatedAt">更新时间：{{ formatDateTime(item.updatedAt) }}</div>
      </div>
    </div>

    <!-- Footer Action Buttons -->
    <div
      class="p-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2"
    >
      <UiButton variant="secondary" size="sm" :icon="Edit3" @click="emit('edit', item)"
        >编辑</UiButton
      >
      <div class="flex items-center gap-2">
        <UiButton
          v-if="item.status !== 'APPROVED'"
          variant="primary"
          size="sm"
          :icon="CheckCircle2"
          @click="emit('approve', item)"
        >
          通过
        </UiButton>
        <UiButton
          v-if="item.status !== 'REJECTED'"
          variant="secondary"
          size="sm"
          :icon="AlertTriangle"
          @click="emit('reject', item)"
        >
          打回
        </UiButton>
        <UiButton variant="danger" size="sm" :icon="Trash2" @click="emit('delete', item)"
          >删除</UiButton
        >
      </div>
    </div>
  </div>
</template>

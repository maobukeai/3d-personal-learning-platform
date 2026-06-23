<script setup lang="ts">
import { AlertTriangle, Inbox, Edit3, Trash2 } from 'lucide-vue-next';
import { formatDateTime as formatDate } from '@/utils/format';
import Modal from '@/components/ui/Modal.vue';
import UiButton from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import AdminContentStatusBadge from './AdminContentStatusBadge.vue';
import type { ContentItem, PageConfig } from '../AdminContentsView.vue';

const props = defineProps<{
  modelValue: boolean;
  item: ContentItem | null;
  activeTab: 'assets' | 'materials' | 'showcases' | 'plugins';
  pageConfig: PageConfig;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit', item: ContentItem): void;
  (e: 'delete', item: ContentItem): void;
}>();

const mediaUrl = (item: ContentItem) => {
  return item.thumbnail || item.thumbnailUrl || item.previewUrl || '';
};

const itemKind = (item: ContentItem) => {
  if (props.activeTab === 'assets') return item.type || 'GLB';
  if (props.activeTab === 'materials') return item.resolution || '程序化';
  if (props.activeTab === 'showcases') return item.type === 'VIDEO' ? '视频作品' : '图文作品';
  return '应用扩展';
};

const metricLine = (item: ContentItem) => {
  const views = item.views ?? 0;
  const likes = item.likes ?? 0;
  const downloads = item.downloads ?? 0;
  return `浏览 ${views} · 点赞 ${likes} · 下载 ${downloads}`;
};
</script>

<template>
  <Modal
    :show="modelValue"
    title="资源详情"
    size="md"
    glass-card
    @close="emit('update:modelValue', false)"
  >
    <template v-if="item">
      <div class="flex flex-col gap-4 text-left">
        <!-- Media Preview -->
        <div
          class="w-full aspect-video rounded-xl border border-base overflow-hidden flex items-center justify-center bg-[var(--bg-app)] relative group/modal-media"
        >
          <img v-if="mediaUrl(item)" :src="mediaUrl(item)" class="w-full h-full object-cover" />
          <component :is="pageConfig.icon" v-else class="w-12 h-12 text-[var(--text-muted)]" />
        </div>

        <!-- Basic Info -->
        <div>
          <div class="flex items-center gap-2 mb-2 mobile-row">
            <AdminContentStatusBadge :status="item.status" />
            <span class="text-xs text-[var(--text-muted)]">{{ formatDate(item.createdAt) }}</span>
          </div>
          <h3 class="text-lg font-black text-[var(--text-primary)] leading-tight mb-2">
            {{ item.title }}
          </h3>
          <p
            class="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar"
          >
            {{ item.description || '暂无描述信息' }}
          </p>
        </div>

        <!-- Details Grid -->
        <div class="border-t border-base pt-3 space-y-2">
          <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            资产元数据
          </h4>

          <div
            class="grid grid-cols-2 gap-3 text-xs bg-[var(--bg-app)] p-3 rounded-xl border border-base"
          >
            <div>
              <span class="text-[var(--text-muted)] block mb-0.5">作者</span>
              <span class="font-bold text-[var(--text-primary)]">
                {{ item.user?.name || item.user?.email || '匿名创作者' }}
              </span>
            </div>
            <div>
              <span class="text-[var(--text-muted)] block mb-0.5">类型/类别</span>
              <span class="font-bold text-[var(--text-primary)]">{{ itemKind(item) }}</span>
            </div>
            <div class="col-span-2 border-t border-strong pt-2 mt-1">
              <span class="text-[var(--text-muted)] block mb-0.5">指标数据</span>
              <span class="font-bold text-[var(--text-primary)]">{{ metricLine(item) }}</span>
            </div>
          </div>
        </div>

        <!-- Extra details e.g., Tags, Reject Reason -->
        <div v-if="item.tags" class="border-t border-base pt-3">
          <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            标签
          </h4>
          <div class="flex flex-wrap gap-1.5">
            <Badge v-for="tag in item.tags.split(',')" :key="tag" variant="info" outline>
              {{ tag.trim() }}
            </Badge>
          </div>
        </div>

        <div
          v-if="item.rejectReason"
          class="border-t border-base pt-3 bg-red-500/5 p-3 rounded-xl border border-red-500/10"
        >
          <h4
            class="text-xs font-bold text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1"
          >
            <AlertTriangle class="w-3.5 h-3.5" /> 退回理由
          </h4>
          <p class="text-xs text-red-600 dark:text-red-400 font-medium leading-normal">
            {{ item.rejectReason }}
          </p>
        </div>
      </div>
    </template>
    <div
      v-else
      class="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] gap-2"
    >
      <Inbox class="w-8 h-8" />
      <span class="text-sm font-semibold">未选中资源</span>
    </div>

    <template v-if="item" #footer>
      <div class="flex w-full gap-2 justify-end">
        <UiButton
          variant="secondary"
          :icon="Edit3"
          @click="
            () => {
              emit('update:modelValue', false);
              if (item) emit('edit', item);
            }
          "
        >
          编辑资源
        </UiButton>
        <UiButton
          variant="secondary"
          class="danger-action"
          :icon="Trash2"
          @click="
            () => {
              emit('update:modelValue', false);
              if (item) emit('delete', item);
            }
          "
        >
          彻底删除
        </UiButton>
        <UiButton variant="secondary" @click="emit('update:modelValue', false)"> 关闭 </UiButton>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.danger-action {
  background: rgba(220, 38, 38, 0.05) !important;
  color: var(--danger) !important;
  border-color: rgba(220, 38, 38, 0.15) !important;
}

.danger-action:hover {
  background: rgba(220, 38, 38, 0.1) !important;
}
</style>

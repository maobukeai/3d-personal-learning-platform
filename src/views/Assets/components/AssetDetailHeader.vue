<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { Calendar, Eye, MoreHorizontal, Share2, ShieldCheck, Star, User } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import type { AssetDetail } from './types';
import UiButton from '@/components/ui/Button.vue';

type ReviewStatus = { label: string; tone: 'success' | 'warning' | 'danger' };

defineProps<{
  asset: AssetDetail | null;
  reviewStatus: ReviewStatus;
  favoriteCount: number;
  viewCount: number;
}>();

const emit = defineEmits<{
  favorite: [];
  share: [];
}>();
</script>

<template>
  <header class="detail-header mobile-row">
    <div class="title-block">
      <div class="title-row mobile-row">
        <h1>{{ asset?.title || '模型详情' }}</h1>
        <span class="review-pill" :data-tone="reviewStatus.tone">{{ reviewStatus.label }}</span>
      </div>
      <div class="meta-row mobile-row">
        <span class="tag-pill">3D模型</span>
        <span><User class="h-4 w-4" />{{ asset?.user?.name || '未知用户' }}</span>
        <span
          ><ShieldCheck class="h-4 w-4" />{{
            asset?.user?.role === 'ADMIN' ? '系统管理员' : '创作者'
          }}</span
        >
        <span><Calendar class="h-4 w-4" />{{ formatDate(asset?.createdAt) }}</span>
        <span><Eye class="h-4 w-4" />{{ viewCount }}</span>
      </div>
    </div>

    <div class="header-actions mobile-row">
      <UiButton variant="secondary" :icon="Star" @click="emit('favorite')">
        收藏 {{ favoriteCount }}
      </UiButton>
      <UiButton variant="secondary" :icon="Share2" @click="emit('share')">分享</UiButton>
      <button type="button" class="icon-button" @click="ElMessage.info('更多操作入口已保留')">
        <MoreHorizontal class="h-4 w-4" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin: 18px 0 14px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-row h1 {
  margin: 0;
  color: #111b34;
  font-size: 26px;
  line-height: 1.2;
}

.review-pill,
.tag-pill {
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 900;
}

.review-pill[data-tone='success'] {
  color: #11a36a;
  background: #e8fbf1;
}
.review-pill[data-tone='warning'] {
  color: #d17a00;
  background: #fff4dd;
}
.review-pill[data-tone='danger'] {
  color: #dc2626;
  background: #fee2e2;
}
.tag-pill {
  color: #6757ff;
  background: #f0efff;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  margin-top: 12px;
  color: #68758f;
  font-size: 13px;
}

.meta-row span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 36px;
  height: 36px;
  border: 1px solid #e5eaf5;
  border-radius: 8px;
  background: #fff;
  color: #40506e;
  padding: 0;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

@media (max-width: 760px) {
  .detail-header {
    flex-direction: column;
    gap: 8px;
  }

  .title-row h1 {
    font-size: 18px;
  }
}
</style>

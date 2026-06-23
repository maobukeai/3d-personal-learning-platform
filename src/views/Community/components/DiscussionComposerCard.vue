<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Edit3 } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { useLabel } from '@/utils/i18n';

defineProps<{
  user: {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    role?: string;
  } | null;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const { t } = useI18n();
const label = useLabel();
</script>

<template>
  <div class="composer-card-premium">
    <UserAvatar :user="user" size="md" />
    <button type="button" class="composer-trigger-premium mobile-row" @click="emit('click')">
      <span>{{
        label(
          '分享你的 3D 学习心得，在此发布新讨论...',
          'Share your 3D learning insights, start a new discussion...',
        )
      }}</span>
      <div class="composer-btn-inner">
        <Edit3 class="h-3.5 w-3.5" />
        <span>{{ t('community.discussions.newPost') }}</span>
      </div>
    </button>
  </div>
</template>

<style scoped>
.composer-card-premium {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
}

.composer-trigger-premium {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.composer-trigger-premium:hover {
  border-color: rgba(37, 99, 235, 0.3);
  background: rgba(37, 99, 235, 0.05);
  color: var(--text-secondary);
}

.composer-trigger-premium span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-btn-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.composer-trigger-premium:hover .composer-btn-inner {
  transform: translateY(-0.5px);
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2);
}
</style>

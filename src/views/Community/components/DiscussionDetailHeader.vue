<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Pin, Trash2, X } from 'lucide-vue-next';
import { formatRelativeTime as formatTime } from '@/utils/format';
import UserAvatar from '@/components/UserAvatar.vue';
import type { Discussion } from '../DiscussionsView.vue';

const props = defineProps<{
  discussion: Discussion;
  currentUserId: string | undefined;
  isAdmin: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'set-tag', tagName: string): void;
  (e: 'toggle-pin'): void;
  (e: 'delete'): void;
}>();

const { t } = useI18n();

const canDelete = () => props.currentUserId === props.discussion.user?.id || props.isAdmin;
</script>

<template>
  <header class="detail-header mobile-adaptive">
    <div class="detail-author mobile-row">
      <UserAvatar :user="discussion.user" size="sm" />
      <div>
        <strong>{{ discussion.user?.name || t('community.discussions.anonymous') }}</strong>
        <span>{{ formatTime(discussion.createdAt) }}</span>
      </div>
      <i v-if="discussion.isPinned">
        <Pin class="h-3 w-3" />
        {{ t('community.discussions.pinned') }}
      </i>
    </div>
    <div class="modal-actions mobile-row">
      <button
        v-if="isAdmin"
        type="button"
        :class="{ 'is-active': discussion.isPinned }"
        @click="emit('toggle-pin')"
      >
        <Pin class="h-4 w-4" />
      </button>
      <button v-if="canDelete()" type="button" class="danger" @click="emit('delete')">
        <Trash2 class="h-4 w-4" />
      </button>
      <button type="button" @click="emit('close')">
        <X class="h-4 w-4" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-base);
}

.detail-author {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.detail-author strong {
  display: block;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 950;
}

.detail-author span {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 750;
}

.detail-author i {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-style: normal;
  font-weight: 850;
}

.modal-actions {
  display: flex;
  gap: 6px;
}

.modal-actions button {
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.modal-actions button.is-active {
  border-color: var(--accent);
  color: var(--accent);
}

.modal-actions button.danger {
  color: #ef4444;
}
</style>

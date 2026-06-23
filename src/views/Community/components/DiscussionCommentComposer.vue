<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { LoaderCircle, Send } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';

defineProps<{
  modelValue: string;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'submit'): void;
}>();

const { t } = useI18n();
const authStore = useAuthStore();

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
};
</script>

<template>
  <div class="comment-composer mobile-adaptive mobile-row">
    <UserAvatar :user="authStore.user" size="sm" />
    <div>
      <textarea
        :value="modelValue"
        rows="3"
        :placeholder="t('community.discussions.commentPlaceholder')"
        @input="onInput"
      ></textarea>
      <button type="button" :disabled="!modelValue.trim() || isSubmitting" @click="emit('submit')">
        <LoaderCircle v-if="isSubmitting" class="h-3.5 w-3.5 animate-spin" />
        <Send v-else class="h-3.5 w-3.5" />
        {{ t('community.discussions.postComment') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.comment-composer {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid var(--border-base);
  background: var(--bg-card);
}

.comment-composer > div {
  flex: 1;
  min-width: 0;
}

.comment-composer textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: var(--bg-app);
  color: var(--text-primary);
  font-size: 12px;
  resize: vertical;
  outline: none;
  margin-bottom: 8px;
}

.comment-composer textarea:focus {
  border-color: var(--accent);
}

.comment-composer button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.comment-composer button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

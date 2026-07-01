<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { LoaderCircle, Send } from 'lucide-vue-next';

defineProps<{
  modelValue: string;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'submit'): void;
}>();

const { t } = useI18n();

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
};
</script>

<template>
  <div class="comment-composer mobile-adaptive mobile-row">
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
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-base);
  background: var(--bg-card);
  transition: all 0.3s ease;
}

.comment-composer > div {
  flex: 1;
  min-width: 0;
}

.comment-composer textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border-base);
  border-radius: 14px;
  background: var(--bg-app);
  color: var(--text-primary);
  font-size: 12.5px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  margin-bottom: 10px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
}

.comment-composer textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
}

.comment-composer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 25%, transparent);
}

.comment-composer button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--accent) 40%, transparent);
  filter: brightness(1.05);
}

.comment-composer button:not(:disabled):active {
  transform: translateY(0);
}

.comment-composer button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
</style>

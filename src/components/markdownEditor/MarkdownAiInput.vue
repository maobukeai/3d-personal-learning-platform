<script setup lang="ts">
import { ref, computed } from 'vue';
import { Send } from 'lucide-vue-next';
const props = defineProps<{ isGenerating: boolean }>();
const emit = defineEmits<{ (e: 'submit'): void }>();
const chatText = defineModel<string>('chatText', { required: true });
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const chatRows = computed(() => Math.min(chatText.value.split('\n').length, 4));
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    emit('submit');
  }
};
const focus = () => {
  textareaRef.value?.focus();
};
defineExpose({ focus });
</script>
<template>
  <footer class="aip__ft">
    <div class="aip__chat">
      <textarea
        ref="textareaRef"
        v-model="chatText"
        :rows="chatRows"
        placeholder="输入创作指令（例：写一篇 Blender 快捷键介绍...）"
        class="aip__chat-input"
        :disabled="isGenerating"
        @keydown="onKeydown"
      ></textarea>
      <button
        type="button"
        class="aip__chat-send"
        :class="{ 'aip__chat-send--on': chatText.trim() && !isGenerating }"
        :disabled="!chatText.trim() || isGenerating"
        @click="emit('submit')"
      >
        <Send class="w-3.5 h-3.5" />
      </button>
    </div>
  </footer>
</template>
<style scoped>
.aip__ft {
  border-top: 1px solid var(--border-base);
  padding: 9px 10px;
  flex-shrink: 0;
  background-color: var(--bg-card);
}
.aip__chat {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--bg-app);
  border: 1.5px solid var(--border-base);
  border-radius: 10px;
  padding: 7px 8px;
  transition: border-color 0.15s;
}
.aip__chat:focus-within {
  border-color: var(--accent);
}
.aip__chat-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  resize: none;
  font-size: 12.5px;
  color: var(--text-primary);
  line-height: 1.45;
  min-height: 20px;
  max-height: 80px;
  overflow-y: auto;
  font-family: inherit;
  user-select: text;
}
.aip__chat-input::placeholder {
  color: var(--text-muted);
}
.aip__chat-input:disabled {
  opacity: 0.5;
}
.aip__chat-send {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  border: none;
  background: var(--border-base);
  color: var(--text-muted);
  cursor: not-allowed;
  transition: all 0.15s ease;
}
.aip__chat-send--on {
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
.aip__chat-send--on:hover {
  background: var(--accent-hover);
}
</style>

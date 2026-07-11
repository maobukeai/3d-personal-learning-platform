<script setup lang="ts">
import { Play, RotateCcw, SlidersHorizontal, ShieldCheck } from 'lucide-vue-next';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import {
  AI_COMMANDS,
  TONE_OPTIONS,
  LENGTH_OPTIONS,
  FORMAT_OPTIONS,
  type AIAction,
  type WritingTone,
  type WritingLength,
  type WritingFormat,
} from '@/composables/useMarkdownAi';
defineProps<{
  isGenerating: boolean;
  canRunAction: boolean;
  hasMessages: boolean;
  contextQuality: string;
  contextCharCount: number;
  activeActionLabel: string;
  contextPreview: string;
}>();
const emit = defineEmits<{ (e: 'run'): void; (e: 'clear'): void }>();
const aiAction = defineModel<AIAction>('aiAction', { required: true });
const showSettings = defineModel<boolean>('showSettings', { required: true });
const targetLanguage = defineModel<string>('targetLanguage', { required: true });
const writingTone = defineModel<WritingTone>('writingTone', { required: true });
const writingLength = defineModel<WritingLength>('writingLength', { required: true });
const writingFormat = defineModel<WritingFormat>('writingFormat', { required: true });
const customInstruction = defineModel<string>('customInstruction', { required: true });
</script>
<template>
  <div>
    <!-- ── Toolbar (chips and triggers) ────── -->
    <div class="aip__toolbar">
      <div class="aip__chips">
        <button
          v-for="cmd in AI_COMMANDS"
          :key="cmd.value"
          type="button"
          class="aip__chip"
          :class="{
            'aip__chip--active': aiAction === cmd.value,
            'aip__chip--disabled': isGenerating,
          }"
          :disabled="isGenerating"
          @click="aiAction = cmd.value as AIAction"
        >
          <span>{{ cmd.icon }}</span> <span>{{ cmd.label }}</span>
        </button>
      </div>
      <div class="aip__toolbar-actions">
        <!-- Language Select for Translate -->
        <Transition name="fade">
          <Select
            v-if="aiAction === 'translate'"
            v-model="targetLanguage"
            class="aip__translate-select !w-32 custom-select"
            :disabled="isGenerating"
          >
            <SelectOption value="English" label="English" />
            <SelectOption value="中文 (简体)" label="中文" />
            <SelectOption value="日本語" label="日本語" />
            <SelectOption value="Deutsch" label="Deutsch" />
            <SelectOption value="Français" label="Français" />
            <SelectOption value="Español" label="Español" />
          </Select>
        </Transition>
        <button type="button" class="aip__run-btn" :disabled="!canRunAction" @click="emit('run')">
          <Play class="w-3 h-3 fill-current" /> <span>生成</span>
        </button>
        <button
          v-if="hasMessages"
          type="button"
          class="aip__clear-btn"
          title="清空对话历史"
          :disabled="isGenerating"
          @click="emit('clear')"
        >
          <RotateCcw class="w-3 h-3" />
        </button>
        <button
          type="button"
          class="aip__ico-btn aip__settings-btn"
          :class="{ 'aip__settings-btn--on': showSettings }"
          title="AI 参数控制"
          @click="showSettings = !showSettings"
        >
          <SlidersHorizontal class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    <!-- ── Context preview banner ───────────── -->
    <section class="aip__brief">
      <div class="aip__brief-main">
        <span class="aip__quality-badge">{{ contextQuality }}</span>
        <span class="aip__char-count">{{ contextCharCount }} 字数</span>
        <strong v-if="aiAction === 'translate'">翻译至 {{ targetLanguage }}</strong>
        <strong v-else>使用 {{ activeActionLabel }} 策略</strong>
      </div>
      <p>{{ contextPreview }}</p>
    </section>
    <!-- ── Settings Drawer (Sliders) ────────── -->
    <section v-if="showSettings" class="aip__settings">
      <div class="aip__seg-row">
        <span>语气风格</span>
        <div class="aip__seg">
          <button
            v-for="o in TONE_OPTIONS"
            :key="o.value"
            type="button"
            :class="{ 'is-on': writingTone === o.value }"
            @click="writingTone = o.value"
          >
            {{ o.label }}
          </button>
        </div>
      </div>
      <div class="aip__seg-row">
        <span>篇幅字数</span>
        <div class="aip__seg aip__seg--compact">
          <button
            v-for="o in LENGTH_OPTIONS"
            :key="o.value"
            type="button"
            :class="{ 'is-on': writingLength === o.value }"
            @click="writingLength = o.value"
          >
            {{ o.label }}
          </button>
        </div>
        <span>排版格式</span>
        <div class="aip__seg">
          <button
            v-for="o in FORMAT_OPTIONS"
            :key="o.value"
            type="button"
            :class="{ 'is-on': writingFormat === o.value }"
            @click="writingFormat = o.value"
          >
            {{ o.label }}
          </button>
        </div>
      </div>
      <input
        v-model="customInstruction"
        type="text"
        placeholder="高级微调：在此处输入具体微调指示（例：用鲁迅口吻、使用幽默调子）"
        class="aip__instruction"
        :disabled="isGenerating"
      />
      <div class="aip__guard">
        <ShieldCheck class="w-3.5 h-3.5 text-slate-400" />
        <span>AI 大模型在智能排版与分析时不影响您的原始文档</span>
      </div>
    </section>
  </div>
</template>
<style scoped>
.aip__toolbar {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-base);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  background: var(--bg-card);
}
.aip__chips {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow-x: auto;
}
.aip__chips::-webkit-scrollbar {
  display: none;
}
.aip__chip {
  padding: 4.5px 8px;
  border-radius: 7px;
  font-size: 11.5px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3.5px;
  white-space: nowrap;
  transition: all 0.15s;
}
.aip__chip:hover:not(.aip__chip--disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.aip__chip--active {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 500;
}
.aip__chip--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.aip__toolbar-actions {
  display: flex;
  align-items: center;
  gap: 5.5px;
  flex-shrink: 0;
}
.aip__run-btn {
  padding: 4.5px 9px;
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  border: none;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s;
}
.aip__run-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}
.aip__run-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.aip__clear-btn {
  width: 25px;
  height: 25px;
  border-radius: 6px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.aip__clear-btn:hover {
  border-color: #ef4444;
  color: #ef4444;
}
.aip__ico-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.aip__ico-btn:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}
.aip__settings-btn {
  background: var(--bg-app);
  border: 1px solid var(--border-base);
}
.aip__settings-btn--on {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}
.aip__translate-select {
  padding: 4px 6px;
  border-radius: 7px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  font-size: 11.5px;
  outline: none;
  color: var(--text-primary);
}
.aip__brief {
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border-base);
  padding: 7px 10px;
  font-size: 11.5px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.aip__brief-main {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.aip__quality-badge {
  font-size: 10px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  padding: 1px 5px;
  border-radius: 4px;
}
.aip__char-count {
  color: var(--text-muted);
}
.aip__brief-main strong {
  margin-left: auto;
  font-weight: 600;
  color: var(--text-primary);
}
.aip__brief p {
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.aip__settings {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-base);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}
.aip__seg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  color: var(--text-secondary);
}
.aip__seg-row > span {
  font-size: 11px;
  color: var(--text-muted);
  width: 52px;
  flex-shrink: 0;
}
.aip__seg {
  flex: 1;
  display: flex;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}
.aip__seg button {
  flex: 1;
  padding: 3px 0;
  border-radius: 4px;
  font-size: 11px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.aip__seg button.is-on {
  background: var(--bg-card);
  color: var(--text-primary);
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.aip__seg--compact button {
  font-size: 10.5px;
}
.aip__instruction {
  width: 100%;
  padding: 6px 9px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  border-radius: 7px;
  font-size: 11.5px;
  outline: none;
  color: var(--text-primary);
  transition: border-color 0.15s;
}
.aip__instruction:focus {
  border-color: var(--accent);
}
.aip__guard {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--text-muted);
}
.fade-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.fade-leave-to {
  opacity: 0;
}
@media (max-width: 767px) {
  .aip__toolbar {
    align-items: flex-start;
  }
  .aip__chips {
    flex-wrap: wrap;
  }
  .aip__seg-row {
    flex-wrap: wrap;
  }
  .aip__seg {
    flex-wrap: wrap;
  }
}
</style>

<script setup lang="ts">
import { Brain, Loader2 } from 'lucide-vue-next';

defineProps<{
  modelValue: string;
  recGoals: string[];
  isStartingAiPlanner: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'start'): void;
}>();
</script>

<template>
  <div class="space-y-6 my-auto max-w-2xl mx-auto w-full">
    <div class="text-center max-w-lg mx-auto space-y-2">
      <div
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold"
      >
        <Brain class="w-3.5 h-3.5 text-accent" />
        <span>对话式协同规划</span>
      </div>
      <h4 class="text-md font-bold text-slate-800 dark:text-slate-200">
        输入您的学习目标，让 AI 帮您做规划
      </h4>
      <p class="text-xs text-slate-400">
        只需一句话描述您想学的内容，AI 将为您智能定制阶段路线、梳理任务清单，并支持对话式微调。
      </p>
    </div>

    <!-- Input form -->
    <div
      class="p-6 bg-slate-50 dark:bg-white/[0.02] border rounded-2xl space-y-4"
      style="border-color: var(--border-base)"
    >
      <div class="space-y-1.5">
        <label class="text-[11px] font-black text-slate-500 uppercase tracking-wider"
          >您的学习目标或主题</label
        >
        <textarea
          :value="modelValue"
          rows="3"
          placeholder="例如：我想从零开始在 30 天内学完 Three.js 并开发一个 3D 个人画廊项目..."
          class="w-full px-4 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent leading-relaxed"
          style="border-color: var(--border-base); color: var(--text-primary)"
          :disabled="isStartingAiPlanner"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>

      <!-- Recommendation goals -->
      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-slate-400">推荐灵感</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(rec, rIdx) in recGoals"
            :key="rIdx"
            type="button"
            class="px-3 py-1.5 rounded-lg border text-[11px] text-slate-500 dark:text-slate-400 hover:text-accent hover:border-accent bg-white dark:bg-slate-900 transition-colors cursor-pointer text-left font-medium"
            style="border-color: var(--border-base)"
            :disabled="isStartingAiPlanner"
            @click="emit('update:modelValue', rec)"
          >
            💡 {{ rec }}
          </button>
        </div>
      </div>

      <button
        type="button"
        class="w-full py-3 bg-gradient-to-r from-accent to-indigo-600 hover:from-accent hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-accent/20 hover:shadow-accent/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        :disabled="isStartingAiPlanner || !modelValue.trim()"
        @click="emit('start')"
      >
        <Loader2 v-if="isStartingAiPlanner" class="w-4 h-4 animate-spin" />
        <Brain v-else class="w-4 h-4" />
        <span>开始对话生成规划</span>
      </button>
    </div>

    <!-- Tip alert -->
    <div
      class="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/[0.02] border border-indigo-100/50 dark:border-indigo-500/10 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex gap-2"
    >
      <span class="text-xs">💡</span>
      <div>
        <p class="font-bold text-indigo-900 dark:text-indigo-400">如何与 AI 规划助手协同？</p>
        <p class="mt-0.5">
          AI
          生成初始规划后，您可以针对看板任务和学习路线，在左侧对话框中直接提出修改要求。例如：“加一些进阶内容”、“把周期缩短至
          2 周”，右侧面板将实时更新呈现。
        </p>
      </div>
    </div>
  </div>
</template>

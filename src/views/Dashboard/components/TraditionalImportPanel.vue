<script setup lang="ts">
import { Sparkles, Loader2 } from 'lucide-vue-next';

defineProps<{
  aiImportEnabled: boolean;
  aiPrompt: string;
  isAiGenerating: boolean;
  importText: string;
  isImporting: boolean;
  isHelpOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:aiPrompt', val: string): void;
  (e: 'generate'): void;
  (e: 'copyTemplate'): void;
  (e: 'fillDemoData'): void;
  (e: 'update:importText', val: string): void;
  (e: 'importProject'): void;
  (e: 'cancel'): void;
  (e: 'toggleHelp'): void;
}>();
</script>

<template>
  <div class="space-y-4 flex flex-col justify-between">
    <div>
      <!-- AI Smart Copilot Generator Section -->
      <div
        v-if="aiImportEnabled"
        class="mb-4 p-4 rounded-2xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01] space-y-2.5 text-left"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5"
          >
            <Sparkles class="w-3.5 h-3.5 text-indigo-500" />
            AI 智能规划助手
          </span>
        </div>
        <p class="text-[10px] text-slate-400 leading-normal">
          没有现成规划文本？在下方输入您的学习意图与目标，AI
          将智能规划并在此自动生成大纲模板，省去手写排版！
        </p>
        <div class="flex gap-2">
          <input
            :value="aiPrompt"
            type="text"
            placeholder="例如：“我想用 1 个月时间，完成一个 3D 酷炫个人画廊网站，需要学习哪些技术”"
            class="flex-1 px-3 py-1.5 rounded-xl border text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent"
            style="border-color: var(--border-base); color: var(--text-primary)"
            :disabled="isAiGenerating"
            @input="emit('update:aiPrompt', ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1 shadow disabled:opacity-50"
            :disabled="isAiGenerating || !aiPrompt.trim()"
            @click="emit('generate')"
          >
            <Loader2 v-if="isAiGenerating" class="w-3.5 h-3.5 animate-spin" />
            <span>智能生成</span>
          </button>
        </div>
      </div>

      <div class="flex justify-between items-center mb-1 text-left">
        <label class="text-[11px] font-black text-slate-500 uppercase tracking-wider"
          >规划结构化文本</label
        >
        <div class="flex gap-2">
          <button
            type="button"
            class="text-[10px] text-accent font-bold hover:underline cursor-pointer"
            @click="emit('copyTemplate')"
          >
            复制空白模板
          </button>
          <span class="text-slate-300 dark:text-white/10">|</span>
          <button
            type="button"
            class="text-[10px] text-emerald-500 font-bold hover:underline cursor-pointer"
            @click="emit('fillDemoData')"
          >
            填入范例数据
          </button>
        </div>
      </div>

      <textarea
        :value="importText"
        rows="14"
        placeholder="项目：[项目名称]&#10;描述：[项目主旨简介]&#10;标签：[标签1, 标签2]&#10;截止日期：[YYYY-MM-DD]&#10;&#10;## 任务看板&#10;- [ ] 任务一标题 | 优先级:高 | 截止:2026-06-15 | 描述:任务描述&#10;&#10;## 学习路线&#10;### 阶段一：[阶段名称]&#10;描述：[阶段目标描述]&#10;- [ ] 子学习项标题"
        class="w-full p-4 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-mono leading-relaxed bg-white dark:bg-slate-900"
        style="border-color: var(--border-base); color: var(--text-primary)"
        :disabled="isImporting"
        @input="emit('update:importText', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
    </div>

    <div class="flex gap-3 justify-end pt-2">
      <button
        type="button"
        class="px-5 py-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-xs cursor-pointer"
        @click="emit('cancel')"
      >
        取消
      </button>
      <button
        type="button"
        class="px-4 py-2 rounded-xl border font-bold text-xs cursor-pointer text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
        style="border-color: var(--border-base)"
        @click="emit('toggleHelp')"
      >
        {{ isHelpOpen ? '隐藏解析说明' : '查看解析说明' }}
      </button>
      <button
        type="button"
        :disabled="isImporting || !importText.trim()"
        class="px-6 py-2 rounded-xl bg-accent text-white font-bold text-xs shadow-lg shadow-accent/15 hover:scale-103 active:scale-97 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        style="background: var(--accent)"
        @click="emit('importProject')"
      >
        <Loader2 v-if="isImporting" class="w-3.5 h-3.5 animate-spin" />
        <span>解析建档并导入</span>
      </button>
    </div>
  </div>
</template>

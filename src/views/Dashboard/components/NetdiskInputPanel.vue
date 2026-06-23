<script setup lang="ts">
import { Sparkles, Loader2, Compass } from 'lucide-vue-next';

defineProps<{
  modelValue: string;
  password: string;
  isParsingNetdisk: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'update:password', val: string): void;
  (e: 'parse'): void;
  (e: 'useTraditional'): void;
}>();
</script>

<template>
  <div class="space-y-6 my-auto max-w-2xl mx-auto w-full">
    <div class="text-center max-w-lg mx-auto space-y-2">
      <div
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold"
      >
        <Compass class="w-3.5 h-3.5" />
        <span>全新升级：百度网盘智能解析</span>
      </div>
      <h4 class="text-md font-bold text-slate-800 dark:text-slate-200">一键解析网盘课程/资源</h4>
      <p class="text-xs text-slate-400">
        我们将解析您分享的网盘课程名称、目录结构与视频大纲，并自动配置出任务看板 and 学习路线图。
      </p>
    </div>

    <!-- Input form -->
    <div
      class="p-6 bg-slate-50 dark:bg-white/[0.02] border rounded-2xl space-y-4"
      style="border-color: var(--border-base)"
    >
      <div class="space-y-1.5">
        <label class="text-[11px] font-black text-slate-500 uppercase tracking-wider"
          >百度网盘分享链接</label
        >
        <input
          :value="modelValue"
          type="text"
          placeholder="https://pan.baidu.com/s/... 或直接粘贴整段分享内容"
          class="w-full px-4 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          style="border-color: var(--border-base); color: var(--text-primary)"
          :disabled="isParsingNetdisk"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="space-y-1.5">
        <div class="flex justify-between items-center">
          <label class="text-[11px] font-black text-slate-500 uppercase tracking-wider"
            >提取码 (选填)</label
          >
          <span class="text-[10px] text-slate-400">若链接中已包含提取码，可留空自动识别</span>
        </div>
        <input
          :value="password"
          type="text"
          placeholder="例如: abcd"
          class="w-32 px-4 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-mono uppercase"
          style="border-color: var(--border-base); color: var(--text-primary)"
          :disabled="isParsingNetdisk"
          @input="emit('update:password', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <button
        type="button"
        class="w-full py-3 bg-gradient-to-r from-accent to-indigo-600 hover:from-accent hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-accent/20 hover:shadow-accent/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        :disabled="isParsingNetdisk || !modelValue.trim()"
        @click="emit('parse')"
      >
        <Loader2 v-if="isParsingNetdisk" class="w-4 h-4 animate-spin" />
        <Sparkles v-else class="w-4 h-4" />
        <span>开始网盘智能解析 (AI 协同规划)</span>
      </button>
    </div>

    <!-- Tip alert -->
    <div
      class="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/[0.02] border border-indigo-100/50 dark:border-indigo-500/10 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex gap-2"
    >
      <span class="text-xs">💡</span>
      <div>
        <p class="font-bold text-indigo-900 dark:text-indigo-400">这是如何工作的？</p>
        <p class="mt-0.5">
          当您提交网盘链接时，我们的系统会爬取提取网盘文件列表。接着，AI
          会将目录文件解析成结构化的学习路线与看板任务，并启动<b>对话式规划窗口</b>供您二次微调。
        </p>
        <button
          type="button"
          class="mt-1.5 text-accent font-bold hover:underline cursor-pointer"
          @click="emit('useTraditional')"
        >
          没有网盘？点击前往体验传统的纯文本生成
        </button>
      </div>
    </div>
  </div>
</template>

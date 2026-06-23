<script setup lang="ts">
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'fillDemoData'): void;
}>();
</script>

<template>
  <div
    class="flex flex-col border rounded-2xl p-5 bg-slate-50/50 dark:bg-white/[0.01] h-[580px] overflow-hidden min-h-0 text-left"
    style="border-color: var(--border-base)"
  >
    <div
      class="flex items-center justify-between shrink-0 pb-3 border-b"
      style="border-color: var(--border-base)"
    >
      <h4 class="text-xs font-black uppercase tracking-wider" style="color: var(--text-primary)">
        💡 解析规则与格式参考
      </h4>
      <button
        type="button"
        class="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold cursor-pointer"
        @click="emit('close')"
      >
        收起说明
      </button>
    </div>

    <div
      class="flex-1 overflow-y-auto space-y-4 pr-1 mt-3 scrollbar-thin text-xs leading-relaxed text-slate-500 dark:text-slate-400"
    >
      <div
        class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 space-y-1"
      >
        <h5 class="font-bold text-slate-700 dark:text-slate-300">1. 基本配置参数 (头部信息)</h5>
        <p>通过冒号或等号声明项目的元属性。例如：</p>
        <ul class="list-disc pl-4 space-y-0.5">
          <li><strong>描述：</strong> 项目主旨，支持多行。</li>
          <li><strong>标签：</strong> 分类标签（英文逗号隔开）。</li>
          <li>
            <strong>截止日期：</strong> 例如
            <code class="font-mono text-emerald-500">2026-06-30</code>.
          </li>
          <li>
            <strong>颜色：</strong> 例如
            <code class="font-mono text-indigo-500">bg-accent/bg-indigo/bg-emerald</code>.
          </li>
        </ul>
      </div>

      <div
        class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 space-y-1"
      >
        <h5 class="font-bold text-slate-700 dark:text-slate-300">2. 看板工作任务 (二级标题)</h5>
        <p>
          必须以
          <code
            class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono font-bold text-accent"
            >## 任务看板</code
          >
          开头，列表项解析属性：
        </p>
        <ul class="list-disc pl-4 space-y-0.5">
          <li>
            格式：<code class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono"
              >- [ ] 任务标题 | 优先级:高 | 描述:任务描述</code
            >
          </li>
          <li>
            属性间使用 <code class="font-bold text-accent">|</code> 分隔。包含：<code
              class="font-mono"
              >优先级 (低/中/高/紧急)</code
            >，<code class="font-mono">截止 (YYYY-MM-DD)</code>，<code class="font-mono">描述</code
            >。
          </li>
        </ul>
      </div>

      <div
        class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 space-y-1"
      >
        <h5 class="font-bold text-slate-700 dark:text-slate-300">3. 学习路线阶段 (二级标题)</h5>
        <p>
          必须以
          <code
            class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono font-bold text-accent"
            >## 学习路线</code
          >
          开头：
        </p>
        <ul class="list-disc pl-4 space-y-0.5">
          <li>
            使用三级标题
            <code class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono"
              >### 阶段标题</code
            >
            声明阶段。
          </li>
          <li>在阶段下方使用 <code class="font-mono">描述：</code> 声明该阶段要求。</li>
          <li>使用列表项（例如 <code class="font-mono">- [ ] 子学习项</code>）声明内容。</li>
        </ul>
      </div>
    </div>

    <div
      class="shrink-0 pt-2 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-white/5 flex items-center justify-between"
    >
      <span>💡 编写工整，系统即可完成解析建档。</span>
      <button
        type="button"
        class="text-accent font-bold hover:underline cursor-pointer"
        @click="emit('fillDemoData')"
      >
        点击填入完整范例体验
      </button>
    </div>
  </div>
</template>

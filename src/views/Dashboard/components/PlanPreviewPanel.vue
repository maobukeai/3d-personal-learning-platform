<script setup lang="ts">
import { ArrowLeft, Check, CheckCircle2, Loader2 } from 'lucide-vue-next';
import type { PlanJson, ParsedNetdisk } from './importDialogTypes';

defineProps<{
  currentPlanJson: PlanJson | null;
  modelValue: string;
  isChatSending: boolean;
  isPlanJsonSynced: boolean;
  isFinalImporting: boolean;
  parsedNetdisk: ParsedNetdisk | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', tab: string): void;
  (e: 'back'): void;
  (e: 'importPlan'): void;
}>();
</script>

<template>
  <div
    class="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-white/[0.01] border rounded-2xl p-4"
    style="border-color: var(--border-base)"
  >
    <!-- Preview Tabs -->
    <div
      class="flex items-center justify-between border-b pb-2 mb-3 shrink-0"
      style="border-color: var(--border-base)"
    >
      <div class="flex gap-4">
        <button
          type="button"
          class="text-xs font-bold pb-2 relative transition-all cursor-pointer"
          :class="
            modelValue === 'info'
              ? 'text-accent'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          "
          @click="emit('update:modelValue', 'info')"
        >
          项目概览
          <span
            v-if="modelValue === 'info'"
            class="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-accent"
          ></span>
        </button>
        <button
          type="button"
          class="text-xs font-bold pb-2 relative transition-all cursor-pointer"
          :class="
            modelValue === 'tasks'
              ? 'text-accent'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          "
          @click="emit('update:modelValue', 'tasks')"
        >
          任务看板 ({{ currentPlanJson?.tasks?.length || 0 }})
          <span
            v-if="modelValue === 'tasks'"
            class="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-accent"
          ></span>
        </button>
        <button
          type="button"
          class="text-xs font-bold pb-2 relative transition-all cursor-pointer"
          :class="
            modelValue === 'roadmap'
              ? 'text-accent'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          "
          @click="emit('update:modelValue', 'roadmap')"
        >
          学习路线 ({{ currentPlanJson?.roadmap?.steps?.length || 0 }})
          <span
            v-if="modelValue === 'roadmap'"
            class="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-accent"
          ></span>
        </button>
      </div>

      <span
        v-if="isChatSending"
        class="text-[9px] font-bold text-amber-500 animate-pulse bg-amber-500/5 px-2 py-0.5 border border-amber-500/10 rounded"
      >
        正在合成最新结构规划...
      </span>
      <span
        v-else-if="isPlanJsonSynced"
        class="text-[9px] font-bold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded flex items-center gap-0.5"
      >
        <Check class="w-3 h-3" /> 已实时同步
      </span>
      <span
        v-else
        class="text-[9px] font-bold text-slate-400 bg-slate-500/5 px-2 py-0.5 border border-slate-500/10 rounded flex items-center gap-0.5"
      >
        预览规划
      </span>
    </div>

    <!-- Preview Area -->
    <div class="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin custom-scrollbar text-left">
      <!-- Info Tab -->
      <div v-if="modelValue === 'info'" class="space-y-4">
        <div class="space-y-1">
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
            >项目名称</label
          >
          <h4 class="text-sm font-black text-slate-800 dark:text-slate-200">
            {{ currentPlanJson?.title || '正在规划生成中...' }}
          </h4>
        </div>

        <div class="space-y-1">
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
            >项目描述</label
          >
          <p
            class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap bg-slate-100 dark:bg-white/5 p-3 rounded-2xl"
          >
            {{ currentPlanJson?.description || '无项目描述' }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              >周期时间截止</label
            >
            <div class="text-xs font-bold text-slate-700 dark:text-slate-300">
              📅 {{ currentPlanJson?.dueDate || '未定' }}
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              >分类标签</label
            >
            <div class="flex flex-wrap gap-1.5 mt-0.5">
              <span
                v-for="tag in (currentPlanJson?.tags || '').split(',')"
                v-show="tag.trim()"
                :key="tag"
                class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 text-[10px] font-bold"
              >
                {{ tag.trim() }}
              </span>
              <span v-if="!(currentPlanJson?.tags || '').trim()" class="text-[10px] text-slate-400"
                >无标签</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Tasks Tab -->
      <div v-else-if="modelValue === 'tasks'" class="space-y-3">
        <div
          v-for="(task, idx) in currentPlanJson?.tasks"
          :key="idx"
          class="p-3 border rounded-xl space-y-2 bg-white dark:bg-slate-900/50"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200">{{
              task.title
            }}</span>
            <span
              class="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
              :class="{
                'bg-rose-500/10 text-rose-500':
                  task.priority === 'HIGH' || task.priority === '紧急' || task.priority === '高',
                'bg-amber-500/10 text-amber-500':
                  task.priority === 'MEDIUM' || task.priority === '中',
                'bg-slate-500/10 text-slate-400': task.priority === 'LOW' || task.priority === '低',
              }"
            >
              {{ task.priority }}
            </span>
          </div>
          <p
            v-if="task.description"
            class="text-[11px] text-slate-500 dark:text-slate-400 leading-normal"
          >
            {{ task.description }}
          </p>

          <!-- DueDate -->
          <div v-if="task.dueDate" class="text-[10px] text-slate-400 font-bold">
            ⏱ 截止时间: {{ task.dueDate }}
          </div>

          <!-- Subtasks -->
          <div
            v-if="task.subtasks && task.subtasks.length > 0"
            class="bg-slate-50 dark:bg-white/5 p-2 rounded-lg space-y-1"
          >
            <div v-for="sub in task.subtasks" :key="sub.id" class="flex items-start gap-1.5">
              <div
                class="w-3.5 h-3.5 rounded border border-slate-300 dark:border-white/10 flex items-center justify-center shrink-0 mt-0.5"
              >
                <Check class="w-2.5 h-2.5 text-accent opacity-30" />
              </div>
              <span class="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">{{
                sub.text
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Roadmap Tab -->
      <div v-else-if="modelValue === 'roadmap'" class="space-y-4">
        <div class="pb-1 border-b" style="border-color: var(--border-base)">
          <h4 class="text-xs font-black text-slate-800 dark:text-slate-200">
            🗺 {{ currentPlanJson?.roadmap?.title || '阶段学习路线' }}
          </h4>
          <p class="text-[10px] text-slate-400 mt-0.5">
            {{ currentPlanJson?.roadmap?.description || '无大纲描述' }}
          </p>
        </div>

        <div class="relative pl-4 border-l-2 border-indigo-100 dark:border-white/5 space-y-5">
          <div v-for="(step, idx) in currentPlanJson?.roadmap?.steps" :key="idx" class="relative">
            <!-- Timeline Node Ball -->
            <span
              class="absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-500 flex items-center justify-center text-white text-[7px] font-bold shadow-md"
            ></span>

            <div class="space-y-1.5">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200">{{
                  step.title
                }}</span>
                <span
                  class="text-[9px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-500/5 px-1.5 py-0.5 rounded"
                  >阶段 {{ step.order }}</span
                >
              </div>

              <p
                v-if="step.description"
                class="text-[11px] text-slate-500 dark:text-slate-400 leading-normal"
              >
                {{ step.description }}
              </p>

              <div
                v-if="step.subtasks && step.subtasks.length > 0"
                class="bg-slate-50 dark:bg-white/5 p-3 rounded-xl space-y-1.5"
              >
                <div v-for="sub in step.subtasks" :key="sub.id" class="flex items-start gap-2">
                  <div
                    class="w-3.5 h-3.5 rounded border border-slate-300 dark:border-white/10 flex items-center justify-center shrink-0 mt-0.5"
                  >
                    <Check class="w-2.5 h-2.5 text-accent opacity-30" />
                  </div>
                  <span class="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">{{
                    sub.text
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dialog Actions -->
    <div
      class="flex items-center gap-4 mt-4 pt-4 border-t shrink-0"
      style="border-color: var(--border-base)"
    >
      <button
        type="button"
        class="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-xs cursor-pointer flex items-center gap-1.5"
        :disabled="isChatSending"
        @click="emit('back')"
      >
        <ArrowLeft class="w-4 h-4" />
        <span>{{ parsedNetdisk ? '修改网盘资源' : '修改规划目标' }}</span>
      </button>

      <button
        type="button"
        :disabled="isFinalImporting || isChatSending"
        class="flex-1 py-3 rounded-2xl bg-gradient-to-r from-accent to-indigo-600 text-white font-bold text-xs shadow-lg shadow-accent/20 hover:shadow-accent/40 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        @click="emit('importPlan')"
      >
        <Loader2 v-if="isFinalImporting" class="w-4 h-4 animate-spin" />
        <CheckCircle2 v-else class="w-4 h-4" />
        <span>确认规划满意，一键生成导入项目</span>
      </button>
    </div>
  </div>
</template>

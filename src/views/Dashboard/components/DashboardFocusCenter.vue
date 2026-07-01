<script setup lang="ts">
import { computed } from 'vue';
import { BookOpen, CheckSquare, Upload, FolderOpen, MessageSquare, Brain } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import type { DashboardEnrollment, QuickAction } from '../types';

const props = defineProps<{
  activeEnrollment: DashboardEnrollment | null;
  momentumScore: number;
  taskSummary: {
    todo: number;
    inProgress: number;
    overdue: number;
    dueToday: number;
    urgent: number;
    assignedToMe: number;
  };
  contentSummary: {
    assets: number;
  };
  projectCount: number;
}>();

const emit = defineEmits<{
  (e: 'navigate', route: string): void;
  (e: 'open-import-dialog', mode: 'ai_assistant' | 'traditional'): void;
}>();

const quickActions = computed<QuickAction[]>(() => [
  {
    id: 'course',
    label: props.activeEnrollment ? '继续学习' : '探索课程',
    hint: props.activeEnrollment ? `${props.activeEnrollment.progress}%` : '学院',
    icon: BookOpen,
    route: props.activeEnrollment
      ? `/academy/player/${props.activeEnrollment.courseId}`
      : '/academy',
    tone: 'qa-blue',
  },
  {
    id: 'work',
    label: '任务看板',
    hint: `${props.taskSummary.todo + props.taskSummary.inProgress} 个`,
    icon: CheckSquare,
    route: '/work',
    tone: 'qa-amber',
  },
  {
    id: 'assets',
    label: '上传作品',
    hint: `${props.contentSummary.assets} 件`,
    icon: Upload,
    route: '/my-works',
    tone: 'qa-green',
  },
  {
    id: 'projects',
    label: '项目空间',
    hint: `${props.projectCount} 个`,
    icon: FolderOpen,
    route: '/projects',
    tone: 'qa-indigo',
  },
  {
    id: 'community',
    label: '社区讨论',
    hint: '交流',
    icon: MessageSquare,
    route: '/discussions',
    tone: 'qa-pink',
  },
  {
    id: 'ai-plan',
    label: 'AI 规划',
    hint: '生成',
    icon: Brain,
    mode: 'ai_assistant',
    tone: 'qa-orange',
  },
]);

function openQuickAction(action: QuickAction) {
  if (action.mode) {
    emit('open-import-dialog', action.mode);
    return;
  }
  if (action.route) {
    emit('navigate', action.route);
  }
}
</script>

<template>
  <Card hoverable glow glass class="command-card shadow-md border-base/80" padding="md">
    <div class="section-heading">
      <div>
        <p class="eyebrow text-[10px] font-bold uppercase tracking-wider text-slate-400">Today</p>
        <h2 class="text-base font-extrabold text-slate-800 dark:text-slate-100">推进中心</h2>
      </div>
      <div class="focus-score shrink-0" :class="{ warning: taskSummary.overdue > 0 }">
        <strong>{{ momentumScore }}</strong>
        <small>Focus</small>
      </div>
    </div>

    <div class="quick-grid">
      <button
        v-for="action in quickActions"
        :key="action.id"
        type="button"
        class="quick-action group hover:border-accent/30 transition-all duration-300"
        :class="action.tone"
        @click="openQuickAction(action)"
      >
        <span class="quick-icon">
          <component :is="action.icon" class="h-4.5 w-4.5" />
        </span>
        <span>
          <strong class="group-hover:text-accent transition-colors">{{ action.label }}</strong>
          <small>{{ action.hint }}</small>
        </span>
      </button>
    </div>

    <div class="task-kpis border-t border-base pt-3 mt-3">
      <span class="border border-base bg-card flex flex-col items-center p-2 rounded-xl">
        <strong class="text-lg font-black text-slate-800 dark:text-slate-100 leading-none mb-1">
          {{ taskSummary.dueToday }}
        </strong>
        <small class="text-[10px] font-bold text-slate-400">今日到期</small>
      </span>
      <span class="border border-base bg-card flex flex-col items-center p-2 rounded-xl">
        <strong class="text-lg font-black text-red-500 leading-none mb-1">
          {{ taskSummary.urgent }}
        </strong>
        <small class="text-[10px] font-bold text-slate-400">高优先级</small>
      </span>
      <span class="border border-base bg-card flex flex-col items-center p-2 rounded-xl">
        <strong class="text-lg font-black text-slate-800 dark:text-slate-100 leading-none mb-1">
          {{ taskSummary.assignedToMe }}
        </strong>
        <small class="text-[10px] font-bold text-slate-400">我的负载</small>
      </span>
    </div>
  </Card>
</template>

<style scoped>
.command-card {
  border-color: color-mix(in srgb, var(--accent) 15%, var(--border-base));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-card) 95%, var(--accent) 5%),
    var(--bg-card) 90%
  );
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin-bottom: 2px;
}

.focus-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(37, 99, 235, 0.02) 100%);
  border: 1px solid rgba(37, 99, 235, 0.25);
  color: #2563eb;
  box-shadow: 0 0 12px rgba(37, 99, 235, 0.1);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.focus-score:hover {
  transform: scale(1.06);
  box-shadow: 0 0 16px rgba(37, 99, 235, 0.25);
  border-color: rgba(37, 99, 235, 0.5);
}

.focus-score.warning {
  background: radial-gradient(circle, rgba(220, 38, 38, 0.12) 0%, rgba(220, 38, 38, 0.02) 100%);
  border-color: rgba(220, 38, 38, 0.25);
  color: #dc2626;
  box-shadow: 0 0 12px rgba(220, 38, 38, 0.1);
}

.focus-score.warning:hover {
  box-shadow: 0 0 16px rgba(220, 38, 38, 0.25);
  border-color: rgba(220, 38, 38, 0.5);
}

.focus-score strong {
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}

.focus-score small {
  font-size: 8px;
  font-weight: 700;
  margin-top: 1px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-card);
  padding: 8px 10px;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
}

.quick-action:hover {
  transform: translateY(-2px);
  background: var(--bg-hover);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card);
}

.quick-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.quick-action:hover .quick-icon {
  transform: scale(1.05);
}

.quick-action span:last-child {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.quick-action strong {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-action small {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qa-blue .quick-icon {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}
.qa-amber .quick-icon {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}
.qa-green .quick-icon {
  background: rgba(5, 150, 105, 0.1);
  color: #059669;
}
.qa-indigo .quick-icon {
  background: rgba(79, 70, 229, 0.1);
  color: #4f46e5;
}
.qa-pink .quick-icon {
  background: rgba(219, 39, 119, 0.1);
  color: #db2777;
}
.qa-orange .quick-icon {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}

.task-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}
</style>

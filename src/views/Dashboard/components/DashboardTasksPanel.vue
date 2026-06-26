<script setup lang="ts">
import { ArrowRight, CheckCircle2, Clock, Circle, CheckSquare } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import { formatDate } from '@/utils/format';
import { TaskStatus } from '@/types';
import type { DashboardTask } from '../types';

const props = defineProps<{
  visibleTasks: DashboardTask[];
  taskSummary: {
    inProgress: number;
    overdue: number;
    completionRate: number;
  };
  completingTaskIds: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'navigate', route: string): void;
  (e: 'complete-task', task: DashboardTask): void;
}>();

function isOverdue(task: DashboardTask) {
  if (!task.dueDate || task.status === TaskStatus.DONE) return false;
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function getTaskStatusClass(status: string) {
  if (status === TaskStatus.DONE) return 'status-green';
  if (status === TaskStatus.IN_PROGRESS) return 'status-blue';
  return 'status-muted';
}

function getPriorityLabel(priority?: string) {
  if (priority === 'URGENT') return '紧急';
  if (priority === 'HIGH') return '高';
  if (priority === 'LOW') return '低';
  return '中';
}

function isCompletingTask(taskId: string) {
  return props.completingTaskIds.has(taskId);
}
</script>

<template>
  <Card hoverable glow glass class="tasks-panel" padding="none">
    <div class="dashboard-panel-header">
      <div>
        <h3>任务推进</h3>
        <p>
          {{ taskSummary.inProgress }} 进行中 · {{ taskSummary.overdue }} 逾期 ·
          {{ taskSummary.completionRate }}% 完成率
        </p>
      </div>
      <Button
        variant="link"
        size="sm"
        :icon="ArrowRight"
        icon-position="right"
        @click="emit('navigate', '/work')"
      >
        全部
      </Button>
    </div>
    <div class="flex flex-col min-h-0 flex-1">
      <div v-if="visibleTasks.length" class="dashboard-panel-list flex-1">
        <div
          v-for="task in visibleTasks"
          :key="task.id"
          class="task-row mobile-row"
          :class="[
            task.priority === 'URGENT' || task.priority === 'HIGH'
              ? 'border-l-[3px] border-l-red-500'
              : task.priority === 'LOW'
                ? 'border-l-[3px] border-l-slate-400'
                : 'border-l-[3px] border-l-accent',
          ]"
          role="button"
          tabindex="0"
          @click="emit('navigate', '/work')"
          @keydown.enter="emit('navigate', '/work')"
          @keydown.space.prevent="emit('navigate', '/work')"
        >
          <span class="task-state" :class="getTaskStatusClass(task.status)">
            <component
              :is="
                task.status === 'DONE'
                  ? CheckCircle2
                  : task.status === 'IN_PROGRESS'
                    ? Clock
                    : Circle
              "
              class="h-4.5 w-4.5"
            />
          </span>
          <span class="task-main">
            <strong class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {{ task.title }}
            </strong>
            <small class="text-xs text-slate-400 font-medium">
              {{ task.project?.title || '工作区任务' }} ·
              {{ task.dueDate ? formatDate(task.dueDate) : '无截止' }}
              <b v-if="isOverdue(task)" class="text-red-500 font-bold ml-1">逾期</b>
            </small>
          </span>
          <Badge
            :variant="
              task.priority === 'URGENT' || task.priority === 'HIGH'
                ? 'danger'
                : task.priority === 'LOW'
                  ? 'info'
                  : 'warning'
            "
            outline
            class="scale-90 shrink-0"
          >
            {{ getPriorityLabel(task.priority) }}
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            class="complete-command !w-7 !h-7 !p-0 shrink-0 ml-1 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20"
            :disabled="task.status === 'DONE'"
            :loading="isCompletingTask(task.id)"
            @click.stop="emit('complete-task', task)"
          >
            <CheckCircle2 class="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div v-else class="dashboard-panel-empty">
        <CheckSquare class="h-8 w-8 opacity-40 mb-1" />
        <strong>暂无待办任务</strong>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.tasks-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dashboard-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-base);
}

.dashboard-panel-header h3 {
  font-size: 14px;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
}

.dashboard-panel-header p {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  margin: 2px 0 0;
}

.dashboard-panel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  overflow-y: auto;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border-base);
  background: var(--bg-card);
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: left;
  width: 100%;
}

.task-row:hover {
  transform: translateX(4px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card);
}

.task-state {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-base);
}

.status-green {
  color: #059669;
}
.status-blue {
  color: #2563eb;
}
.status-muted {
  color: var(--text-muted);
}

.task-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.dashboard-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: var(--text-muted);
  text-align: center;
}

.dashboard-panel-empty strong {
  font-size: 13px;
  font-weight: 600;
}
</style>

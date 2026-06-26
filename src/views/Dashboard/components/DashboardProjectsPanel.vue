<script setup lang="ts">
import { ArrowRight, Layers } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import type { WorkbenchFocusProject } from '../types';

defineProps<{
  projectHealth: WorkbenchFocusProject[];
}>();

const emit = defineEmits<{
  (e: 'navigate', route: string): void;
}>();

function getHealthClass(score: number) {
  if (score >= 78) return 'health-good';
  if (score >= 48) return 'health-watch';
  return 'health-risk';
}
</script>

<template>
  <Card hoverable glow glass class="projects-panel" padding="none">
    <div class="dashboard-panel-header">
      <div>
        <h3>项目健康雷达</h3>
        <p>{{ projectHealth.length }} 个重点项目</p>
      </div>
      <Button
        variant="link"
        size="sm"
        :icon="ArrowRight"
        icon-position="right"
        @click="emit('navigate', '/projects')"
      >
        全部
      </Button>
    </div>
    <div class="flex flex-col min-h-0 flex-1">
      <div v-if="projectHealth.length" class="dashboard-panel-list flex-1">
        <button
          v-for="project in projectHealth"
          :key="project.id"
          type="button"
          class="project-row mobile-row"
          :class="getHealthClass(project.healthScore)"
          @click="emit('navigate', `/project/${project.id}`)"
        >
          <span
            class="project-avatar shrink-0 font-bold text-xs uppercase"
            :class="project.color || 'bg-accent'"
          >
            {{ project.title.charAt(0) }}
          </span>
          <span class="project-body">
            <span class="project-title">
              <strong class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {{ project.title }}
              </strong>
              <small class="text-xs text-slate-400 font-medium">{{ project.memberCount }} 人</small>
            </span>
            <span class="progress-line">
              <i :style="{ width: `${project.healthScore}%` }"></i>
            </span>
          </span>
          <span class="project-progress text-xs font-bold">{{ project.healthScore }}</span>
        </button>
      </div>
      <div v-else class="dashboard-panel-empty">
        <Layers class="h-8 w-8 opacity-40 mb-1" />
        <strong>暂无活跃项目</strong>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.projects-panel {
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

.project-row {
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

.project-row:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card);
}

.project-avatar {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #fff;
  background: linear-gradient(135deg, var(--accent) 0%, #059669 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.project-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.project-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.progress-line {
  height: 5px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--bg-subtle);
  width: 100%;
  margin-top: 4px;
}

.progress-line i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #059669);
}

.project-progress {
  color: var(--text-primary);
  font-weight: 700;
  min-width: 24px;
  text-align: right;
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

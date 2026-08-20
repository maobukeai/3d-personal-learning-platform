<script setup lang="ts">
import TaskCardBoard from '@/components/card/TaskCardBoard.vue';
import TaskCardList from '@/components/card/TaskCardList.vue';
import type { TaskCardProps, TaskCardEmits } from '@/components/card/useTaskCardState';

const props = withDefaults(defineProps<TaskCardProps>(), {
  layout: 'board',
  config: () => ({
    assignee: true,
    dueDate: true,
    priority: true,
    project: true,
    subtasks: true,
    description: true,
    timeTracking: true,
  }),
  teamMembers: () => [],
});

const emit = defineEmits<TaskCardEmits>();
</script>

<template>
  <TaskCardBoard
    v-if="layout === 'board'"
    :task="task"
    :layout="layout"
    :config="config"
    :team-members="teamMembers"
    @click="(t) => emit('click', t)"
    @edit="(t) => emit('edit', t)"
    @delete="(t) => emit('delete', t)"
    @status-change="(t, s) => emit('status-change', t, s)"
    @user-click="(u) => emit('user-click', u)"
    @refresh="(t) => emit('refresh', t)"
    @refresh-stats="emit('refresh-stats')"
    @update-subtask="(pId, sIdx, f) => emit('update-subtask', pId, sIdx, f)"
  />
  <TaskCardList
    v-else
    :task="task"
    :layout="layout"
    :config="config"
    :team-members="teamMembers"
    @click="(t) => emit('click', t)"
    @edit="(t) => emit('edit', t)"
    @delete="(t) => emit('delete', t)"
    @status-change="(t, s) => emit('status-change', t, s)"
    @user-click="(u) => emit('user-click', u)"
    @refresh="(t) => emit('refresh', t)"
    @refresh-stats="emit('refresh-stats')"
    @update-subtask="(pId, sIdx, f) => emit('update-subtask', pId, sIdx, f)"
  />
</template>

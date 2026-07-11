import { ref } from 'vue';
import type { Task } from '@/types/task';

export function useTaskQuery() {
  const filteredTasks = ref<Task[]>([]);
  return {
    filteredTasks,
  };
}

export type UseTaskQueryReturn = ReturnType<typeof useTaskQuery>;

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type { Task } from '@/types/task'; /** * Multi-select state shared by the Board / List / Calendar task views. * * The selection is keyed by task id and re-derives the selected `Task` objects * from the live `tasks` ref passed in, so selection automatically stays in sync * when tasks are added, updated or removed by `useTaskMutations`. */
export function useTaskSelection(tasks: Ref<Task[]>) {
  const selectedIds = ref<Set<string | number>>(new Set());
  const selectedTasks = computed<Task[]>(() =>
    tasks.value.filter((t) => selectedIds.value.has(t.id)),
  ) as ComputedRef<Task[]>;
  const selectedCount = computed<number>(() => selectedIds.value.size);
  const bulkMode = computed<boolean>(() => selectedIds.value.size > 0);
  const isSelected = (id: string | number): boolean => selectedIds.value.has(id);
  const toggleSelection = (id: string | number): void => {
    const next = new Set(selectedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.value = next;
  };
  const selectAll = (): void => {
    selectedIds.value = new Set(tasks.value.map((t) => t.id));
  };
  const clearSelection = (): void => {
    selectedIds.value = new Set();
  };
  /** * Selects every task that satisfies `predicate` (replacing the current selection). * Pass `append: true` to keep the existing selection and add the matches. */ const selectByFilter =
    (predicate: (task: Task) => boolean, options: { append?: boolean } = {}): void => {
      const next = options.append ? new Set(selectedIds.value) : new Set<string | number>();
      tasks.value.forEach((t) => {
        if (predicate(t)) next.add(t.id);
      });
      selectedIds.value = next;
    };
  return {
    selectedIds,
    selectedTasks,
    selectedCount,
    bulkMode,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectByFilter,
  };
}
export type UseTaskSelectionReturn = ReturnType<typeof useTaskSelection>;

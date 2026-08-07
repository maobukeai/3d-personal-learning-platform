import { ref, computed } from 'vue';
import type { SmartSheetItem, SheetFilterOptions, SheetSummary } from '../types/sheet';
import { SheetService } from '../services/sheetService';

export function useSmartSheetData() {
  const items = ref<SmartSheetItem[]>([]);
  const loading = ref(false);

  const filters = ref<SheetFilterOptions>({
    search: '',
    templateType: 'ALL',
    status: 'ALL',
    category: 'ALL',
    sortBy: 'latest',
  });

  const loadData = () => {
    loading.value = true;
    try {
      items.value = SheetService.getLocalItems();
    } finally {
      loading.value = false;
    }
  };

  const categories = computed(() => {
    const set = new Set<string>();
    items.value.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  });

  const filteredItems = computed(() => {
    let result = [...items.value];

    if (filters.value.templateType !== 'ALL') {
      result = result.filter((i) => i.templateType === filters.value.templateType);
    }
    if (filters.value.status !== 'ALL') {
      result = result.filter((i) => i.status === filters.value.status);
    }
    if (filters.value.category !== 'ALL') {
      result = result.filter((i) => i.category === filters.value.category);
    }
    if (filters.value.search.trim()) {
      const q = filters.value.search.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)) ||
          (i.content && i.content.toLowerCase().includes(q)),
      );
    }

    const priorityWeight = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    result.sort((a, b) => {
      if (filters.value.sortBy === 'latest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (filters.value.sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (filters.value.sortBy === 'priority') {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      if (filters.value.sortBy === 'duration') {
        return (b.durationMinutes || 0) - (a.durationMinutes || 0);
      }
      return 0;
    });

    return result;
  });

  const summary = computed<SheetSummary>(() => {
    const totalCount = items.value.length;
    const totalMinutes = items.value.reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);
    const completedCount = items.value.filter((i) => i.status === 'COMPLETED').length;
    const completionRate = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      totalCount,
      totalDurationHours: Math.round((totalMinutes / 60) * 10) / 10,
      completedCount,
      completionRate,
    };
  });

  const addItem = (data: Omit<SmartSheetItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = SheetService.addItem(data);
    items.value.unshift(created);
    return created;
  };

  const updateItem = (id: string, updates: Partial<SmartSheetItem>) => {
    const updated = SheetService.updateItem(id, updates);
    if (updated) {
      const idx = items.value.findIndex((i) => i.id === id);
      if (idx !== -1) items.value[idx] = updated;
    }
    return updated;
  };

  const removeItem = (id: string) => {
    const success = SheetService.deleteItem(id);
    if (success) {
      items.value = items.value.filter((i) => i.id !== id);
    }
    return success;
  };

  return {
    items,
    loading,
    filters,
    categories,
    filteredItems,
    summary,
    loadData,
    addItem,
    updateItem,
    removeItem,
  };
}

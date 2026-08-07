import { ref, computed } from 'vue';
import type { CustomSheetTable } from '../types/sheet';
import { SheetStorage } from '../services/sheetStorage';
import { PRESET_TABLE_TEMPLATES } from '../services/presetTemplates';
import { ElMessage } from '@/utils/feedbackBridge';

export function useMultiSheetState() {
  const tables = ref<CustomSheetTable[]>([]);
  const activeTableId = ref<string>('');
  const loading = ref(false);

  const initTables = () => {
    loading.value = true;
    try {
      tables.value = SheetStorage.getTables();
      if (tables.value.length > 0) {
        activeTableId.value = tables.value[0].id;
      }
    } finally {
      loading.value = false;
    }
  };

  const activeTable = computed(() => {
    return tables.value.find((t) => t.id === activeTableId.value) || tables.value[0] || null;
  });

  const persist = () => {
    SheetStorage.saveTables(tables.value);
  };

  const createTable = (title: string, templateId?: string) => {
    let newTable: CustomSheetTable;
    if (templateId) {
      const template = PRESET_TABLE_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        newTable = JSON.parse(JSON.stringify(template));
        newTable.id = 'tbl-' + Date.now();
        newTable.title = title || template.title;
      } else {
        newTable = createBlankTable(title);
      }
    } else {
      newTable = createBlankTable(title);
    }

    tables.value.push(newTable);
    activeTableId.value = newTable.id;
    persist();
    return newTable;
  };

  const createBlankTable = (title: string): CustomSheetTable => {
    return {
      id: 'tbl-' + Date.now(),
      title: title || '未命名工作表',
      columns: [
        { id: 'col-date', name: '日期', type: 'date', width: 130 },
        { id: 'col-title', name: '名称/事项', type: 'text', width: 220 },
        { id: 'col-done', name: '已完成', type: 'checkbox', width: 90 },
      ],
      rows: [
        {
          id: 'r-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cells: {
            'col-date': new Date().toISOString().slice(0, 10),
            'col-title': '第一条事项记录',
            'col-done': false,
          },
        },
      ],
    };
  };

  const renameTable = (id: string, newTitle: string) => {
    const table = tables.value.find((t) => t.id === id);
    if (table) {
      table.title = newTitle;
      persist();
    }
  };

  const deleteTable = (id: string) => {
    if (tables.value.length <= 1) {
      ElMessage.warning('至少保留一张工作表！');
      return;
    }
    tables.value = tables.value.filter((t) => t.id !== id);
    if (activeTableId.value === id) {
      activeTableId.value = tables.value[0].id;
    }
    persist();
  };

  return {
    tables,
    activeTableId,
    activeTable,
    loading,
    initTables,
    persist,
    createTable,
    renameTable,
    deleteTable,
  };
}

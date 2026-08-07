<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import { TableProperties } from 'lucide-vue-next';
import SheetTabsBar from './components/SheetTabsBar.vue';
import SheetHeaderSummary from './components/SheetHeaderSummary.vue';
import SheetFilterToolbar from './components/SheetFilterToolbar.vue';
import SheetDynamicTableView from './components/SheetDynamicTableView.vue';
import SheetDynamicBoardView from './components/SheetDynamicBoardView.vue';
import SheetDynamicCalendarView from './components/SheetDynamicCalendarView.vue';
import SheetColumnConfigModal from './components/SheetColumnConfigModal.vue';
import SheetRowDetailDrawer from './components/SheetRowDetailDrawer.vue';
import SheetImageLightboxModal from './components/SheetImageLightboxModal.vue';
import { useMultiSheetState } from './composables/useMultiSheetState';
import { useTableSchema } from './composables/useTableSchema';
import { useTableRowData } from './composables/useTableRowData';
import { SheetStorage } from './services/sheetStorage';
import { ElMessageBox, ElMessage } from '@/utils/feedbackBridge';
import type { SheetColumnDef, SheetRowData, ColumnSummaryType } from './types/sheet';

const viewMode = ref<'table' | 'board' | 'calendar'>('table');
const showColModal = ref(false);
const editingCol = ref<SheetColumnDef | null>(null);

const showRichDrawer = ref(false);
const richEditingRowId = ref<string>('');
const richEditingColId = ref<string>('');
const richEditingContent = ref<string>('');

const showLightbox = ref(false);
const lightboxImages = ref<string[]>([]);
const lightboxRowId = ref('');
const lightboxColId = ref('');

const {
  tables,
  activeTableId,
  activeTable,
  initTables,
  persist,
  createTable,
  renameTable,
  deleteTable,
} = useMultiSheetState();

const { addColumn, updateColumn, moveColumn, removeColumn } = useTableSchema();

const { searchQuery, filteredRows, summaryMetrics, addRow, updateCell, removeRow } =
  useTableRowData(() => activeTable.value);

onMounted(() => {
  initTables();
});

const handleCreateNewTable = async () => {
  try {
    const { value } = await ElMessageBox.prompt('请输入新工作表的名称：', '新建工作表', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputValue: '新日常记录表',
    });
    if (value && value.trim()) {
      createTable(value.trim());
      ElMessage.success('工作表创建成功');
    }
  } catch {
    // User cancelled
  }
};

const handleConfigColumn = (col: SheetColumnDef) => {
  editingCol.value = col;
  showColModal.value = true;
};

const handleAddColumnTrigger = () => {
  editingCol.value = null;
  showColModal.value = true;
};

const handleSaveColumn = (colData: any) => {
  if (!activeTable.value) return;
  if (colData.id) {
    updateColumn(activeTable.value, colData.id, colData);
    ElMessage.success('列属性已更新');
  } else {
    addColumn(activeTable.value, colData.name, colData.type, colData.options);
    ElMessage.success('新自定义列已添加');
  }
  showColModal.value = false;
  editingCol.value = null;
  persist();
};

const handleMoveColumn = (colId: string, dir: 'left' | 'right') => {
  if (activeTable.value) {
    moveColumn(activeTable.value, colId, dir);
    persist();
  }
};

const handleDeleteColumn = async (colId: string) => {
  if (!activeTable.value) return;
  try {
    await ElMessageBox.confirm('确认删除此列数据？数据列对应内容也将被清除。', '删除列确认', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    removeColumn(activeTable.value, colId);
    persist();
    ElMessage.success('列数据已成功删除');
  } catch {
    // User cancelled
  }
};

const handleUpdateCell = (rowId: string, colId: string, val: any) => {
  if (activeTable.value) {
    updateCell(activeTable.value, rowId, colId, val);
    persist();
  }
};

const handleUpdateSummaryType = (colId: string, type: ColumnSummaryType) => {
  if (activeTable.value) {
    const col = activeTable.value.columns.find((c) => c.id === colId);
    if (col) {
      col.summaryType = type;
      persist();
    }
  }
};

const handleAddRow = () => {
  if (activeTable.value) {
    addRow(activeTable.value);
    persist();
  }
};

const handleDuplicateRow = (row: SheetRowData) => {
  if (activeTable.value) {
    const newRow: SheetRowData = {
      id: 'row-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cells: JSON.parse(JSON.stringify(row.cells)),
    };
    activeTable.value.rows.unshift(newRow);
    persist();
    ElMessage.success('行数据已成功克隆复制');
  }
};

const handleDeleteRow = async (rowId: string) => {
  if (!activeTable.value) return;
  try {
    await ElMessageBox.confirm('确认删除此行记录？删除后无法恢复。', '删除记录行', {
      confirmButtonText: '删除记录',
      cancelButtonText: '取消',
      type: 'warning',
    });
    removeRow(activeTable.value, rowId);
    persist();
    ElMessage.success('数据行已成功删除');
  } catch {
    // User cancelled
  }
};

const handleOpenRichText = (rowId: string, colId: string, text: string) => {
  richEditingRowId.value = rowId;
  richEditingColId.value = colId;
  richEditingContent.value = text;
  showRichDrawer.value = true;
};

const handleSaveRichText = (text: string) => {
  if (richEditingRowId.value && richEditingColId.value) {
    handleUpdateCell(richEditingRowId.value, richEditingColId.value, text);
    ElMessage.success('心得备注已保存');
  }
};

const handleOpenLightbox = (rowId: string, colId: string, images: string[]) => {
  lightboxRowId.value = rowId;
  lightboxColId.value = colId;
  lightboxImages.value = images;
  showLightbox.value = true;
};

const handleUpdateLightboxImages = (newImages: string[]) => {
  if (lightboxRowId.value && lightboxColId.value) {
    handleUpdateCell(lightboxRowId.value, lightboxColId.value, newImages);
    lightboxImages.value = newImages;
  }
};

const handleImportJSON = async (file: File) => {
  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (Array.isArray(parsed)) {
          tables.value = parsed;
          if (parsed.length > 0) activeTableId.value = parsed[0].id;
          persist();
          ElMessage.success('成功导入全量配置与表格数据！');
        }
      } catch (err: any) {
        ElMessage.error('文件内容解析失败，请检查 JSON 格式');
      }
    };
    reader.readAsText(file);
  } catch (err: any) {
    ElMessage.error(err.message || '导入文件失败');
  }
};

const handleDeleteTable = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '确认彻底删除此工作表与表内全部数据？删除后不可恢复。',
      '删除工作表确认',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    deleteTable(id);
    ElMessage.success('工作表已删除');
  } catch {
    // User cancelled
  }
};
</script>

<template>
  <div class="min-h-screen bg-[var(--bg-app)] text-neutral-100 flex flex-col">
    <!-- 页头 -->
    <PageHeader
      title="高自定义多维日常备忘表"
      subtitle="自定义多表工作区、多图相册画廊、原位电子表格编辑与表尾数据列聚合统计"
      :icon="TableProperties"
    />

    <div class="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1700px] w-full mx-auto">
      <!-- 多工作表页签切换栏 -->
      <SheetTabsBar
        :tables="tables"
        :active-id="activeTableId"
        @select="activeTableId = $event"
        @create="handleCreateNewTable"
        @rename="renameTable"
        @delete="handleDeleteTable"
      />

      <template v-if="activeTable">
        <!-- 聚合指标面板 -->
        <SheetHeaderSummary :metrics="summaryMetrics" />

        <!-- 搜索与视图控制栏 -->
        <SheetFilterToolbar
          v-model:search="searchQuery"
          v-model:view-mode="viewMode"
          @add-row="handleAddRow"
          @export-csv="SheetStorage.exportTableAsCSV(activeTable)"
          @export-json="SheetStorage.exportAllAsJSON(tables)"
          @import-json="handleImportJSON"
        />

        <!-- 三种动态视图呈现场 -->
        <main class="transition-all duration-300">
          <SheetDynamicTableView
            v-if="viewMode === 'table'"
            :table="activeTable"
            :rows="filteredRows"
            @config-column="handleConfigColumn"
            @add-column="handleAddColumnTrigger"
            @move-column="handleMoveColumn"
            @delete-column="handleDeleteColumn"
            @update-cell="handleUpdateCell"
            @duplicate-row="handleDuplicateRow"
            @delete-row="handleDeleteRow"
            @add-row="handleAddRow"
            @open-rich-text="handleOpenRichText"
            @open-image-lightbox="handleOpenLightbox"
            @update-summary-type="handleUpdateSummaryType"
          />

          <SheetDynamicBoardView
            v-else-if="viewMode === 'board'"
            :table="activeTable"
            :rows="filteredRows"
            @update-cell="handleUpdateCell"
            @delete-row="handleDeleteRow"
            @add-row="handleAddRow"
          />

          <SheetDynamicCalendarView
            v-else-if="viewMode === 'calendar'"
            :table="activeTable"
            :rows="filteredRows"
          />
        </main>
      </template>
    </div>

    <!-- 列配置对话框 -->
    <SheetColumnConfigModal
      :show="showColModal"
      :column="editingCol"
      @close="showColModal = false"
      @save="handleSaveColumn"
    />

    <!-- 富文本详细抽屉 -->
    <SheetRowDetailDrawer
      v-model:show="showRichDrawer"
      :content="richEditingContent"
      @save="handleSaveRichText"
    />

    <!-- 多图相册 Gallery Lightbox 放大预览弹窗 -->
    <SheetImageLightboxModal
      :show="showLightbox"
      :images="lightboxImages"
      @close="showLightbox = false"
      @update-images="handleUpdateLightboxImages"
    />
  </div>
</template>

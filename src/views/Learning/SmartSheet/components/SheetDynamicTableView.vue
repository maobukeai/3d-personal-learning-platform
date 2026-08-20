<script setup lang="ts">
import SheetColumnHeader from './SheetColumnHeader.vue';
import SheetCellEditor from './SheetCellEditor.vue';
import SheetColumnSummaryFooter from './SheetColumnSummaryFooter.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import { Plus, Trash2, Copy } from 'lucide-vue-next';
import type {
  CustomSheetTable,
  SheetColumnDef,
  SheetRowData,
  ColumnSummaryType,
} from '../types/sheet';

defineProps<{
  table: CustomSheetTable;
  rows: SheetRowData[];
}>();

const emit = defineEmits<{
  (e: 'config-column', col: SheetColumnDef): void;
  (e: 'add-column'): void;
  (e: 'move-column', colId: string, dir: 'left' | 'right'): void;
  (e: 'delete-column', colId: string): void;
  (e: 'update-cell', rowId: string, colId: string, value: any): void;
  (e: 'delete-row', rowId: string): void;
  (e: 'duplicate-row', row: SheetRowData): void;
  (e: 'add-row'): void;
  (e: 'open-rich-text', rowId: string, colId: string, text: string): void;
  (e: 'open-image-lightbox', rowId: string, colId: string, images: string[]): void;
  (e: 'update-summary-type', colId: string, type: ColumnSummaryType): void;
}>();
</script>

<template>
  <div
    class="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md overflow-x-auto shadow-2xl"
  >
    <table class="w-full border-collapse text-xs text-left min-w-[700px]">
      <!-- 动态表头 -->
      <thead>
        <tr class="bg-white/10 border-b border-white/10 text-neutral-300">
          <th
            v-for="col in table.columns"
            :key="col.id"
            :style="{ width: col.width ? `${col.width}px` : 'auto' }"
            class="border-r border-white/10 p-0 font-normal"
          >
            <SheetColumnHeader
              :column="col"
              @config="emit('config-column', $event)"
              @move="(id, dir) => emit('move-column', id, dir)"
              @delete="emit('delete-column', $event)"
            />
          </th>

          <!-- 添加列标题块与行操作栏表头 -->
          <th class="w-20 p-2 text-center border-r-0">
            <button
              class="p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-colors"
              title="添加新列字段"
              @click="emit('add-column')"
            >
              <Plus class="w-4 h-4 mx-auto" />
            </button>
          </th>
        </tr>
      </thead>

      <!-- 动态数据行 -->
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          class="border-b border-white/5 hover:bg-white/[0.04] transition-colors group"
        >
          <td
            v-for="col in table.columns"
            :key="col.id"
            class="border-r border-white/5 p-1 align-middle"
          >
            <SheetCellEditor
              :column="col"
              :model-value="row.cells[col.id]"
              @update:model-value="(val) => emit('update-cell', row.id, col.id, val)"
              @open-rich-text="(txt) => emit('open-rich-text', row.id, col.id, txt)"
              @open-image-lightbox="(imgs) => emit('open-image-lightbox', row.id, col.id, imgs)"
            />
          </td>

          <!-- 行快捷操作组 (复制行 / 删除行) -->
          <td class="p-1 text-center border-r-0 w-20">
            <div
              class="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <button
                class="p-1 text-neutral-400 hover:text-white rounded"
                title="复制此数据行"
                @click="emit('duplicate-row', row)"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>

              <button
                class="p-1 text-neutral-500 hover:text-red-400 rounded"
                title="删除此数据行"
                @click="emit('delete-row', row.id)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>

      <!-- 📊 表格底部常驻列统计 Footer -->
      <tfoot v-if="rows.length > 0">
        <SheetColumnSummaryFooter
          :columns="table.columns"
          :rows="rows"
          @update-summary-type="(id, type) => emit('update-summary-type', id, type)"
        />
      </tfoot>
    </table>

    <div v-if="rows.length === 0" class="p-8">
      <EmptyState
        title="当前表格无记录数据"
        description="点击底部或右上角「添加记录行」开启全新自定义记录"
      />
    </div>

    <!-- 底部一键新增行底栏 -->
    <div class="p-2 border-t border-white/10 bg-white/[0.02] flex items-center justify-start">
      <Button
        variant="glass"
        size="sm"
        class="text-xs text-neutral-400 hover:text-white"
        @click="emit('add-row')"
      >
        <Plus class="w-3.5 h-3.5 mr-1" />
        添加新记录行
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import { Plus, Search, Table, LayoutGrid, Calendar, Download, Upload } from 'lucide-vue-next';

const props = defineProps<{
  search: string;
  viewMode: 'table' | 'board' | 'calendar';
}>();

const emit = defineEmits<{
  (e: 'update:search', value: string): void;
  (e: 'update:viewMode', value: 'table' | 'board' | 'calendar'): void;
  (e: 'add-row'): void;
  (e: 'export-csv'): void;
  (e: 'export-json'): void;
  (e: 'import-json', file: File): void;
}>();

const viewOptions = [
  { value: 'table', label: '表格', icon: Table },
  { value: 'board', label: '看板', icon: LayoutGrid },
  { value: 'calendar', label: '日历', icon: Calendar },
];

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    emit('import-json', target.files[0]);
    target.value = '';
  }
};
</script>

<template>
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
    <div class="w-full sm:w-72">
      <Input
        :model-value="search"
        placeholder="全局搜索单元格内容..."
        size="sm"
        @update:model-value="emit('update:search', String($event))"
      >
        <template #prefix>
          <Search class="w-4 h-4 text-neutral-400" />
        </template>
      </Input>
    </div>

    <div class="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
      <SegmentedControl
        :model-value="viewMode"
        :options="viewOptions"
        size="sm"
        @update:model-value="emit('update:viewMode', $event as 'table' | 'board' | 'calendar')"
      />

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" title="导出当前表为 CSV" @click="emit('export-csv')">
          <Download class="w-3.5 h-3.5 mr-1" />
          CSV
        </Button>

        <Button
          variant="outline"
          size="sm"
          title="导出全部工作表为 JSON"
          @click="emit('export-json')"
        >
          <Download class="w-3.5 h-3.5 mr-1" />
          备份全表
        </Button>

        <label class="cursor-pointer">
          <Button variant="outline" size="sm" as="span" title="导入 JSON 恢复全表">
            <Upload class="w-3.5 h-3.5 mr-1" />
            导入
          </Button>
          <input type="file" accept=".json" class="hidden" @change="handleFileChange" />
        </label>

        <Button variant="primary" size="sm" @click="emit('add-row')">
          <Plus class="w-3.5 h-3.5 mr-1" />
          添加记录行
        </Button>
      </div>
    </div>
  </div>
</template>

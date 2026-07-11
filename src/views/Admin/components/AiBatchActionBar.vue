<script setup lang="ts">
interface BatchFamilyOption {
  key: string;
  label: string;
  count: number;
}

const props = defineProps<{
  selectedCount: number;
  total: number;
  isAllSelected: boolean;
  indeterminate: boolean;
  families: BatchFamilyOption[];
}>();

const emit = defineEmits<{
  'select-all': [];
  clear: [];
  enable: [];
  disable: [];
  move: [string];
  delete: [];
}>();

const handleMasterChange = (val: unknown) => {
  if (val) {
    emit('select-all');
  } else {
    emit('clear');
  }
};

const handleMove = (val: string) => {
  if (!val) return;
  emit('move', val);
};
</script>

<template>
  <transition name="el-zoom-in-top">
    <div
      v-if="props.selectedCount > 0"
      class="flex items-center justify-between p-2.5 rounded-xl border text-xs gap-3"
      style="border-color: rgba(99, 102, 241, 0.25); background: rgba(99, 102, 241, 0.04)"
    >
      <div class="flex items-center gap-3">
        <Checkbox
          :model-value="props.isAllSelected"
          :indeterminate="props.indeterminate"
          class="shrink-0"
          @change="handleMasterChange"
        />
        <span class="font-bold shrink-0" style="color: var(--text-primary)">
          已选择 <span style="color: #6366f1">{{ props.selectedCount }}</span> /
          {{ props.total }} 个模型
        </span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          class="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer shrink-0"
          style="border-color: var(--border-base); color: var(--text-secondary)"
          @click="emit('clear')"
        >
          取消
        </button>
        <div class="h-3.5 w-[1px] shrink-0" style="background-color: var(--border-base)"></div>
        <button
          type="button"
          class="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 cursor-pointer shrink-0"
          style="
            border-color: rgba(16, 185, 129, 0.25);
            color: #059669;
            background: rgba(16, 185, 129, 0.05);
          "
          @click="emit('enable')"
        >
          启用
        </button>
        <button
          type="button"
          class="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 cursor-pointer shrink-0"
          style="
            border-color: rgba(100, 116, 139, 0.25);
            color: var(--text-secondary);
            background: rgba(100, 116, 139, 0.05);
          "
          @click="emit('disable')"
        >
          禁用
        </button>
        <Select
          :model-value="''"
          size="small"
          placeholder="移动到分类..."
          class="w-36 shrink-0"
          @change="handleMove"
        >
          <SelectOption
            v-for="family in props.families"
            :key="family.key"
            :label="`${family.label} (${family.count})`"
            :value="family.key"
          />
        </Select>
        <button
          type="button"
          class="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 cursor-pointer shrink-0"
          style="
            border-color: rgba(244, 63, 94, 0.25);
            color: #e11d48;
            background: rgba(244, 63, 94, 0.05);
          "
          @click="emit('delete')"
        >
          删除
        </button>
      </div>
    </div>
  </transition>
</template>

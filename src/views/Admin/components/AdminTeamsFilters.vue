<script setup lang="ts">
import Card from '@/components/ui/Card.vue';
import type { VisibilityFilter, RiskFilter, SortBy } from './adminTeamsTypes';

const props = defineProps<{
  visibilityFilter: VisibilityFilter;
  riskFilter: RiskFilter;
  categoryFilter: string;
  sortBy: SortBy;
  categories: string[];
}>();

const emit = defineEmits<{
  (e: 'update:visibilityFilter', value: VisibilityFilter): void;
  (e: 'update:riskFilter', value: RiskFilter): void;
  (e: 'update:categoryFilter', value: string): void;
  (e: 'update:sortBy', value: SortBy): void;
}>();

const visibilityOptions = [
  { value: 'ALL' as VisibilityFilter, label: '全部公开性' },
  { value: 'PUBLIC' as VisibilityFilter, label: '公开' },
  { value: 'PRIVATE' as VisibilityFilter, label: '私有' },
];

const riskOptions = [
  { value: 'ALL' as RiskFilter, label: '全部状态' },
  { value: 'PENDING' as RiskFilter, label: '有待处理' },
  { value: 'OVERDUE' as RiskFilter, label: '存在逾期' },
  { value: 'UNASSIGNED' as RiskFilter, label: '未分配任务' },
  { value: 'EMPTY' as RiskFilter, label: '空团队' },
];

const sortOptions = [
  { value: 'createdAt' as SortBy, label: '创建时间' },
  { value: 'updatedAt' as SortBy, label: '最近更新' },
  { value: 'name' as SortBy, label: '团队名称' },
  { value: 'health' as SortBy, label: '健康分' },
];
</script>

<template>
  <Card padding="sm">
    <div class="flex items-center gap-2 flex-wrap">
      <Select
        :model-value="props.visibilityFilter"
        size="small"
        style="width: 110px"
        @update:model-value="emit('update:visibilityFilter', $event as VisibilityFilter)"
      >
        <SelectOption
          v-for="option in visibilityOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </Select>

      <Select
        :model-value="props.riskFilter"
        size="small"
        style="width: 120px"
        @update:model-value="emit('update:riskFilter', $event as RiskFilter)"
      >
        <SelectOption
          v-for="option in riskOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </Select>

      <Select
        :model-value="props.categoryFilter"
        size="small"
        style="width: 110px"
        @update:model-value="emit('update:categoryFilter', $event as string)"
      >
        <SelectOption label="全部分类" value="" />
        <SelectOption v-for="cat in props.categories" :key="cat" :label="cat" :value="cat" />
      </Select>

      <Select
        :model-value="props.sortBy"
        size="small"
        style="width: 110px"
        @update:model-value="emit('update:sortBy', $event as SortBy)"
      >
        <SelectOption
          v-for="option in sortOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </Select>
    </div>
  </Card>
</template>

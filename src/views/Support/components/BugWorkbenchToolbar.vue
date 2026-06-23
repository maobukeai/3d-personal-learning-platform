<script setup lang="ts">
import { type Component } from 'vue';
import Card from '@/components/ui/Card.vue';
import Tabs from '@/components/ui/Tabs.vue';

type TabKey = 'submit' | 'history';

interface Props {
  activeTab: TabKey;
  tabOptions: { label: string; value: string; icon?: Component; badge?: number }[];
}

defineProps<Props>();

const emit = defineEmits(['update:activeTab']);
</script>

<template>
  <Card padding="sm" class="workbench-toolbar-card">
    <div class="toolbar-top flex items-center justify-between">
      <div class="overflow-x-auto scrollbar-hide shrink-0 max-w-full">
        <Tabs
          :model-value="activeTab"
          :options="tabOptions"
          size="sm"
          @update:model-value="emit('update:activeTab', $event as TabKey)"
        />
      </div>
    </div>
  </Card>
</template>

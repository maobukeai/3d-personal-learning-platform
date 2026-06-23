<script setup lang="ts">
import { computed } from 'vue';
import { RefreshCw } from 'lucide-vue-next';

const props = defineProps<{
  isTestingAi: boolean;
  testingAiModelId: string;
}>();

const emit = defineEmits<{
  test: [];
}>();

const isTestingDefault = computed(
  () => props.isTestingAi && props.testingAiModelId === '__legacy__',
);
</script>

<template>
  <div
    class="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl border gap-4"
    style="border-color: rgba(99, 102, 241, 0.2); background: rgba(99, 102, 241, 0.02)"
  >
    <p class="text-[10px] hidden sm:block" style="color: var(--text-muted)">
      {{ $t('admin.please_test_connectivity_before') }}
    </p>
    <button
      type="button"
      :disabled="props.isTestingAi"
      class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 disabled:opacity-50 cursor-pointer"
      style="
        border-color: rgba(99, 102, 241, 0.3);
        color: #6366f1;
        background: rgba(99, 102, 241, 0.06);
      "
      @click="emit('test')"
    >
      <RefreshCw class="w-3.5 h-3.5" :class="isTestingDefault ? 'animate-spin' : ''" />
      <span>{{
        isTestingDefault ? $t('admin.testing') : $t('admin.test_default_model_connections')
      }}</span>
    </button>
  </div>
</template>

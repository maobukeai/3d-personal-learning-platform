<script setup lang="ts">
import { computed } from 'vue';
import Modal from '@/components/ui/Modal.vue';
import type { AiProviderModelOption } from './AiSettingsTab.types';

const props = defineProps<{
  show: boolean;
  targetName: string;
  total: number;
  search: string;
  options: AiProviderModelOption[];
  selectedIds: string[];
}>();

const emit = defineEmits<{
  close: [];
  'update:search': [string];
  'update:selected-ids': [string[]];
  apply: [];
}>();

const localSearch = computed({
  get: () => props.search,
  set: (value) => emit('update:search', value),
});

const localSelectedIds = computed({
  get: () => props.selectedIds,
  set: (value) => emit('update:selected-ids', value),
});

const filteredOptions = computed(() => {
  const keyword = localSearch.value.trim().toLowerCase();
  if (!keyword) return props.options;
  return props.options.filter((model) =>
    [model.id, model.name, model.ownedBy]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)),
  );
});
</script>

<template>
  <Modal :show="props.show" title="选择可用模型" size="lg" @close="emit('close')">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-bold truncate" style="color: var(--text-primary)">
            {{ props.targetName || 'AI Model' }}
          </p>
          <p class="text-[11px] truncate" style="color: var(--text-muted)">
            {{ props.total }} 个可用模型
          </p>
        </div>
        <input
          v-model="localSearch"
          type="text"
          placeholder="搜索模型"
          class="w-56 px-3 py-2 rounded-xl border text-xs outline-none transition-colors"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        />
      </div>

      <div
        class="max-h-[420px] overflow-y-auto rounded-xl border"
        style="border-color: var(--border-base); background: var(--bg-app)"
      >
        <CheckboxGroup v-model="localSelectedIds" class="block">
          <div
            v-for="option in filteredOptions"
            :key="option.id"
            class="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 transition-colors hover:bg-white/60 dark:hover:bg-white/5"
            style="border-color: var(--border-base)"
          >
            <Checkbox :value="option.id" />
            <span class="min-w-0 flex-1">
              <span
                class="block text-xs font-bold font-mono truncate"
                style="color: var(--text-primary)"
                >{{ option.id }}</span
              >
              <span
                v-if="option.name || option.ownedBy"
                class="block text-[10px] truncate"
                style="color: var(--text-muted)"
              >
                {{ [option.name, option.ownedBy].filter(Boolean).join(' / ') }}
              </span>
            </span>
          </div>
        </CheckboxGroup>

        <div
          v-if="filteredOptions.length === 0"
          class="py-10 text-center text-xs"
          style="color: var(--text-muted)"
        >
          未找到匹配模型
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <span class="text-[11px]" style="color: var(--text-muted)">
          已选择 {{ localSelectedIds.length }} 个
        </span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
            style="
              background: linear-gradient(135deg, #6366f1, #8b5cf6);
              color: white;
              box-shadow: 0 2px 12px rgba(99, 102, 241, 0.25);
            "
            @click="emit('apply')"
          >
            应用选择
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

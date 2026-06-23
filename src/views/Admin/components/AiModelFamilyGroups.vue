<script setup lang="ts">
import { GripVertical, Edit3, Plus } from 'lucide-vue-next';
import { PENDING_MODEL_FAMILY_KEY } from '@/utils/aiModelFamilies';
import AiModelCard from './AiModelCard.vue';
import type { AiModelConfig, ModelFamilyGroup } from './AiSettingsTab.types';

const props = defineProps<{
  groups: ModelFamilyGroup[];
  configs: AiModelConfig[];
  disabledGroupKeys: string[];
  expandedGroups: string[];
  expandedModelId: string | null;
  selectedIds: string[];
  selectionActive: boolean;
  pendingIds: string[];
  isTestingAi: boolean;
  testingAiModelId: string;
  isFetchingAiModels: boolean;
  fetchingAiModelsModelId: string;
  isHandleClicked: boolean;
  isGroupHandleClicked: boolean;
  draggedGroupKey: string | null;
  dragIndex: number | null;
}>();

const emit = defineEmits<{
  'toggle-collapse': [string];
  'rename-group': [string, string];
  'toggle-group-enabled': [string, boolean];
  'add-model-to-family': [ModelFamilyGroup];
  'toggle-group-selection': [ModelFamilyGroup];
  'group-dragstart': [DragEvent, string];
  'group-dragend': [];
  'group-mousedown': [];
  'drop-on-group': [DragEvent, ModelFamilyGroup];
  'card-expand': [string];
  'card-dragstart': [DragEvent, number];
  'card-drop': [DragEvent, number];
  'card-dragend': [];
  'card-mouse-down': [];
  'toggle-selection': [string, unknown];
  'update:model': [string, Partial<AiModelConfig>];
  'set-default': [AiModelConfig];
  clone: [AiModelConfig];
  'confirm-family': [AiModelConfig];
  remove: [AiModelConfig];
  test: [AiModelConfig];
  'fetch-models': [AiModelConfig];
  'model-name-blur': [AiModelConfig];
  'add-backup-key': [AiModelConfig];
  'remove-backup-key': [AiModelConfig, number];
}>();

const isCollapsed = (key: string) => !props.expandedGroups.includes(key);
const isGroupEnabled = (key: string) => !props.disabledGroupKeys.includes(key);
const isPending = (id: string) => props.pendingIds.includes(id);
const getModelIndex = (model: AiModelConfig) =>
  props.configs.findIndex((item) => item.id === model.id);
const getGroupSelectedCount = (group: ModelFamilyGroup) =>
  group.models.filter((model) => props.selectedIds.includes(model.id)).length;
</script>

<template>
  <div v-if="props.groups.length > 0" class="space-y-4">
    <section
      v-for="group in props.groups"
      :key="group.key"
      :draggable="props.isGroupHandleClicked"
      class="rounded-2xl border overflow-hidden transition-all duration-300"
      :class="{
        'opacity-50 border-indigo-400 scale-[0.99]': props.draggedGroupKey === group.key,
      }"
      :style="`border-color: ${group.meta.border}; background: var(--bg-card);`"
      @dragstart="emit('group-dragstart', $event, group.key)"
      @dragend="emit('group-dragend')"
      @dragover.prevent
      @drop="emit('drop-on-group', $event, group)"
    >
      <header
        class="px-4 py-4 border-b"
        style="border-color: var(--border-base); background: var(--bg-app)"
      >
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div
            class="flex items-start gap-3 min-w-0 cursor-pointer select-none"
            @click="emit('toggle-collapse', group.key)"
          >
            <!-- Group Drag handle -->
            <div
              class="flex items-center justify-center p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors duration-150 cursor-grab active:cursor-grabbing flex-shrink-0 mt-3"
              title="拖动调整分组排序"
              @mousedown="emit('group-mousedown')"
              @click.stop
            >
              <GripVertical class="w-3.5 h-3.5 text-slate-400" />
            </div>

            <div
              class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              :style="`background: ${group.meta.bg}; border: 1px solid ${group.meta.border}; color: ${group.meta.color};`"
            >
              <component :is="group.meta.lucideIcon" class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4
                  class="text-sm font-black flex items-center gap-1.5"
                  style="color: var(--text-primary)"
                >
                  <span>{{ group.label }}</span>
                  <button
                    type="button"
                    class="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-[#6366f1] transition-colors duration-150 cursor-pointer flex items-center justify-center"
                    title="重命名分组"
                    @click.stop="emit('rename-group', group.key, group.label)"
                  >
                    <Edit3 class="w-3 h-3" />
                  </button>
                </h4>
                <span
                  class="px-2 py-0.5 rounded-lg text-[10px] font-bold"
                  :style="`background: ${group.meta.bg}; color: ${group.meta.color};`"
                  >{{ $t('admin.ai_model_count', { count: group.models.length }) }}</span
                >
                <span
                  class="px-2 py-0.5 rounded-lg text-[10px] font-bold"
                  style="background: rgba(99, 102, 241, 0.1); color: #6366f1"
                  >{{ $t('admin.ai_model_enabled_count', { count: group.enabledCount }) }}</span
                >
                <span
                  class="px-2 py-0.5 rounded-lg text-[10px] font-bold"
                  style="
                    background: var(--bg-card);
                    color: var(--text-muted);
                    border: 1px solid var(--border-base);
                  "
                  >{{ group.providerLabel }}</span
                >
              </div>
              <div
                class="flex flex-wrap items-center gap-3 mt-1.5 text-[10px]"
                style="color: var(--text-muted)"
              >
                <span class="font-mono truncate max-w-[360px]">{{ group.endpointLabel }}</span>
                <span
                  v-if="group.defaultModel"
                  class="font-bold text-amber-600 dark:text-amber-400"
                  >{{
                    $t('admin.ai_default_model_named', {
                      name: group.defaultModel.name || group.defaultModel.modelName,
                    })
                  }}</span
                >
                <span v-else>{{ $t('admin.ai_no_default_model') }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              :disabled="group.models.length === 0"
              class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-200 disabled:opacity-50"
              :style="
                getGroupSelectedCount(group) > 0
                  ? 'border-color: rgba(99, 102, 241, 0.3); color: #6366f1; background: rgba(99, 102, 241, 0.02);'
                  : 'border-color: var(--border-base); color: var(--text-secondary); background: var(--bg-card);'
              "
              @click.stop="emit('toggle-group-selection', group)"
            >
              <span>{{
                getGroupSelectedCount(group) === group.models.length && group.models.length > 0
                  ? '取消本组'
                  : '选择本组'
              }}</span>
              <span
                v-if="getGroupSelectedCount(group) > 0"
                class="px-1.5 py-0.5 rounded-md text-[10px]"
                style="background: rgba(99, 102, 241, 0.1); color: #6366f1"
                >{{ getGroupSelectedCount(group) }}</span
              >
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-200"
              :style="`border-color: ${group.meta.border}; color: ${group.meta.color}; background: ${group.meta.bg};`"
              @click="emit('add-model-to-family', group)"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>{{ $t('admin.ai_add_family_model', { family: group.label }) }}</span>
            </button>
            <el-switch
              :model-value="isGroupEnabled(group.key)"
              inline-prompt
              active-text="启用"
              inactive-text="禁用"
              style="--el-switch-on-color: #10b981; --el-switch-off-color: #94a3b8"
              class="mr-2"
              @change="(val: unknown) => emit('toggle-group-enabled', group.key, Boolean(val))"
              @click.stop
            />
            <button
              type="button"
              class="w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-200"
              style="
                border-color: var(--border-base);
                color: var(--text-muted);
                background: var(--bg-card);
              "
              :title="
                isCollapsed(group.key) ? $t('admin.expand_group') : $t('admin.collapse_group')
              "
              @click="emit('toggle-collapse', group.key)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                class="w-4 h-4 transition-transform"
                :class="isCollapsed(group.key) ? '-rotate-90' : ''"
              >
                <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div v-show="!isCollapsed(group.key)" class="space-y-2 p-3">
        <div
          v-if="group.models.length === 0"
          class="text-center py-8 border border-dashed rounded-xl text-xs text-slate-400 select-none"
          style="border-color: var(--border-base)"
        >
          拖拽模型到此处以分类
        </div>
        <AiModelCard
          v-for="model in group.models"
          :key="model.id"
          :model="model"
          :group-meta="
            group.key === PENDING_MODEL_FAMILY_KEY
              ? { ...group.meta, bg: group.meta.bg, color: group.meta.color }
              : group.meta
          "
          :model-index="getModelIndex(model)"
          :selected="props.selectedIds.includes(model.id)"
          :selection-active="props.selectionActive"
          :expanded="props.expandedModelId === model.id"
          :is-pending="isPending(model.id)"
          :is-testing="props.isTestingAi"
          :testing-model-id="props.testingAiModelId"
          :is-fetching="props.isFetchingAiModels"
          :fetching-model-id="props.fetchingAiModelsModelId"
          :dragged-index="props.dragIndex"
          :is-handle-clicked="props.isHandleClicked"
          @expand="emit('card-expand', model.id)"
          @dragstart="(e: DragEvent, idx: number) => emit('card-dragstart', e, idx)"
          @drop="(e: DragEvent, idx: number) => emit('card-drop', e, idx)"
          @dragend="emit('card-dragend')"
          @mouse-down="emit('card-mouse-down')"
          @toggle-selection="
            (id: string, checked: unknown) => emit('toggle-selection', id, checked)
          "
          @update:model="(patch: Partial<AiModelConfig>) => emit('update:model', model.id, patch)"
          @set-default="emit('set-default', model)"
          @clone="emit('clone', model)"
          @confirm-family="emit('confirm-family', model)"
          @remove="emit('remove', model)"
          @test="emit('test', model)"
          @fetch-models="emit('fetch-models', model)"
          @model-name-blur="emit('model-name-blur', model)"
          @add-backup-key="emit('add-backup-key', model)"
          @remove-backup-key="(idx: number) => emit('remove-backup-key', model, idx)"
        />
      </div>
    </section>
  </div>
</template>

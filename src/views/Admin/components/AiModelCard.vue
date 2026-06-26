<script setup lang="ts">
import { computed, ref, reactive } from 'vue';
import { GripVertical, RefreshCw, Eye, EyeOff } from 'lucide-vue-next';
import { useAiSettingsMeta } from './AiSettingsTab.meta';
import type { AiModelConfig, ProviderMeta } from './AiSettingsTab.types';

const props = defineProps<{
  model: AiModelConfig;
  groupMeta: ProviderMeta;
  modelIndex: number;
  selected: boolean;
  selectionActive: boolean;
  expanded: boolean;
  isPending: boolean;
  isTesting: boolean;
  testingModelId: string;
  isFetching: boolean;
  fetchingModelId: string;
  draggedIndex: number | null;
  isHandleClicked: boolean;
}>();

const emit = defineEmits<{
  'update:model': [Partial<AiModelConfig>];
  expand: [];
  dragstart: [DragEvent, number];
  drop: [DragEvent, number];
  dragend: [];
  'mouse-down': [];
  'toggle-selection': [string, unknown];
  'set-default': [];
  clone: [];
  'confirm-family': [];
  remove: [];
  test: [];
  'fetch-models': [];
  'model-name-blur': [];
  'add-backup-key': [];
  'remove-backup-key': [number];
}>();

const { providerMeta, getCapabilityLabel, getCapabilityStyle, aiProviderDefaults } =
  useAiSettingsMeta();

const providerMetaForModel = computed(
  () => providerMeta[props.model.provider] || providerMeta.CUSTOM,
);

const isTestingThis = computed(() => props.isTesting && props.testingModelId === props.model.id);
const isFetchingThis = computed(() => props.isFetching && props.fetchingModelId === props.model.id);
const isDragged = computed(
  () => props.draggedIndex !== null && props.draggedIndex === props.modelIndex,
);

const update = (patch: Partial<AiModelConfig>) => {
  emit('update:model', patch);
};

const updateProvider = (provider: string) => {
  const defaults = aiProviderDefaults[provider];
  update({
    provider,
    endpoint: defaults?.endpoint ?? '',
    modelName: defaults?.model ?? '',
  });
};

const updateCapability = (cap: string, checked: unknown) => {
  const capabilities = [...props.model.capabilities];
  if (checked) {
    if (!capabilities.includes(cap)) capabilities.push(cap);
  } else {
    const idx = capabilities.indexOf(cap);
    if (idx > -1) capabilities.splice(idx, 1);
  }
  update({ capabilities });
};

const updateBackupKey = (index: number, value: string) => {
  const apiKeys = [...(props.model.apiKeys || [])];
  apiKeys[index] = value;
  update({ apiKeys });
};

const handleModelNameBlur = (e: Event) => {
  update({ modelName: (e.target as HTMLTextAreaElement).value });
  emit('model-name-blur');
};

const showApiKey = ref(false);
const showBackupKeys = reactive<Record<number, boolean>>({});
</script>

<template>
  <div
    :draggable="props.isHandleClicked"
    class="group rounded-xl border overflow-hidden transition-all duration-300 hover:shadow-sm hover:border-slate-300 dark:hover:border-zinc-700"
    :class="{
      'opacity-50 border-indigo-400 scale-[0.99]': isDragged,
    }"
    :style="
      props.selected
        ? 'border-color: rgba(99, 102, 241, 0.5); background-color: rgba(99, 102, 241, 0.03);'
        : props.model.isDefault
          ? 'border-color: rgba(99, 102, 241, 0.4); background-color: var(--bg-card);'
          : 'border-color: var(--border-base); background-color: var(--bg-card);'
    "
    @dragstart="emit('dragstart', $event, props.modelIndex)"
    @dragover.prevent
    @drop="emit('drop', $event, props.modelIndex)"
    @dragend="emit('dragend')"
  >
    <!-- Card Header -->
    <div
      class="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors duration-200"
      :style="props.expanded ? 'background: var(--bg-app);' : ''"
      @click="emit('expand')"
    >
      <!-- Drag handle -->
      <div
        class="flex items-center justify-center p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors duration-150 cursor-grab active:cursor-grabbing flex-shrink-0"
        :title="$t('admin.drag_and_drop_to')"
        @mousedown="emit('mouse-down')"
        @click.stop
      >
        <GripVertical class="w-3.5 h-3.5 text-slate-400" />
      </div>

      <el-checkbox
        :model-value="props.selected"
        class="shrink-0 transition-opacity duration-200"
        :class="
          props.selected || props.selectionActive
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100'
        "
        @change="emit('toggle-selection', props.model.id, $event)"
        @click.stop
      />

      <span
        class="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 font-bold"
        :style="`background: ${props.groupMeta.bg}; color: ${props.groupMeta.color};`"
      >
        <component :is="providerMetaForModel.lucideIcon" class="w-3.5 h-3.5" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-bold truncate" style="color: var(--text-primary)">{{
            props.model.name || props.model.modelName
          }}</span>
          <span
            v-if="props.model.isDefault"
            class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold"
            >{{ $t('admin.default_model') }}</span
          >
          <span
            v-if="props.isPending"
            class="px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500 text-[9px] font-bold"
            >{{ $t('admin.not_classified') }}</span
          >
          <template v-if="props.model.capabilities && props.model.capabilities.length > 0">
            <span
              v-for="cap in props.model.capabilities"
              :key="cap"
              class="px-1.5 py-0.5 rounded text-[9px] font-bold"
              :style="getCapabilityStyle(cap)"
            >
              {{ getCapabilityLabel(cap) }}
            </span>
          </template>
          <span
            v-if="(props.model.apiKeys || []).filter(Boolean).length > 0"
            class="px-1.5 py-0.5 rounded text-[9px] font-bold"
            style="background: rgba(16, 185, 129, 0.1); color: #059669"
            :title="`共 ${1 + (props.model.apiKeys || []).filter(Boolean).length} 个密钥，主密钥失效时自动轮换`"
            >{{ 1 + (props.model.apiKeys || []).filter(Boolean).length }} 个密钥</span
          >
          <span
            v-if="props.model.failoverEnabled === false"
            class="px-1.5 py-0.5 rounded text-[9px] font-bold"
            style="background: rgba(100, 116, 139, 0.1); color: #64748b"
            title="此模型不参与自动故障转移"
            >故障转移已关闭</span
          >
        </div>
        <div class="flex items-center gap-3 mt-1 text-[9px]" style="color: var(--text-muted)">
          <span class="font-mono truncate max-w-[200px]">{{ props.model.modelName }}</span>
          <span>{{ providerMetaForModel.label }}</span>
        </div>
      </div>

      <div class="flex items-center gap-1.5 shrink-0" @click.stop>
        <el-switch
          :model-value="props.model.enabled"
          size="small"
          style="--el-switch-on-color: #10b981; --el-switch-off-color: #e2e8f0"
          @change="(val: unknown) => update({ enabled: Boolean(val) })"
        />
        <el-dropdown trigger="click" size="small">
          <button
            type="button"
            class="w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors border-none bg-transparent cursor-pointer"
          >
            <svg
              viewBox="0 0 24 24"
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :disabled="!props.model.enabled" @click="emit('set-default')">
                设为默认模型
              </el-dropdown-item>
              <el-dropdown-item @click="emit('clone')"> 复制模型 </el-dropdown-item>
              <el-dropdown-item v-if="props.isPending" @click="emit('confirm-family')">
                确认分类
              </el-dropdown-item>
              <el-dropdown-item
                class="!text-rose-500 hover:!bg-rose-50 dark:hover:!bg-rose-950/20"
                @click="emit('remove')"
              >
                删除模型
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- Expanded Details -->
    <div
      v-if="props.expanded"
      class="px-5 py-4 border-t space-y-4"
      style="border-color: var(--border-base); background: var(--bg-card-expanded)"
      @click.stop
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mobile-grid">
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold text-slate-400">模型自定义名称</label>
          <input
            :value="props.model.name"
            type="text"
            draggable="false"
            class="w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
            @dragstart.stop
            @change="(e: Event) => update({ name: (e.target as HTMLInputElement).value })"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] font-bold text-slate-400">服务商/模型池</label>
          <el-select
            :model-value="props.model.provider"
            size="default"
            class="w-full"
            @change="(val: string) => updateProvider(val)"
          >
            <el-option
              v-for="(metaData, key) in providerMeta"
              :key="key"
              :label="metaData.label"
              :value="key"
            />
          </el-select>
        </div>

        <div class="space-y-1.5 md:col-span-2">
          <div class="flex items-center justify-between">
            <label class="text-[10px] font-bold text-slate-400">API Endpoint (请求端点)</label>
            <button
              v-if="props.model.provider === 'OLLAMA'"
              type="button"
              class="text-[9px] text-[#6366f1] hover:underline bg-transparent border-none cursor-pointer"
              @click="update({ endpoint: 'http://localhost:11434/v1' })"
            >
              使用 Ollama /v1 兼容格式
            </button>
          </div>
          <input
            :value="props.model.endpoint"
            type="text"
            draggable="false"
            class="w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none transition-colors"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
            @dragstart.stop
            @change="(e: Event) => update({ endpoint: (e.target as HTMLInputElement).value })"
          />
        </div>

        <div class="space-y-1.5 md:col-span-2">
          <div class="flex items-center justify-between">
            <label class="text-[10px] font-bold text-slate-400 flex items-center gap-1.5"
              >API Key (主密钥)</label
            >
            <span
              v-if="(props.model.apiKeys || []).filter(Boolean).length > 0"
              class="px-2 py-0.5 rounded-full text-[9px] font-bold"
              style="background: rgba(16, 185, 129, 0.1); color: #059669"
              >+{{ (props.model.apiKeys || []).filter(Boolean).length }} 个备用密钥</span
            >
          </div>
          <div class="relative flex items-center">
            <input
              :value="props.model.apiKey"
              :type="showApiKey ? 'text' : 'password'"
              draggable="false"
              class="w-full pl-3 pr-9 py-2 rounded-lg border text-xs font-mono outline-none transition-colors"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="主 API Key（必填）"
              @dragstart.stop
              @change="(e: Event) => update({ apiKey: (e.target as HTMLInputElement).value })"
            />
            <button
              type="button"
              class="absolute right-2.5 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center p-1"
              style="background: transparent; border: none; cursor: pointer;"
              :title="showApiKey ? '隐藏密钥' : '显示密钥'"
              @click="showApiKey = !showApiKey"
            >
              <Eye v-if="showApiKey" class="w-3.5 h-3.5" />
              <EyeOff v-else class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Backup Keys -->
          <div class="mt-2 space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 flex items-center gap-1">
              <svg
                viewBox="0 0 24 24"
                class="w-3 h-3"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              备用密钥（自动故障转移轮换，主密钥失效时依次尝试）
            </label>
            <div
              v-for="(_, keyIdx) in props.model.apiKeys || []"
              :key="keyIdx"
              class="flex items-center gap-2"
            >
              <div class="relative flex-1 flex items-center">
                <input
                  :value="(props.model.apiKeys || [])[keyIdx]"
                  :type="showBackupKeys[keyIdx] ? 'text' : 'password'"
                  draggable="false"
                  class="w-full pl-3 pr-9 py-1.5 rounded-lg border text-xs font-mono outline-none transition-colors"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                  :placeholder="`备用密钥 ${keyIdx + 1}`"
                  @dragstart.stop
                  @input="(e: Event) => updateBackupKey(keyIdx, (e.target as HTMLInputElement).value)"
                />
                <button
                  type="button"
                  class="absolute right-2.5 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center p-1"
                  style="background: transparent; border: none; cursor: pointer;"
                  :title="showBackupKeys[keyIdx] ? '隐藏密钥' : '显示密钥'"
                  @click="showBackupKeys[keyIdx] = !showBackupKeys[keyIdx]"
                >
                  <Eye v-if="showBackupKeys[keyIdx]" class="w-3.5 h-3.5" />
                  <EyeOff v-else class="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                class="w-6 h-6 rounded flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex-shrink-0"
                title="删除此备用密钥"
                @click="emit('remove-backup-key', keyIdx)"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="flex items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer bg-transparent border-none"
              style="color: #6366f1"
              @click="emit('add-backup-key')"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-3 h-3"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              添加备用密钥
            </button>
          </div>
        </div>

        <div class="space-y-1.5 md:col-span-2">
          <div class="flex items-center justify-between">
            <label class="text-[10px] font-bold text-slate-400"
              >模型标识符 ID (每行一个表示支持批量部署)</label
            >
            <button
              type="button"
              :disabled="props.isFetching"
              class="flex items-center gap-1 text-[9px] text-[#6366f1] hover:underline disabled:opacity-50 bg-transparent border-none cursor-pointer"
              @click="emit('fetch-models')"
            >
              <RefreshCw class="w-2.5 h-2.5" :class="isFetchingThis ? 'animate-spin' : ''" />
              <span>在线拉取模型列表</span>
            </button>
          </div>
          <textarea
            :value="props.model.modelName"
            rows="2"
            draggable="false"
            class="w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none transition-colors resize-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
            placeholder="gpt-4o-mini"
            @dragstart.stop
            @blur="handleModelNameBlur"
          ></textarea>
        </div>
      </div>

      <!-- Advanced Options -->
      <div class="border-t pt-3" style="border-color: var(--border-base)">
        <button
          type="button"
          class="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer"
          @click="update({ showAdvanced: !props.model.showAdvanced })"
        >
          <span>高级配置参数</span>
          <svg
            viewBox="0 0 24 24"
            class="w-3 h-3 transition-transform"
            :class="props.model.showAdvanced ? 'rotate-180' : ''"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div
          v-if="props.model.showAdvanced"
          class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 animate-in fade-in duration-200 mobile-grid"
        >
          <div class="space-y-1.5 md:col-span-2">
            <label class="text-[10px] font-bold text-slate-400">能力支持 (Capabilities)</label>
            <div class="flex items-center gap-3 mt-1 flex-wrap">
              <el-checkbox
                :model-value="props.model.capabilities.includes('chat')"
                label="对话 (Chat)"
                @change="(checked: unknown) => updateCapability('chat', checked)"
              />
              <el-checkbox
                :model-value="props.model.capabilities.includes('image')"
                label="画图 (Image)"
                @change="(checked: unknown) => updateCapability('image', checked)"
              />
              <el-checkbox
                :model-value="props.model.capabilities.includes('video')"
                label="视频 (Video)"
                @change="(checked: unknown) => updateCapability('video', checked)"
              />
              <el-checkbox
                :model-value="props.model.capabilities.includes('translate')"
                label="翻译 (Translate)"
                @change="(checked: unknown) => updateCapability('translate', checked)"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-slate-400"
                >Temperature: {{ props.model.temperature }}</label
              >
            </div>
            <el-slider
              :model-value="props.model.temperature ?? 0.7"
              :min="0"
              :max="2"
              :step="0.1"
              class="w-full"
              @change="
                (val: number | number[]) =>
                  update({ temperature: Array.isArray(val) ? val[0] : val })
              "
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400">最大回复 Tokens (Max Tokens)</label>
            <input
              :value="props.model.maxTokens"
              type="number"
              min="1"
              max="32768"
              draggable="false"
              class="w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              @dragstart.stop
              @change="
                (e: Event) => update({ maxTokens: Number((e.target as HTMLInputElement).value) })
              "
            />
          </div>

          <div class="space-y-1.5 md:col-span-2">
            <label class="text-[10px] font-bold text-slate-400"
              >系统引导词提示 (System Prompt)</label
            >
            <textarea
              :value="props.model.systemPrompt"
              rows="3"
              draggable="false"
              class="w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors resize-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="引导AI的系统 Prompt 提示词"
              @dragstart.stop
              @change="
                (e: Event) => update({ systemPrompt: (e.target as HTMLTextAreaElement).value })
              "
            ></textarea>
          </div>

          <div
            class="md:col-span-2 flex items-center justify-between p-3 rounded-xl border"
            style="border-color: var(--border-base); background: var(--bg-app)"
          >
            <div>
              <div class="text-[10px] font-bold" style="color: var(--text-primary)">
                参与自动故障转移
              </div>
              <div class="text-[9px] mt-0.5" style="color: var(--text-muted)">
                开启后，主密钥或模型失败时系统将自动切换至此模型/其他密钥
              </div>
            </div>
            <el-switch
              :model-value="props.model.failoverEnabled !== false"
              size="small"
              style="--el-switch-on-color: #6366f1; --el-switch-off-color: #94a3b8"
              @change="(val: unknown) => update({ failoverEnabled: Boolean(val) })"
            />
          </div>
        </div>
      </div>

      <!-- Card Actions -->
      <div
        class="flex items-center justify-between border-t pt-3"
        style="border-color: var(--border-base)"
      >
        <button
          type="button"
          :disabled="props.isTesting"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 disabled:opacity-50 cursor-pointer"
          style="
            border-color: rgba(99, 102, 241, 0.3);
            color: #6366f1;
            background: rgba(99, 102, 241, 0.03);
          "
          @click="emit('test')"
        >
          <RefreshCw class="w-3 h-3" :class="isTestingThis ? 'animate-spin' : ''" />
          <span>{{ isTestingThis ? '正在测试...' : '测试此连接' }}</span>
        </button>

        <div class="flex items-center gap-2">
          <button
            v-if="props.isPending"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer"
            style="
              background: linear-gradient(135deg, #10b981, #059669);
              color: white;
              box-shadow: 0 2px 10px rgba(16, 185, 129, 0.2);
            "
            @click="emit('confirm-family')"
          >
            确认分类
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="emit('clone')"
          >
            复制
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
            style="border-color: rgba(244, 63, 94, 0.2)"
            @click="emit('remove')"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

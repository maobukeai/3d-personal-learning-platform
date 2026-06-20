<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, reactive, watch, computed, onMounted, type Component } from 'vue';
import {
  Cpu,
  Sparkles,
  Database,
  Globe,
  Cloud,
  Settings,
  Plus,
  Download,
  Upload,
  Edit3,
  Sliders,
  GripVertical,
  RefreshCw,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import Modal from '@/components/ui/Modal.vue';
import {
  PENDING_MODEL_FAMILY_KEY,
  inferModelFamilyKey,
  parseModelNameLines,
  titleCaseModelFamily,
} from '@/utils/aiModelFamilies';

interface AiModelConfig {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  endpoint: string;
  apiKey: string;
  apiKeys?: string[];
  enabled: boolean;
  isDefault: boolean;
  description: string;
  capabilities: string[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  showAdvanced?: boolean;
  customFamilyKey?: string;
  customFamilyLabel?: string;
  failoverEnabled?: boolean;
  priority?: number;
}

interface AiModelCategory {
  key: string;
  label: string;
}

interface AiProviderModelOption {
  id: string;
  name?: string;
  ownedBy?: string;
}

interface ModelFamilyGroup {
  key: string;
  label: string;
  provider: string;
  providerLabel: string;
  models: AiModelConfig[];
  enabledCount: number;
  defaultModel?: AiModelConfig;
  endpointLabel: string;
  meta: { color: string; bg: string; border: string; label: string; lucideIcon: Component };
}

const props = defineProps<{
  settings: Record<string, unknown>;
  aiModelConfigs: AiModelConfig[];
  pendingModelFamilyIds: string[];
}>();

const emit = defineEmits<{
  (e: 'update:settings', val: Record<string, unknown>): void;
  (e: 'update:aiModelConfigs', val: AiModelConfig[]): void;
  (e: 'update:pendingModelFamilyIds', val: string[]): void;
}>();

const localSettings = reactive({ ...props.settings }) as Record<string, any>;
const localAiModelConfigs = ref<AiModelConfig[]>([]);
const localPendingModelFamilyIds = ref<string[]>([]);

// Snapshot-based watchers: compare serialized values instead of deep-traversing
// the entire object on every nested mutation. This avoids the O(n) deep walk
// that Vue performs on each tick for `{ deep: true }`.
const propsSettingsSnapshot = computed(() => JSON.stringify(props.settings));
const localSettingsSnapshot = computed(() => JSON.stringify(localSettings));
const propsAiModelConfigsSnapshot = computed(() => JSON.stringify(props.aiModelConfigs));
const localAiModelConfigsSnapshot = computed(() => JSON.stringify(localAiModelConfigs.value));
const propsPendingSnapshot = computed(() => JSON.stringify(props.pendingModelFamilyIds));
const localPendingSnapshot = computed(() => JSON.stringify(localPendingModelFamilyIds.value));

watch(propsSettingsSnapshot, (val) => {
  const incoming = JSON.parse(val);
  if (localSettingsSnapshot.value !== val) {
    Object.assign(localSettings, incoming);
  }
});

watch(localSettingsSnapshot, () => {
  emit('update:settings', { ...props.settings, ...localSettings });
});

watch(
  propsAiModelConfigsSnapshot,
  (val) => {
    if (localAiModelConfigsSnapshot.value !== val) {
      localAiModelConfigs.value = JSON.parse(val);
    }
  },
  { immediate: true },
);

watch(localAiModelConfigsSnapshot, () => {
  emit('update:aiModelConfigs', localAiModelConfigs.value);
});

watch(
  propsPendingSnapshot,
  (val) => {
    if (localPendingSnapshot.value !== val) {
      localPendingModelFamilyIds.value = JSON.parse(val);
    }
  },
  { immediate: true },
);

watch(localPendingSnapshot, () => {
  emit('update:pendingModelFamilyIds', localPendingModelFamilyIds.value);
});

const aiProviderDefaults: Record<string, { endpoint: string; model: string; name: string }> = {
  AGNES: {
    endpoint: 'https://apihub.agnes-ai.com/v1',
    model: 'agnes-2.0-flash',
    name: 'Agnes 2.0 Flash',
  },
  DEEPSEEK: {
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    name: 'DeepSeek Chat',
  },
  OPENAI: {
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    name: 'OpenAI GPT-4o mini',
  },
  OLLAMA: { endpoint: 'http://localhost:11434/api', model: 'llama3', name: 'Ollama Llama3' },
  QWEN: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    name: 'Qwen Plus',
  },
  GEMINI: {
    endpoint: 'https://generativelanguage.googleapis.com',
    model: 'gemini-1.5-flash',
    name: 'Gemini Flash',
  },
  AZURE: {
    endpoint:
      'https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2023-05-15',
    model: 'gpt-4o',
    name: 'Azure OpenAI',
  },
  CUSTOM: { endpoint: '', model: '', name: t('admin.custom_model') },
};

const createAiModelConfig = (provider = 'DEEPSEEK'): AiModelConfig => {
  const defaults = aiProviderDefaults[provider] || aiProviderDefaults.DEEPSEEK;
  return {
    id: `model_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: defaults.name,
    provider,
    modelName: defaults.model,
    endpoint: defaults.endpoint,
    apiKey: '',
    apiKeys: [],
    enabled: true,
    isDefault: localAiModelConfigs.value.length === 0,
    description: '',
    capabilities: ['chat'],
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: '',
    showAdvanced: false,
    failoverEnabled: true,
  };
};

const isPendingAiModel = (id: string) => localPendingModelFamilyIds.value.includes(id);

const getPersistableAiModels = () =>
  localAiModelConfigs.value.filter(
    (model) => !isPendingAiModel(model.id) && model.modelName.trim(),
  );

const syncCustomCategoriesToSettings = () => {
  localSettings.AI_MODEL_CUSTOM_CATEGORIES = JSON.stringify(customCategories.value);
};

const syncAiModelsToSettings = () => {
  const persistableModels = getPersistableAiModels();
  if (persistableModels.length > 0 && !persistableModels.some((model) => model.isDefault)) {
    persistableModels[0].isDefault = true;
  }
  // Auto-assign priority based on list order so failover engine respects admin drag ordering
  persistableModels.forEach((model, idx) => {
    model.priority = idx;
  });
  localSettings.AI_MODEL_OPTIONS = JSON.stringify(persistableModels);
  syncCustomCategoriesToSettings();

  const defaultModel = persistableModels.find((model) => model.isDefault) || persistableModels[0];
  if (defaultModel) {
    localSettings.AI_PROVIDER = defaultModel.provider;
    localSettings.AI_API_ENDPOINT = defaultModel.endpoint;
    localSettings.AI_MODEL_NAME = defaultModel.modelName;
    localSettings.AI_API_KEY = defaultModel.apiKey;
  }
};

const markAiModelPending = (id: string) => {
  if (!localPendingModelFamilyIds.value.includes(id)) {
    localPendingModelFamilyIds.value.push(id);
  }
};

const addAiModel = (provider = 'CUSTOM') => {
  const model = createAiModelConfig(provider);
  localAiModelConfigs.value.push(model);
  markAiModelPending(model.id);
  expandedModelId.value = model.id;
  collapsedModelFamilyGroups.value = collapsedModelFamilyGroups.value.filter(
    (k) => k !== PENDING_MODEL_FAMILY_KEY,
  );
  syncAiModelsToSettings();
};

const getProviderMeta = (provider: string) => providerMeta[provider] || providerMeta.CUSTOM;

const expandModelNameLines = (
  model: AiModelConfig,
  options: { markNewAsPending?: boolean; showMessage?: boolean } = {},
) => {
  const modelNames = parseModelNameLines(model.modelName);
  const addedIds: string[] = [];
  const markNewAsPending = options.markNewAsPending ?? isPendingAiModel(model.id);
  const showMessage = options.showMessage ?? true;

  if (modelNames.length <= 1) {
    if (modelNames[0] && model.modelName !== modelNames[0]) {
      model.modelName = modelNames[0];
    }
    return { added: 0, skipped: 0, addedIds };
  }

  const existing = new Set(
    localAiModelConfigs.value
      .filter((item) => item.id !== model.id)
      .map((item) => `${item.provider}::${item.modelName}`.toLowerCase()),
  );
  const providerLabelStr = getProviderMeta(model.provider).label;
  const originalName = model.name;
  let added = 0;
  let skipped = 0;

  modelNames.forEach((modelName, index) => {
    const key = `${model.provider}::${modelName}`.toLowerCase();
    if (index === 0) {
      model.modelName = modelName;
      existing.add(key);
      return;
    }
    if (existing.has(key)) {
      skipped += 1;
      return;
    }
    existing.add(key);
    const newModelId = `model_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localAiModelConfigs.value.push({
      ...JSON.parse(JSON.stringify(model)),
      id: newModelId,
      name: `${providerLabelStr} ${modelName}`,
      modelName,
      isDefault: false,
      showAdvanced: false,
    });
    addedIds.push(newModelId);
    if (markNewAsPending) {
      markAiModelPending(newModelId);
    }
    added += 1;
  });

  if (
    !originalName ||
    originalName === model.modelName ||
    Object.values(aiProviderDefaults).some((item) => item.name === originalName)
  ) {
    model.name = `${providerLabelStr} ${model.modelName}`;
  }
  syncAiModelsToSettings();
  if (showMessage && added > 0) {
    ElMessage.success(t('admin.ai_models_added_from_list', { count: added, skipped }));
  } else if (showMessage && skipped > 0) {
    ElMessage.warning(t('admin.ai_models_all_duplicates'));
  }
  return { added, skipped, addedIds };
};

const confirmAiModelFamily = (model: AiModelConfig, options: { silent?: boolean } = {}) => {
  if (!model.modelName.trim()) {
    if (!options.silent) ElMessage.warning(t('admin.ai_model_id_required'));
    return false;
  }
  const result = expandModelNameLines(model, { markNewAsPending: false, showMessage: false });
  const confirmedIds = new Set([model.id, ...result.addedIds]);
  localPendingModelFamilyIds.value = localPendingModelFamilyIds.value.filter(
    (id) => !confirmedIds.has(id),
  );
  syncAiModelsToSettings();
  if (!options.silent) ElMessage.success(t('admin.ai_model_classified'));
  return true;
};

const cloneAiModel = (model: AiModelConfig) => {
  const cloned = {
    ...JSON.parse(JSON.stringify(model)),
    id: 'model_' + Math.random().toString(36).substring(2, 10),
    name: model.name + ' (Copy)',
    isDefault: false,
  };
  localAiModelConfigs.value.push(cloned);
  markAiModelPending(cloned.id);
  expandedModelId.value = cloned.id;
  syncAiModelsToSettings();
  ElMessage.success(t('admin.ai_model_cloned'));
};

const removeAiModel = async (id: string) => {
  if (localAiModelConfigs.value.length <= 1) {
    return ElMessage.warning(t('admin.keep_at_least_one'));
  }
  try {
    await ElMessageBox.confirm(t('admin.are_you_sure_you'), t('admin.delete_model'), {
      confirmButtonText: t('admin.delete'),
      cancelButtonText: t('admin.cancel'),
      type: 'warning',
    });
    const removed = localAiModelConfigs.value.find((model) => model.id === id);
    localAiModelConfigs.value = localAiModelConfigs.value.filter((model) => model.id !== id);
    localPendingModelFamilyIds.value = localPendingModelFamilyIds.value.filter(
      (item) => item !== id,
    );
    if (removed?.isDefault && localAiModelConfigs.value[0]) {
      localAiModelConfigs.value[0].isDefault = true;
    }
    syncAiModelsToSettings();
    ElMessage.success(t('admin.model_deleted_successfully'));
  } catch (_e) {}
};

const isTestingAi = ref(false);
const testingAiModelId = ref('');
const expandedModelId = ref<string | null>(null);
const isFetchingAiModels = ref(false);
const fetchingAiModelsModelId = ref('');
const modelFetchDialogVisible = ref(false);
const modelFetchTarget = ref<AiModelConfig | null>(null);
const fetchedModelOptions = ref<AiProviderModelOption[]>([]);
const fetchedModelSearch = ref('');
const selectedFetchedModelIds = ref<string[]>([]);
const batchSelectedModelIds = ref<string[]>([]);
const batchTargetFamilyKey = ref('');

const filteredFetchedModelOptions = computed(() => {
  const keyword = fetchedModelSearch.value.trim().toLowerCase();
  if (!keyword) return fetchedModelOptions.value;
  return fetchedModelOptions.value.filter((model) =>
    [model.id, model.name, model.ownedBy]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)),
  );
});

const toggleModelExpand = (id: string) => {
  expandedModelId.value = expandedModelId.value === id ? null : id;
};

const dragIndex = ref<number | null>(null);
const isDraggable = ref(false);

const handleDragStart = (event: DragEvent, index: number) => {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
};

const handleDrop = (event: DragEvent, toIndex: number) => {
  event.stopPropagation();
  if (dragIndex.value !== null && dragIndex.value !== toIndex) {
    const list = [...localAiModelConfigs.value];
    const draggedItem = list[dragIndex.value];
    const targetItem = list[toIndex];
    if (draggedItem && targetItem) {
      const targetFamilyKey = inferModelFamilyKey(targetItem, {
        isPending: isPendingAiModel(targetItem.id),
      });

      if (targetFamilyKey === PENDING_MODEL_FAMILY_KEY) {
        delete draggedItem.customFamilyKey;
        delete draggedItem.customFamilyLabel;
        markAiModelPending(draggedItem.id);
      } else {
        const targetMeta = getModelFamilyMeta(targetFamilyKey, targetItem.customFamilyLabel);
        draggedItem.customFamilyKey = targetFamilyKey;
        draggedItem.customFamilyLabel = targetMeta.label;
        localPendingModelFamilyIds.value = localPendingModelFamilyIds.value.filter(
          (id) => id !== draggedItem.id,
        );
      }

      const draggedItemObject = list.splice(dragIndex.value, 1)[0];
      list.splice(toIndex, 0, draggedItemObject);
      localAiModelConfigs.value = list;
      syncAiModelsToSettings();
      ElMessage.success(t('admin.updated_model_prioritization'));
    }
  }
};

const handleDragEnd = () => {
  dragIndex.value = null;
  isDraggable.value = false;
};

const providerMeta: Record<
  string,
  { color: string; bg: string; border: string; label: string; lucideIcon: Component }
> = {
  AGNES: {
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
    label: 'Agnes',
    lucideIcon: Cpu,
  },
  DEEPSEEK: {
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.08)',
    border: 'rgba(37,99,235,0.25)',
    label: 'DeepSeek',
    lucideIcon: Cpu,
  },
  OPENAI: {
    color: '#10a37f',
    bg: 'rgba(16,163,127,0.08)',
    border: 'rgba(16,163,127,0.25)',
    label: 'OpenAI',
    lucideIcon: Sparkles,
  },
  OLLAMA: {
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)',
    border: 'rgba(124,58,237,0.25)',
    label: 'Ollama',
    lucideIcon: Database,
  },
  QWEN: {
    color: '#ea580c',
    bg: 'rgba(234,88,12,0.08)',
    border: 'rgba(234,88,12,0.25)',
    label: 'Qwen',
    lucideIcon: Globe,
  },
  GEMINI: {
    color: '#db2777',
    bg: 'rgba(219,39,119,0.08)',
    border: 'rgba(219,39,119,0.25)',
    label: 'Gemini',
    lucideIcon: Sparkles,
  },
  AZURE: {
    color: '#0284c7',
    bg: 'rgba(2,132,199,0.08)',
    border: 'rgba(2,132,199,0.25)',
    label: 'Azure',
    lucideIcon: Cloud,
  },
  CUSTOM: {
    color: '#64748b',
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.25)',
    label: 'Custom',
    lucideIcon: Settings,
  },
};

const modelFamilyMeta: Record<
  string,
  { color: string; bg: string; border: string; label: string; lucideIcon: Component }
> = {
  [PENDING_MODEL_FAMILY_KEY]: {
    color: '#64748b',
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.25)',
    label: t('admin.ai_pending_configuration'),
    lucideIcon: Sliders,
  },
  agnes: {
    color: '#0891b2',
    bg: 'rgba(8,145,178,0.08)',
    border: 'rgba(8,145,178,0.25)',
    label: 'Agnes',
    lucideIcon: Sparkles,
  },
  gemini: providerMeta.GEMINI,
  deepseek: providerMeta.DEEPSEEK,
  qwen: providerMeta.QWEN,
  openai: providerMeta.OPENAI,
  gpt: providerMeta.OPENAI,
  skywork: {
    color: '#4f46e5',
    bg: 'rgba(79,70,229,0.08)',
    border: 'rgba(79,70,229,0.25)',
    label: 'Skywork',
    lucideIcon: Cpu,
  },
  llama: {
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)',
    border: 'rgba(124,58,237,0.25)',
    label: 'Llama',
    lucideIcon: Database,
  },
  claude: {
    color: '#d97706',
    bg: 'rgba(217,119,6,0.08)',
    border: 'rgba(217,119,6,0.25)',
    label: 'Claude',
    lucideIcon: Sparkles,
  },
  mistral: {
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.08)',
    border: 'rgba(220,38,38,0.25)',
    label: 'Mistral',
    lucideIcon: Cpu,
  },
  gemma: {
    color: '#db2777',
    bg: 'rgba(219,39,119,0.08)',
    border: 'rgba(219,39,119,0.25)',
    label: 'Gemma',
    lucideIcon: Sparkles,
  },
};

const modelFamilyPalette = [
  { color: '#0f766e', bg: 'rgba(15,118,110,0.08)', border: 'rgba(15,118,110,0.25)' },
  { color: '#4338ca', bg: 'rgba(67,56,202,0.08)', border: 'rgba(67,56,202,0.25)' },
  { color: '#be123c', bg: 'rgba(190,18,60,0.08)', border: 'rgba(190,18,60,0.25)' },
  { color: '#9333ea', bg: 'rgba(147,51,234,0.08)', border: 'rgba(147,51,234,0.25)' },
  { color: '#ca8a04', bg: 'rgba(202,138,4,0.08)', border: 'rgba(202,138,4,0.25)' },
];

const getDominantProvider = (models: AiModelConfig[]) => {
  const counts = new Map<string, number>();
  models.forEach((model) => counts.set(model.provider, (counts.get(model.provider) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'CUSTOM';
};

const normalizeCustomCategories = (value: unknown): AiModelCategory[] => {
  let raw = value;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  const seenKeys = new Set<string>();
  return raw
    .map((item): AiModelCategory | null => {
      if (!item || typeof item !== 'object') return null;
      const category = item as Record<string, unknown>;
      const key = String(category.key || '').trim();
      const label = String(category.label || '').trim();
      if (!key || !label || seenKeys.has(key)) return null;
      seenKeys.add(key);
      return { key, label };
    })
    .filter((item): item is AiModelCategory => Boolean(item));
};

const customCategories = ref<AiModelCategory[]>([]);

const extractCustomCategories = () => {
  const categories: AiModelCategory[] = [];
  const seenKeys = new Set<string>();
  localAiModelConfigs.value.forEach((model) => {
    if (model.customFamilyKey && model.customFamilyLabel) {
      if (!seenKeys.has(model.customFamilyKey)) {
        seenKeys.add(model.customFamilyKey);
        categories.push({ key: model.customFamilyKey, label: model.customFamilyLabel });
      }
    }
  });
  return categories;
};

const mergeCustomCategories = (...sources: AiModelCategory[][]) => {
  const merged: AiModelCategory[] = [];
  const seenKeys = new Set<string>();
  sources.flat().forEach((category) => {
    if (seenKeys.has(category.key)) return;
    seenKeys.add(category.key);
    merged.push(category);
  });
  return merged;
};

const restoreCustomCategories = () => {
  customCategories.value = mergeCustomCategories(
    normalizeCustomCategories(localSettings.AI_MODEL_CUSTOM_CATEGORIES),
    extractCustomCategories(),
  );
  syncCustomCategoriesToSettings();
};

// Initialize categories when settings or modelConfigs load
watch(
  () => localSettings.AI_MODEL_CUSTOM_CATEGORIES,
  () => {
    restoreCustomCategories();
  },
  { immediate: true },
);

const addCustomCategory = async () => {
  try {
    const { value: categoryName } = await ElMessageBox.prompt(
      '请输入自定义分类名称',
      '创建自定义分类',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /\S+/,
        inputErrorMessage: '分类名称不能为空',
      },
    );
    if (categoryName?.trim()) {
      const key =
        'custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      customCategories.value.push({ key, label: categoryName.trim() });
      syncCustomCategoriesToSettings();
      // Expand by default when created
      collapsedModelFamilyGroups.value = collapsedModelFamilyGroups.value.filter(
        (item) => item !== key,
      );
      ElMessage.success('自定义分类创建成功，请将模型拖拽至此分类');
    }
  } catch (_e) {
    // User canceled
  }
};

const renameModelFamilyGroup = async (groupKey: string, currentLabel: string) => {
  try {
    const { value: newLabel } = await ElMessageBox.prompt('请输入新的分组名称', '重命名分组', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: currentLabel,
      inputPattern: /\S+/,
      inputErrorMessage: '分组名称不能为空',
    });
    if (newLabel?.trim()) {
      const trimmedLabel = newLabel.trim();
      const existing = customCategories.value.find((c) => c.key === groupKey);
      if (existing) {
        existing.label = trimmedLabel;
      } else {
        customCategories.value.push({ key: groupKey, label: trimmedLabel });
      }

      // Update any models currently referencing this category to sync label
      localAiModelConfigs.value.forEach((model) => {
        if (model.customFamilyKey === groupKey) {
          model.customFamilyLabel = trimmedLabel;
        }
      });

      syncAiModelsToSettings();
      ElMessage.success('分组重命名成功');
    }
  } catch (_e) {
    // User canceled
  }
};

const deleteCustomCategory = async (group: AiModelCategory) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除自定义分类 "${group.label}" 吗？该分类下的模型将自动恢复为系统分类。`,
      '删除自定义分类',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    // Remove custom classification from models in this category
    localAiModelConfigs.value.forEach((model) => {
      if (model.customFamilyKey === group.key) {
        delete model.customFamilyKey;
        delete model.customFamilyLabel;
        markAiModelPending(model.id);
      }
    });
    // Remove from customCategories list
    customCategories.value = customCategories.value.filter((c) => c.key !== group.key);
    syncAiModelsToSettings();
    ElMessage.success('自定义分类删除成功');
  } catch (_e) {
    // User canceled
  }
};

const getModelFamilyMeta = (key: string, customLabel?: string) => {
  if (modelFamilyMeta[key]) return modelFamilyMeta[key];
  const hash = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = modelFamilyPalette[hash % modelFamilyPalette.length];
  return {
    ...palette,
    label: customLabel || titleCaseModelFamily(key) || 'Custom',
    lucideIcon: Cpu,
  };
};

const disabledGroupKeys = ref<string[]>([]);
const isUnenabledGroupCollapsed = ref(true);

const restoreDisabledGroups = () => {
  const stored = localStorage.getItem('ai_model_disabled_groups');
  if (stored) {
    try {
      disabledGroupKeys.value = JSON.parse(stored);
    } catch {
      disabledGroupKeys.value = [];
    }
  }
};

const toggleGroupEnabled = (key: string, enabled: boolean) => {
  if (enabled) {
    disabledGroupKeys.value = disabledGroupKeys.value.filter((k) => k !== key);
    const group = modelFamilyGroups.value.find((g) => g.key === key);
    if (group) {
      group.models.forEach((model) => {
        model.enabled = true;
      });
    }
  } else {
    if (!disabledGroupKeys.value.includes(key)) {
      disabledGroupKeys.value.push(key);
    }
    const group = modelFamilyGroups.value.find((g) => g.key === key);
    if (group) {
      group.models.forEach((model) => {
        model.enabled = false;
      });
    }
  }
  syncAiModelsToSettings();
};

watch(
  disabledGroupKeys,
  (newKeys) => {
    localStorage.setItem('ai_model_disabled_groups', JSON.stringify(newKeys));
  },
  { deep: true },
);

const collapsedModelFamilyGroups = ref<string[]>([]);

const modelFamilyGroups = computed<ModelFamilyGroup[]>(() => {
  const groups = new Map<string, AiModelConfig[]>();

  // Ensure any empty custom categories are included
  customCategories.value.forEach((cat) => {
    groups.set(cat.key, []);
  });

  localAiModelConfigs.value.forEach((model) => {
    const familyKey = inferModelFamilyKey(model, { isPending: isPendingAiModel(model.id) });
    if (!groups.has(familyKey)) groups.set(familyKey, []);
    groups.get(familyKey)!.push(model);
  });

  return Array.from(groups.entries())
    .map(([key, models]) => {
      const endpoints = Array.from(new Set(models.map((model) => model.endpoint).filter(Boolean)));
      const enabledCount = models.filter((model) => model.enabled).length;
      const defaultModel = models.find((model) => model.isDefault);
      const provider = models.length > 0 ? getDominantProvider(models) : 'CUSTOM';
      const providers = Array.from(
        new Set(models.map((model) => getProviderMeta(model.provider).label)),
      );

      const customCat = customCategories.value.find((c) => c.key === key);
      const meta = getModelFamilyMeta(key, customCat?.label);

      return {
        key,
        label: meta.label,
        provider,
        providerLabel: providers.length > 0 ? providers.join(' / ') : 'Custom',
        models,
        enabledCount,
        defaultModel,
        meta,
        endpointLabel:
          endpoints.length === 0
            ? t('admin.ai_endpoint_not_configured')
            : endpoints.length === 1
              ? endpoints[0]
              : t('admin.ai_endpoint_count', { count: endpoints.length }),
      };
    })
    .sort((a, b) => {
      if (a.key === PENDING_MODEL_FAMILY_KEY) return -1;
      if (b.key === PENDING_MODEL_FAMILY_KEY) return 1;
      return a.label.localeCompare(b.label);
    });
});

const enabledModelFamilyGroups = computed(() => {
  return modelFamilyGroups.value.filter((group) => !disabledGroupKeys.value.includes(group.key));
});

const disabledModelFamilyGroups = computed(() => {
  return modelFamilyGroups.value.filter((group) => disabledGroupKeys.value.includes(group.key));
});

const isModelFamilyGroupCollapsed = (key: string) => collapsedModelFamilyGroups.value.includes(key);

const toggleModelFamilyGroup = (key: string) => {
  if (isModelFamilyGroupCollapsed(key)) {
    collapsedModelFamilyGroups.value = collapsedModelFamilyGroups.value.filter(
      (item) => item !== key,
    );
  } else {
    collapsedModelFamilyGroups.value.push(key);
  }
};

const selectedAiModels = computed(() => {
  const selectedIds = new Set(batchSelectedModelIds.value);
  return localAiModelConfigs.value.filter((model) => selectedIds.has(model.id));
});

const selectableBatchFamilies = computed(() =>
  modelFamilyGroups.value.map((group) => ({
    key: group.key,
    label: group.label,
    count: group.models.length,
  })),
);

const isAllAiModelsSelected = computed(
  () =>
    localAiModelConfigs.value.length > 0 &&
    batchSelectedModelIds.value.length === localAiModelConfigs.value.length,
);

const getGroupSelectedCount = (group: ModelFamilyGroup) =>
  group.models.filter((model) => batchSelectedModelIds.value.includes(model.id)).length;

const selectAllAiModels = () => {
  batchSelectedModelIds.value = localAiModelConfigs.value.map((model) => model.id);
};

const clearSelectedAiModels = () => {
  batchSelectedModelIds.value = [];
};

const toggleGroupModelSelection = (group: ModelFamilyGroup) => {
  const selected = new Set(batchSelectedModelIds.value);
  const groupIds = group.models.map((model) => model.id);
  const allSelected = groupIds.length > 0 && groupIds.every((id) => selected.has(id));

  if (allSelected) {
    groupIds.forEach((id) => selected.delete(id));
  } else {
    groupIds.forEach((id) => selected.add(id));
  }
  batchSelectedModelIds.value = Array.from(selected);
};

const isAiModelSelected = (id: string) => batchSelectedModelIds.value.includes(id);

const toggleAiModelSelection = (id: string, checked: unknown) => {
  const selected = new Set(batchSelectedModelIds.value);
  if (checked === true) {
    selected.add(id);
  } else {
    selected.delete(id);
  }
  batchSelectedModelIds.value = Array.from(selected);
};

const normalizeDefaultModelAfterBatch = () => {
  const enabledModels = localAiModelConfigs.value.filter((model) => model.enabled);
  if (enabledModels.length === 0) {
    localAiModelConfigs.value.forEach((model) => {
      model.isDefault = false;
    });
    return;
  }

  const currentDefault = enabledModels.find((model) => model.isDefault);
  localAiModelConfigs.value.forEach((model) => {
    model.isDefault = currentDefault
      ? model.id === currentDefault.id
      : model.id === enabledModels[0].id;
  });
};

const batchSetAiModelsEnabled = (enabled: boolean) => {
  if (selectedAiModels.value.length === 0) {
    return ElMessage.warning('请先选择模型');
  }

  if (!enabled) {
    const enabledIds = localAiModelConfigs.value
      .filter((model) => model.enabled)
      .map((model) => model.id);
    const selectedIds = new Set(batchSelectedModelIds.value);
    if (enabledIds.length > 0 && enabledIds.every((id) => selectedIds.has(id))) {
      return ElMessage.warning('至少保留一个启用模型');
    }
  }

  selectedAiModels.value.forEach((model) => {
    model.enabled = enabled;
  });
  normalizeDefaultModelAfterBatch();
  syncAiModelsToSettings();
  ElMessage.success(enabled ? '已批量启用模型' : '已批量停用模型');
};

const batchMoveAiModelsToFamily = () => {
  if (selectedAiModels.value.length === 0) {
    return ElMessage.warning('请先选择模型');
  }
  if (!batchTargetFamilyKey.value) {
    return ElMessage.warning('请选择目标分类');
  }

  const targetGroup = modelFamilyGroups.value.find(
    (group) => group.key === batchTargetFamilyKey.value,
  );
  const targetLabel =
    targetGroup?.label || getModelFamilyMeta(batchTargetFamilyKey.value).label || 'Custom';

  selectedAiModels.value.forEach((model) => {
    if (batchTargetFamilyKey.value === PENDING_MODEL_FAMILY_KEY) {
      delete model.customFamilyKey;
      delete model.customFamilyLabel;
      markAiModelPending(model.id);
    } else {
      model.customFamilyKey = batchTargetFamilyKey.value;
      model.customFamilyLabel = targetLabel;
      localPendingModelFamilyIds.value = localPendingModelFamilyIds.value.filter(
        (id) => id !== model.id,
      );
    }
  });

  collapsedModelFamilyGroups.value = collapsedModelFamilyGroups.value.filter(
    (key) => key !== batchTargetFamilyKey.value,
  );
  syncAiModelsToSettings();
  ElMessage.success(`已将 ${selectedAiModels.value.length} 个模型移动到 ${targetLabel}`);
};

const handleBatchMoveSelect = (val: string) => {
  if (!val) return;
  batchTargetFamilyKey.value = val;
  batchMoveAiModelsToFamily();
  batchTargetFamilyKey.value = '';
};

const batchDeleteAiModels = async () => {
  if (selectedAiModels.value.length === 0) {
    return ElMessage.warning('请先选择模型');
  }
  if (selectedAiModels.value.length >= localAiModelConfigs.value.length) {
    return ElMessage.warning(t('admin.keep_at_least_one'));
  }

  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedAiModels.value.length} 个模型吗？`,
      '批量删除模型',
      {
        confirmButtonText: t('admin.delete'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
      },
    );

    const selectedIds = new Set(batchSelectedModelIds.value);
    localAiModelConfigs.value = localAiModelConfigs.value.filter(
      (model) => !selectedIds.has(model.id),
    );
    localPendingModelFamilyIds.value = localPendingModelFamilyIds.value.filter(
      (id) => !selectedIds.has(id),
    );
    batchSelectedModelIds.value = [];
    normalizeDefaultModelAfterBatch();
    syncAiModelsToSettings();
    ElMessage.success('已批量删除模型');
  } catch (_error) {
    // User canceled
  }
};

watch(
  () => localAiModelConfigs.value.map((model) => model.id).join('|'),
  () => {
    const validIds = new Set(localAiModelConfigs.value.map((model) => model.id));
    batchSelectedModelIds.value = batchSelectedModelIds.value.filter((id) => validIds.has(id));
  },
);

const addAiModelToFamily = (group: ModelFamilyGroup) => {
  const source = group.models[0];
  const model = createAiModelConfig(group.provider);
  if (source) {
    model.provider = source.provider;
    model.endpoint = source.endpoint;
    model.apiKey = source.apiKey;
    model.capabilities = [...source.capabilities];
    model.temperature = source.temperature;
    model.maxTokens = source.maxTokens;
    model.systemPrompt = source.systemPrompt;
  }
  model.name = `${group.label} Model`;
  model.modelName = '';

  const customCat = customCategories.value.find((c) => c.key === group.key);
  if (customCat) {
    model.customFamilyKey = customCat.key;
    model.customFamilyLabel = customCat.label;
  }

  localAiModelConfigs.value.push(model);
  markAiModelPending(model.id);
  expandedModelId.value = model.id;
  collapsedModelFamilyGroups.value = collapsedModelFamilyGroups.value.filter(
    (k) => k !== group.key,
  );
  syncAiModelsToSettings();
};

const handleDropOnGroup = (_event: DragEvent, group: ModelFamilyGroup) => {
  if (dragIndex.value !== null) {
    const list = [...localAiModelConfigs.value];
    const draggedItem = list[dragIndex.value];
    if (draggedItem) {
      if (group.key === PENDING_MODEL_FAMILY_KEY) {
        delete draggedItem.customFamilyKey;
        delete draggedItem.customFamilyLabel;
        markAiModelPending(draggedItem.id);
      } else {
        draggedItem.customFamilyKey = group.key;
        draggedItem.customFamilyLabel = group.label;
        localPendingModelFamilyIds.value = localPendingModelFamilyIds.value.filter(
          (id) => id !== draggedItem.id,
        );
      }

      // Re-position the model in the flat list near the end of that group's models
      const groupModels = group.models.filter((m) => m.id !== draggedItem.id);
      let targetIndex = list.length;
      if (groupModels.length > 0) {
        const lastGroupModel = groupModels[groupModels.length - 1];
        const lastIndex = list.findIndex((item) => item.id === lastGroupModel.id);
        if (lastIndex !== -1) {
          targetIndex = lastIndex + 1;
        }
      }

      const draggedItemObject = list.splice(dragIndex.value, 1)[0];
      let insertIndex = targetIndex;
      if (dragIndex.value < targetIndex) {
        insertIndex = targetIndex - 1;
      }
      list.splice(insertIndex, 0, draggedItemObject);

      localAiModelConfigs.value = list;
      syncAiModelsToSettings();
      ElMessage.success(`已将模型分类更新为: ${group.label}`);
    }
  }
};

const testAi = async (model?: AiModelConfig) => {
  const provider = model?.provider || localSettings.AI_PROVIDER;
  const apiKey = model?.apiKey || localSettings.AI_API_KEY;
  const endpoint = model?.endpoint || localSettings.AI_API_ENDPOINT;
  const modelName = model?.modelName || localSettings.AI_MODEL_NAME;

  if (!provider) {
    return ElMessage.warning(t('admin.please_select_an_ai'));
  }
  if (!apiKey && provider !== 'OLLAMA') {
    return ElMessage.warning(t('admin.please_enter_api_key'));
  }
  if (!modelName) {
    return ElMessage.warning(t('admin.please_enter_model_name'));
  }

  try {
    isTestingAi.value = true;
    testingAiModelId.value = model?.id || '__legacy__';
    const { data } = await api.post('/api/admin/settings/test-ai', {
      provider,
      endpoint,
      apiKey,
      modelName,
      capabilities: model?.capabilities,
    });
    if (data.success) {
      ElMessage.success(data.message || t('admin.ai_interface_test_successful'));
    } else {
      ElMessage.error(t('admin.the_test_failed_and'));
    }
  } catch (error: unknown) {
    console.error('Test AI error:', error);
    ElMessage.error(getApiErrorMessage(error, t('admin.ai_connection_test_failed')));
  } finally {
    isTestingAi.value = false;
    testingAiModelId.value = '';
  }
};

const fetchAiModels = async (model: AiModelConfig) => {
  const provider = model.provider;
  const apiKey = model.apiKey || localSettings.AI_API_KEY;
  const endpoint = model.endpoint || localSettings.AI_API_ENDPOINT;

  if (!provider) {
    return ElMessage.warning(t('admin.please_select_an_ai'));
  }
  if (!endpoint) {
    return ElMessage.warning('请先填写 API Endpoint');
  }
  if (!apiKey && provider !== 'OLLAMA') {
    return ElMessage.warning(t('admin.please_enter_api_key'));
  }

  try {
    isFetchingAiModels.value = true;
    fetchingAiModelsModelId.value = model.id;
    const { data } = await api.post('/api/admin/settings/ai-models', {
      provider,
      endpoint,
      apiKey,
    });

    const models: AiProviderModelOption[] = Array.isArray(data.models) ? data.models : [];
    if (models.length === 0) {
      return ElMessage.warning('未获取到可用模型');
    }

    fetchedModelOptions.value = models;
    fetchedModelSearch.value = '';
    modelFetchTarget.value = model;
    const availableIds = new Set(models.map((item) => item.id));
    selectedFetchedModelIds.value = parseModelNameLines(model.modelName).filter((id) =>
      availableIds.has(id),
    );
    modelFetchDialogVisible.value = true;
  } catch (error: unknown) {
    console.error('Fetch AI models error:', error);
    ElMessage.error(getApiErrorMessage(error, '获取模型列表失败'));
  } finally {
    isFetchingAiModels.value = false;
    fetchingAiModelsModelId.value = '';
  }
};

const applyFetchedModels = () => {
  const target = modelFetchTarget.value;
  if (!target) return;
  if (selectedFetchedModelIds.value.length === 0) {
    return ElMessage.warning('请选择至少一个模型');
  }

  target.modelName = selectedFetchedModelIds.value.join('\n');
  if (!isPendingAiModel(target.id)) {
    expandModelNameLines(target);
  } else {
    syncAiModelsToSettings();
  }
  expandedModelId.value = target.id;
  modelFetchDialogVisible.value = false;
  ElMessage.success(`已选择 ${selectedFetchedModelIds.value.length} 个模型`);
};

const importAiFileInputRef = ref<HTMLInputElement | null>(null);

const triggerAiImport = () => {
  if (importAiFileInputRef.value) {
    importAiFileInputRef.value.click();
  }
};

const importAiSettingsFile = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.AI_MODEL_OPTIONS) {
      const importedConfigs = JSON.parse(data.AI_MODEL_OPTIONS);
      if (Array.isArray(importedConfigs)) {
        localAiModelConfigs.value = importedConfigs;
        syncAiModelsToSettings();
        ElMessage.success('成功从文件导入 AI 模型配置');
      }
    }
  } catch (error) {
    console.error('Import AI settings error:', error);
    ElMessage.error('导入失败，请确保文件是有效的 JSON 格式');
  } finally {
    target.value = '';
  }
};

const exportAiSettings = () => {
  try {
    const data = {
      AI_IMPORT_ENABLED: localSettings.AI_IMPORT_ENABLED,
      AI_PROVIDER: localSettings.AI_PROVIDER,
      AI_API_ENDPOINT: localSettings.AI_API_ENDPOINT,
      AI_MODEL_NAME: localSettings.AI_MODEL_NAME,
      AI_MODEL_OPTIONS: localSettings.AI_MODEL_OPTIONS,
      AI_MODEL_CUSTOM_CATEGORIES: localSettings.AI_MODEL_CUSTOM_CATEGORIES,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-settings-export-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出配置成功');
  } catch (error) {
    console.error('Export AI settings error:', error);
    ElMessage.error('导出配置失败');
  }
};

onMounted(() => {
  restoreDisabledGroups();
  restoreCustomCategories();
});
</script>

<template>
  <div class="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- Header Card -->
    <div
      class="relative overflow-hidden rounded-3xl border p-6"
      style="
        background: linear-gradient(135deg, var(--bg-card) 0%, rgba(99, 102, 241, 0.04) 100%);
        border-color: var(--border-base);
      "
    >
      <div class="relative flex items-start justify-between gap-4">
        <div class="flex items-start gap-4">
          <div
            class="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style="
              background: linear-gradient(135deg, #6366f1, #8b5cf6);
              box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
            "
          >
            <Cpu class="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 class="text-base font-black mb-1" style="color: var(--text-primary)">
              {{ $t('admin.ai_intelligent_assistance_system') }}
            </h2>
            <p class="text-xs leading-relaxed max-w-lg" style="color: var(--text-secondary)">
              启用后，用户可以使用 AI 一键生成项目、AI 写作助手等智能功能。API Key
              仅保存在服务端，不会暴露给前台用户。
            </p>
          </div>
        </div>
        <div class="flex-shrink-0">
          <div class="flex flex-col items-center gap-1.5">
            <el-switch
              v-model="localSettings.AI_IMPORT_ENABLED"
              inline-prompt
              :active-text="$t('admin.opened')"
              :inactive-text="$t('admin.closed')"
              style="--el-switch-on-color: #6366f1; --el-switch-off-color: #94a3b8"
            />
            <span
              class="text-[10px] font-bold px-2 py-0.5 rounded-full"
              :style="
                localSettings.AI_IMPORT_ENABLED
                  ? 'background: rgba(99,102,241,0.12); color: #6366f1;'
                  : 'background: var(--bg-app); color: var(--text-muted);'
              "
              >{{
                localSettings.AI_IMPORT_ENABLED
                  ? $t('admin.function_activated')
                  : $t('admin.feature_not_enabled')
              }}</span
            >
          </div>
        </div>
      </div>

      <div
        v-if="localSettings.AI_IMPORT_ENABLED"
        class="mt-4 pt-4 border-t flex flex-wrap gap-2"
        style="border-color: var(--border-base)"
      >
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
          style="background: rgba(99, 102, 241, 0.1); color: #6366f1"
          >{{ $t('admin.one_click_generation_of') }}</span
        >
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
          style="background: rgba(99, 102, 241, 0.1); color: #6366f1"
          >{{ $t('admin.ai_writing_assistant') }}</span
        >
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
          style="background: rgba(99, 102, 241, 0.1); color: #6366f1"
          >{{ $t('admin.model_thinking_flow_display') }}</span
        >
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
          style="background: rgba(99, 102, 241, 0.1); color: #6366f1"
          >{{ $t('admin.real_time_streaming_output') }}</span
        >
      </div>
    </div>

    <!-- Models Panel -->
    <div v-if="localSettings.AI_IMPORT_ENABLED" class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="text-sm font-black" style="color: var(--text-primary)">
            {{ $t('admin.model_pool_configuration') }}
          </h3>
          <p class="text-[11px] mt-0.5" style="color: var(--text-muted)">
            {{
              $t('admin.ai_models_status_count', {
                total: localAiModelConfigs.length,
                enabled: localAiModelConfigs.filter((m) => m.enabled).length,
              })
            }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <input
            ref="importAiFileInputRef"
            type="file"
            accept=".json"
            class="hidden"
            @change="importAiSettingsFile"
          />
          <button
            type="button"
            class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer shrink-0"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            title="一键导出所有 AI 相关配置"
            @click="exportAiSettings"
          >
            <Download class="w-3.5 h-3.5" />
            <span>导出AI配置</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer shrink-0"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            title="一键从文件导入 AI 配置"
            @click="triggerAiImport"
          >
            <Upload class="w-3.5 h-3.5" />
            <span>导入AI配置</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer shrink-0"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="addCustomCategory()"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>新建自定义分类</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shrink-0"
            style="
              background: linear-gradient(135deg, #6366f1, #8b5cf6);
              color: white;
              box-shadow: 0 2px 12px rgba(99, 102, 241, 0.35);
            "
            @click="addAiModel()"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>{{ $t('admin.add_model') }}</span>
          </button>
        </div>
      </div>

      <!-- Batch Action Bar (Single-line, shown only when models are selected) -->
      <transition name="el-zoom-in-top">
        <div
          v-if="selectedAiModels.length > 0"
          class="flex items-center justify-between p-2.5 rounded-xl border text-xs gap-3"
          style="border-color: rgba(99, 102, 241, 0.25); background: rgba(99, 102, 241, 0.04)"
        >
          <!-- Left Side: Selection Count & Master Select All Checkbox -->
          <div class="flex items-center gap-3">
            <el-checkbox
              :model-value="isAllAiModelsSelected"
              :indeterminate="selectedAiModels.length > 0 && !isAllAiModelsSelected"
              class="shrink-0"
              @change="
                (val: unknown) => {
                  if (val) {
                    selectAllAiModels();
                  } else {
                    clearSelectedAiModels();
                  }
                }
              "
            />
            <span class="font-bold shrink-0" style="color: var(--text-primary)">
              已选择 <span style="color: #6366f1">{{ selectedAiModels.length }}</span> /
              {{ localAiModelConfigs.length }} 个模型
            </span>
          </div>

          <!-- Right Side: Action Buttons -->
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer shrink-0"
              style="border-color: var(--border-base); color: var(--text-secondary)"
              @click="clearSelectedAiModels()"
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
              @click="batchSetAiModelsEnabled(true)"
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
              @click="batchSetAiModelsEnabled(false)"
            >
              禁用
            </button>
            <el-select
              :model-value="batchTargetFamilyKey"
              size="small"
              placeholder="移动到分类..."
              class="w-36 shrink-0"
              @change="handleBatchMoveSelect"
            >
              <el-option
                v-for="family in selectableBatchFamilies"
                :key="family.key"
                :label="`${family.label} (${family.count})`"
                :value="family.key"
              />
            </el-select>
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 cursor-pointer shrink-0"
              style="
                border-color: rgba(244, 63, 94, 0.25);
                color: #e11d48;
                background: rgba(244, 63, 94, 0.05);
              "
              @click="batchDeleteAiModels"
            >
              删除
            </button>
          </div>
        </div>
      </transition>

      <!-- Model Family Groups -->
      <div v-if="enabledModelFamilyGroups.length > 0" class="space-y-4">
        <section
          v-for="group in enabledModelFamilyGroups"
          :key="group.key"
          class="rounded-2xl border overflow-hidden"
          :style="`border-color: ${group.meta.border}; background: var(--bg-card);`"
          @dragover.prevent
          @drop="handleDropOnGroup($event, group)"
        >
          <header
            class="px-4 py-4 border-b"
            style="border-color: var(--border-base); background: var(--bg-app)"
          >
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div
                class="flex items-start gap-3 min-w-0 cursor-pointer select-none"
                @click="toggleModelFamilyGroup(group.key)"
              >
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
                        @click.stop="renameModelFamilyGroup(group.key, group.label)"
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
                  @click.stop="toggleGroupModelSelection(group)"
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
                  @click="addAiModelToFamily(group)"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>{{ $t('admin.ai_add_family_model', { family: group.label }) }}</span>
                </button>
                <el-switch
                  :model-value="!disabledGroupKeys.includes(group.key)"
                  inline-prompt
                  active-text="启用"
                  inactive-text="禁用"
                  style="--el-switch-on-color: #10b981; --el-switch-off-color: #94a3b8"
                  class="mr-2"
                  @change="
                    (val: boolean | string | number) => toggleGroupEnabled(group.key, Boolean(val))
                  "
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
                    isModelFamilyGroupCollapsed(group.key)
                      ? $t('admin.expand_group')
                      : $t('admin.collapse_group')
                  "
                  @click="toggleModelFamilyGroup(group.key)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    class="w-4 h-4 transition-transform"
                    :class="isModelFamilyGroupCollapsed(group.key) ? '-rotate-90' : ''"
                  >
                    <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          <div v-show="!isModelFamilyGroupCollapsed(group.key)" class="space-y-2 p-3">
            <div
              v-if="group.models.length === 0"
              class="text-center py-8 border border-dashed rounded-xl text-xs text-slate-400 select-none"
              style="border-color: var(--border-base)"
            >
              拖拽模型到此处以分类
            </div>
            <div
              v-for="model in group.models"
              :key="model.id"
              :draggable="isDraggable"
              class="group rounded-xl border overflow-hidden transition-all duration-300 hover:shadow-sm hover:border-slate-300 dark:hover:border-zinc-700"
              :class="{
                'opacity-50 border-indigo-400 scale-[0.99]':
                  dragIndex === localAiModelConfigs.findIndex((item) => item.id === model.id),
              }"
              :style="
                isAiModelSelected(model.id)
                  ? 'border-color: rgba(99, 102, 241, 0.5); background-color: rgba(99, 102, 241, 0.03);'
                  : model.isDefault
                    ? 'border-color: rgba(99, 102, 241, 0.4); background-color: var(--bg-card);'
                    : 'border-color: var(--border-base); background-color: var(--bg-card);'
              "
              @dragstart="
                handleDragStart(
                  $event,
                  localAiModelConfigs.findIndex((item) => item.id === model.id),
                )
              "
              @dragover.prevent
              @drop="
                handleDrop(
                  $event,
                  localAiModelConfigs.findIndex((item) => item.id === model.id),
                )
              "
              @dragend="handleDragEnd"
            >
              <!-- Card Header -->
              <div
                class="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors duration-200"
                :style="expandedModelId === model.id ? 'background: var(--bg-app);' : ''"
                @click="toggleModelExpand(model.id)"
              >
                <!-- Drag handle -->
                <div
                  class="flex items-center justify-center p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors duration-150 cursor-grab active:cursor-grabbing flex-shrink-0"
                  :title="$t('admin.drag_and_drop_to')"
                  @mouseenter="isDraggable = true"
                  @mouseleave="isDraggable = false"
                  @click.stop
                >
                  <GripVertical class="w-3.5 h-3.5 text-slate-400" />
                </div>

                <el-checkbox
                  :model-value="isAiModelSelected(model.id)"
                  class="shrink-0 transition-opacity duration-200"
                  :class="
                    isAiModelSelected(model.id) || selectedAiModels.length > 0
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  "
                  @change="toggleAiModelSelection(model.id, $event)"
                  @click.stop
                />

                <span
                  class="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 font-bold"
                  :style="`background: ${group.meta.bg}; color: ${group.meta.color};`"
                >
                  <component :is="getProviderMeta(model.provider).lucideIcon" class="w-3.5 h-3.5" />
                </span>

                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-bold truncate" style="color: var(--text-primary)">{{
                      model.name || model.modelName
                    }}</span>
                    <span
                      v-if="model.isDefault"
                      class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold"
                      >{{ $t('admin.default_model') }}</span
                    >
                    <span
                      v-if="isPendingAiModel(model.id)"
                      class="px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500 text-[9px] font-bold"
                      >{{ $t('admin.not_classified') }}</span
                    >
                    <!-- Key count badge — visible when backup keys are configured -->
                    <span
                      v-if="(model.apiKeys || []).filter(Boolean).length > 0"
                      class="px-1.5 py-0.5 rounded text-[9px] font-bold"
                      style="background: rgba(16,185,129,0.1); color: #059669"
                      :title="`共 ${1 + (model.apiKeys || []).filter(Boolean).length} 个密钥，主密钥失效时自动轮换`"
                    >{{ 1 + (model.apiKeys || []).filter(Boolean).length }} 个密钥</span>
                    <!-- Failover disabled indicator -->
                    <span
                      v-if="model.failoverEnabled === false"
                      class="px-1.5 py-0.5 rounded text-[9px] font-bold"
                      style="background: rgba(100,116,139,0.1); color: #64748b"
                      title="此模型不参与自动故障转移"
                    >故障转移已关闭</span>
                  </div>
                  <div
                    class="flex items-center gap-3 mt-1 text-[9px]"
                    style="color: var(--text-muted)"
                  >
                    <span class="font-mono truncate max-w-[200px]">{{ model.modelName }}</span>
                    <span>{{ getProviderMeta(model.provider).label }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0" @click.stop>
                  <el-switch
                    v-model="model.enabled"
                    size="small"
                    style="--el-switch-on-color: #10b981; --el-switch-off-color: #e2e8f0"
                    @change="syncAiModelsToSettings"
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
                        <el-dropdown-item
                          :disabled="!model.enabled"
                          @click="
                            () => {
                              localAiModelConfigs.forEach((m) => (m.isDefault = false));
                              model.isDefault = true;
                              syncAiModelsToSettings();
                            }
                          "
                        >
                          设为默认模型
                        </el-dropdown-item>
                        <el-dropdown-item @click="cloneAiModel(model)"> 复制模型 </el-dropdown-item>
                        <el-dropdown-item
                          v-if="isPendingAiModel(model.id)"
                          @click="confirmAiModelFamily(model)"
                        >
                          确认分类
                        </el-dropdown-item>
                        <el-dropdown-item
                          class="!text-rose-500 hover:!bg-rose-50 dark:hover:!bg-rose-950/20"
                          @click="removeAiModel(model.id)"
                        >
                          删除模型
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>

              <!-- Card Expanded Details -->
              <div
                v-if="expandedModelId === model.id"
                class="px-5 py-4 border-t space-y-4"
                style="border-color: var(--border-base); background: var(--bg-card-expanded)"
                @click.stop
              >
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="text-[10px] font-bold text-slate-400">模型自定义名称</label>
                    <input
                      v-model="model.name"
                      type="text"
                      class="w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                      @change="syncAiModelsToSettings"
                    />
                  </div>

                  <div class="space-y-1.5">
                    <label class="text-[10px] font-bold text-slate-400">服务商/模型池</label>
                    <el-select
                      v-model="model.provider"
                      size="default"
                      class="w-full"
                      @change="
                        () => {
                          const defaults = aiProviderDefaults[model.provider];
                          if (defaults) {
                            model.endpoint = defaults.endpoint;
                            if (defaults.model) model.modelName = defaults.model;
                          }
                          syncAiModelsToSettings();
                        }
                      "
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
                      <label class="text-[10px] font-bold text-slate-400"
                        >API Endpoint (请求端点)</label
                      >
                      <button
                        v-if="model.provider === 'OLLAMA'"
                        type="button"
                        class="text-[9px] text-[#6366f1] hover:underline bg-transparent border-none cursor-pointer"
                        @click="model.endpoint = 'http://localhost:11434/v1'"
                      >
                        使用 Ollama /v1 兼容格式
                      </button>
                    </div>
                    <input
                      v-model="model.endpoint"
                      type="text"
                      class="w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none transition-colors"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                      @change="syncAiModelsToSettings"
                    />
                  </div>

                  <div class="space-y-1.5 md:col-span-2">
                    <div class="flex items-center justify-between">
                      <label class="text-[10px] font-bold text-slate-400 flex items-center gap-1.5"
                        >API Key (主密钥)</label
                      >
                      <span
                        v-if="(model.apiKeys || []).filter(Boolean).length > 0"
                        class="px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style="background: rgba(16,185,129,0.1); color: #059669"
                        >+{{ (model.apiKeys || []).filter(Boolean).length }} 个备用密钥</span
                      >
                    </div>
                    <input
                      v-model="model.apiKey"
                      type="password"
                      class="w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none transition-colors"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                      placeholder="主 API Key（必填）"
                      @change="syncAiModelsToSettings"
                    />

                    <!-- Backup Keys -->
                    <div class="mt-2 space-y-1.5">
                      <label class="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        备用密钥（自动故障转移轮换，主密钥失效时依次尝试）
                      </label>
                      <div
                        v-for="(_, keyIdx) in (model.apiKeys || [])"
                        :key="keyIdx"
                        class="flex items-center gap-2"
                      >
                        <input
                          :value="(model.apiKeys || [])[keyIdx]"
                          type="password"
                          class="flex-1 px-3 py-1.5 rounded-lg border text-xs font-mono outline-none transition-colors"
                          style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);"
                          :placeholder="`备用密钥 ${keyIdx + 1}`"
                          @input="(e: Event) => { if (!model.apiKeys) model.apiKeys = []; model.apiKeys[keyIdx] = (e.target as HTMLInputElement).value; syncAiModelsToSettings(); }"
                        />
                        <button
                          type="button"
                          class="w-6 h-6 rounded flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex-shrink-0"
                          title="删除此备用密钥"
                          @click="() => { model.apiKeys = (model.apiKeys || []).filter((_, i) => i !== keyIdx); syncAiModelsToSettings(); }"
                        >
                          <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                      <button
                        type="button"
                        class="flex items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer bg-transparent border-none"
                        style="color: #6366f1"
                        @click="() => { if (!model.apiKeys) model.apiKeys = []; model.apiKeys.push(''); syncAiModelsToSettings(); }"
                      >
                        <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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
                        :disabled="isFetchingAiModels"
                        class="flex items-center gap-1 text-[9px] text-[#6366f1] hover:underline disabled:opacity-50 bg-transparent border-none cursor-pointer"
                        @click="fetchAiModels(model)"
                      >
                        <RefreshCw
                          class="w-2.5 h-2.5"
                          :class="
                            isFetchingAiModels && fetchingAiModelsModelId === model.id
                              ? 'animate-spin'
                              : ''
                          "
                        />
                        <span>在线拉取模型列表</span>
                      </button>
                    </div>
                    <textarea
                      v-model="model.modelName"
                      rows="2"
                      class="w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none transition-colors resize-none"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                      placeholder="gpt-4o-mini"
                      @blur="
                        () => {
                          if (!isPendingAiModel(model.id)) {
                            expandModelNameLines(model);
                          } else {
                            syncAiModelsToSettings();
                          }
                        }
                      "
                    ></textarea>
                  </div>
                </div>

                <!-- Advanced Options -->
                <div class="border-t pt-3" style="border-color: var(--border-base)">
                  <button
                    type="button"
                    class="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer"
                    @click="model.showAdvanced = !model.showAdvanced"
                  >
                    <span>高级配置参数</span>
                    <svg
                      viewBox="0 0 24 24"
                      class="w-3 h-3 transition-transform"
                      :class="model.showAdvanced ? 'rotate-180' : ''"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                    >
                      <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>

                  <div
                    v-if="model.showAdvanced"
                    class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 animate-in fade-in duration-200"
                  >
                    <div class="space-y-1.5">
                      <label class="text-[10px] font-bold text-slate-400"
                        >能力支持 (Capabilities)</label
                      >
                      <div class="flex items-center gap-3 mt-1">
                        <el-checkbox
                          :model-value="model.capabilities.includes('chat')"
                          label="对话 (Chat)"
                          @change="
                            (checked: unknown) => {
                              if (checked) {
                                if (!model.capabilities.includes('chat'))
                                  model.capabilities.push('chat');
                              } else {
                                model.capabilities = model.capabilities.filter((c) => c !== 'chat');
                              }
                              syncAiModelsToSettings();
                            }
                          "
                        />
                        <el-checkbox
                          :model-value="model.capabilities.includes('image')"
                          label="画图 (Image)"
                          @change="
                            (checked: unknown) => {
                              if (checked) {
                                if (!model.capabilities.includes('image'))
                                  model.capabilities.push('image');
                              } else {
                                model.capabilities = model.capabilities.filter(
                                  (c) => c !== 'image',
                                );
                              }
                              syncAiModelsToSettings();
                            }
                          "
                        />
                        <el-checkbox
                          :model-value="model.capabilities.includes('video')"
                          label="视频 (Video)"
                          @change="
                            (checked: unknown) => {
                              if (checked) {
                                if (!model.capabilities.includes('video'))
                                  model.capabilities.push('video');
                              } else {
                                model.capabilities = model.capabilities.filter(
                                  (c) => c !== 'video',
                                );
                              }
                              syncAiModelsToSettings();
                            }
                          "
                        />
                      </div>
                    </div>

                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between">
                        <label class="text-[10px] font-bold text-slate-400"
                          >Temperature: {{ model.temperature }}</label
                        >
                      </div>
                      <el-slider
                        v-model="model.temperature"
                        :min="0"
                        :max="2"
                        :step="0.1"
                        class="w-full"
                        @change="syncAiModelsToSettings"
                      />
                    </div>

                    <div class="space-y-1.5">
                      <label class="text-[10px] font-bold text-slate-400"
                        >最大回复 Tokens (Max Tokens)</label
                      >
                      <input
                        v-model.number="model.maxTokens"
                        type="number"
                        min="1"
                        max="32768"
                        class="w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors"
                        style="
                          background-color: var(--bg-app);
                          border-color: var(--border-base);
                          color: var(--text-primary);
                        "
                        @change="syncAiModelsToSettings"
                      />
                    </div>

                    <div class="space-y-1.5 md:col-span-2">
                      <label class="text-[10px] font-bold text-slate-400"
                        >系统引导词提示 (System Prompt)</label
                      >
                      <textarea
                        v-model="model.systemPrompt"
                        rows="3"
                        class="w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors resize-none"
                        style="
                          background-color: var(--bg-app);
                          border-color: var(--border-base);
                          color: var(--text-primary);
                        "
                        placeholder="引导AI的系统 Prompt 提示词"
                        @change="syncAiModelsToSettings"
                      ></textarea>
                    </div>

                    <!-- Failover Settings -->
                    <div class="md:col-span-2 flex items-center justify-between p-3 rounded-xl border" style="border-color: var(--border-base); background: var(--bg-app)">
                      <div>
                        <div class="text-[10px] font-bold" style="color: var(--text-primary)">参与自动故障转移</div>
                        <div class="text-[9px] mt-0.5" style="color: var(--text-muted)">开启后，主密钥或模型失败时系统将自动切换至此模型/其他密钥</div>
                      </div>
                      <el-switch
                        :model-value="model.failoverEnabled !== false"
                        size="small"
                        style="--el-switch-on-color: #6366f1; --el-switch-off-color: #94a3b8"
                        @change="(val: boolean | string | number) => { model.failoverEnabled = Boolean(val); syncAiModelsToSettings(); }"
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
                    :disabled="isTestingAi"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 disabled:opacity-50 cursor-pointer"
                    style="
                      border-color: rgba(99, 102, 241, 0.3);
                      color: #6366f1;
                      background: rgba(99, 102, 241, 0.03);
                    "
                    @click="testAi(model)"
                  >
                    <RefreshCw
                      class="w-3 h-3"
                      :class="isTestingAi && testingAiModelId === model.id ? 'animate-spin' : ''"
                    />
                    <span>{{
                      isTestingAi && testingAiModelId === model.id ? '正在测试...' : '测试此连接'
                    }}</span>
                  </button>

                  <div class="flex items-center gap-2">
                    <button
                      v-if="isPendingAiModel(model.id)"
                      type="button"
                      class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer"
                      style="
                        background: linear-gradient(135deg, #10b981, #059669);
                        color: white;
                        box-shadow: 0 2px 10px rgba(16, 185, 129, 0.2);
                      "
                      @click="confirmAiModelFamily(model)"
                    >
                      确认分类
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
                      style="border-color: var(--border-base); color: var(--text-secondary)"
                      @click="cloneAiModel(model)"
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                      style="border-color: rgba(244, 63, 94, 0.2)"
                      @click="removeAiModel(model.id)"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Disabled Model Family Groups (Folded section at the bottom) -->
      <div
        v-if="disabledModelFamilyGroups.length > 0"
        class="pt-4 border-t"
        style="border-color: var(--border-base)"
      >
        <button
          type="button"
          class="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer"
          @click="isUnenabledGroupCollapsed = !isUnenabledGroupCollapsed"
        >
          <span>已禁用的模型分组 ({{ disabledModelFamilyGroups.length }})</span>
          <svg
            viewBox="0 0 24 24"
            class="w-3.5 h-3.5 transition-transform"
            :class="isUnenabledGroupCollapsed ? '' : 'rotate-180'"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div
          v-if="!isUnenabledGroupCollapsed"
          class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 animate-in fade-in duration-200"
        >
          <div
            v-for="group in disabledModelFamilyGroups"
            :key="group.key"
            class="flex items-center justify-between p-3 rounded-xl border text-xs"
            style="border-color: var(--border-base); background: var(--bg-card)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 opacity-60"
                :style="`background: ${group.meta.bg}; color: ${group.meta.color};`"
              >
                <component :is="group.meta.lucideIcon" class="w-4 h-4" />
              </span>
              <div class="min-w-0">
                <p class="font-bold truncate" style="color: var(--text-primary)">
                  {{ group.label }}
                </p>
                <p class="text-[10px]" style="color: var(--text-muted)">
                  共 {{ group.models.length }} 个模型
                </p>
              </div>
            </div>
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 cursor-pointer"
              style="
                border-color: rgba(16, 185, 129, 0.25);
                color: #059669;
                background: rgba(16, 185, 129, 0.05);
              "
              @click="toggleGroupEnabled(group.key, true)"
            >
              重新启用
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Actions for AI Config -->
    <div
      v-if="localSettings.AI_IMPORT_ENABLED"
      class="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl border gap-4"
      style="border-color: rgba(99, 102, 241, 0.2); background: rgba(99, 102, 241, 0.02)"
    >
      <p class="text-[10px] hidden sm:block" style="color: var(--text-muted)">
        {{ $t('admin.please_test_connectivity_before') }}
      </p>
      <button
        type="button"
        :disabled="isTestingAi"
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 disabled:opacity-50 cursor-pointer"
        style="
          border-color: rgba(99, 102, 241, 0.3);
          color: #6366f1;
          background: rgba(99, 102, 241, 0.06);
        "
        @click="
          testAi(localAiModelConfigs.find((model) => model.isDefault) || localAiModelConfigs[0])
        "
      >
        <RefreshCw
          class="w-3.5 h-3.5"
          :class="isTestingAi && testingAiModelId === '__legacy__' ? 'animate-spin' : ''"
        />
        <span>{{
          isTestingAi && testingAiModelId === '__legacy__'
            ? $t('admin.testing')
            : $t('admin.test_default_model_connections')
        }}</span>
      </button>
    </div>
  </div>

  <Modal
    :show="modelFetchDialogVisible"
    title="选择可用模型"
    size="lg"
    @close="modelFetchDialogVisible = false"
  >
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-bold truncate" style="color: var(--text-primary)">
            {{ modelFetchTarget?.name || modelFetchTarget?.provider || 'AI Model' }}
          </p>
          <p class="text-[11px] truncate" style="color: var(--text-muted)">
            {{ fetchedModelOptions.length }} 个可用模型
          </p>
        </div>
        <input
          v-model="fetchedModelSearch"
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
        <el-checkbox-group v-model="selectedFetchedModelIds" class="block">
          <div
            v-for="option in filteredFetchedModelOptions"
            :key="option.id"
            class="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 transition-colors hover:bg-white/60 dark:hover:bg-white/5"
            style="border-color: var(--border-base)"
          >
            <el-checkbox :value="option.id" />
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
        </el-checkbox-group>

        <div
          v-if="filteredFetchedModelOptions.length === 0"
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
          已选择 {{ selectedFetchedModelIds.length }} 个
        </span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="modelFetchDialogVisible = false"
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
            @click="applyFetchedModels"
          >
            应用选择
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

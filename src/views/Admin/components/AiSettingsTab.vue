<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, reactive, watch, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import {
  PENDING_MODEL_FAMILY_KEY,
  inferModelFamilyKey,
  parseModelNameLines,
} from '@/utils/aiModelFamilies';
import { useAiSettingsMeta } from './AiSettingsTab.meta';
import type {
  AiModelConfig,
  AiModelCategory,
  AiProviderModelOption,
  ModelFamilyGroup,
  CategoryDialogState,
} from './AiSettingsTab.types';
import AiSettingsHeader from './AiSettingsHeader.vue';
import AiModelPoolToolbar from './AiModelPoolToolbar.vue';
import AiBatchActionBar from './AiBatchActionBar.vue';
import AiModelFamilyGroups from './AiModelFamilyGroups.vue';
import AiDisabledGroups from './AiDisabledGroups.vue';
import AiModelPoolFooter from './AiModelPoolFooter.vue';
import AiModelFetchModal from './AiModelFetchModal.vue';
import CategoryFormDialog from './CategoryFormDialog.vue';

const props = defineProps<{
  settings: Record<string, unknown>;
  aiModelConfigs: AiModelConfig[];
  pendingModelFamilyIds: string[];
}>();

const emit = defineEmits<{
  'update:settings': [Record<string, unknown>];
  'update:aiModelConfigs': [AiModelConfig[]];
  'update:pendingModelFamilyIds': [string[]];
}>();

const localSettings = reactive({ ...props.settings }) as Record<string, unknown>;
const aiImportEnabled = computed<boolean>({
  get: () => !!localSettings.AI_IMPORT_ENABLED,
  set: (value) => {
    localSettings.AI_IMPORT_ENABLED = value;
  },
});
const localAiModelConfigs = ref<AiModelConfig[]>([]);
const localPendingModelFamilyIds = ref<string[]>([]);

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

const { aiProviderDefaults, getProviderMeta, getModelFamilyMeta, normalizeCustomCategories } =
  useAiSettingsMeta();

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
    maxTokens: 20000,
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
  if (!expandedModelFamilyGroups.value.includes(PENDING_MODEL_FAMILY_KEY)) {
    expandedModelFamilyGroups.value.push(PENDING_MODEL_FAMILY_KEY);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expandedModelFamilyGroups.value));
  }
  syncAiModelsToSettings();
};

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
      name: model.provider === 'CUSTOM' ? modelName : `${providerLabelStr} ${modelName}`,
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
    model.name =
      model.provider === 'CUSTOM' ? model.modelName : `${providerLabelStr} ${model.modelName}`;
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
  if (isPendingAiModel(model.id)) {
    markAiModelPending(cloned.id);
  }
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
  } catch {}
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

const toggleModelExpand = (id: string) => {
  expandedModelId.value = expandedModelId.value === id ? null : id;
};

const dragIndex = ref<number | null>(null);
const isHandleClicked = ref(false);

const draggedGroupKey = ref<string | null>(null);
const isGroupHandleClicked = ref(false);

const handleMouseDown = () => {
  isHandleClicked.value = true;
};

const handleDragStart = (event: DragEvent, index: number) => {
  if (!isHandleClicked.value) {
    event.preventDefault();
    return;
  }
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
};

const handleGroupMouseDown = () => {
  isGroupHandleClicked.value = true;
};

const handleGroupDragStart = (event: DragEvent, key: string) => {
  draggedGroupKey.value = key;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
};

const handleGroupDragEnd = () => {
  draggedGroupKey.value = null;
  isGroupHandleClicked.value = false;
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
  isHandleClicked.value = false;
  draggedGroupKey.value = null;
  isGroupHandleClicked.value = false;
};

const getDominantProvider = (models: AiModelConfig[]) => {
  const counts = new Map<string, number>();
  models.forEach((model) => counts.set(model.provider, (counts.get(model.provider) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'CUSTOM';
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

watch(
  () => localSettings.AI_MODEL_CUSTOM_CATEGORIES,
  () => {
    restoreCustomCategories();
  },
  { immediate: true },
);

const categoryDialog = ref<CategoryDialogState>({
  show: false,
  mode: 'create',
  groupKey: '',
  name: '',
});

const categoryDialogTitle = computed(() => {
  return categoryDialog.value.mode === 'create' ? '创建自定义分类' : '重命名分组';
});

const categoryDialogLabel = computed(() => {
  return categoryDialog.value.mode === 'create' ? '请输入自定义分类名称' : '请输入新的分组名称';
});

const addCustomCategory = () => {
  categoryDialog.value = {
    show: true,
    mode: 'create',
    groupKey: '',
    name: '',
  };
};

const renameModelFamilyGroup = (groupKey: string, currentLabel: string) => {
  categoryDialog.value = {
    show: true,
    mode: 'rename',
    groupKey,
    name: currentLabel,
  };
};

const submitCategoryDialog = () => {
  const name = categoryDialog.value.name.trim();
  if (!name) {
    ElMessage.warning('名称不能为空');
    return;
  }

  if (categoryDialog.value.mode === 'create') {
    const key = 'custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    customCategories.value.push({ key, label: name });
    syncCustomCategoriesToSettings();
    if (!expandedModelFamilyGroups.value.includes(key)) {
      expandedModelFamilyGroups.value.push(key);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expandedModelFamilyGroups.value));
    }
    ElMessage.success('自定义分类创建成功，请将模型拖拽至此分类');
  } else {
    const groupKey = categoryDialog.value.groupKey;
    const targetGroup = modelFamilyGroups.value.find((group) => group.key === groupKey);
    const targetModelIds = new Set(targetGroup?.models.map((model) => model.id) || []);

    customCategories.value = [
      ...customCategories.value.filter((category) => category.key !== groupKey),
      { key: groupKey, label: name },
    ];

    localAiModelConfigs.value.forEach((model) => {
      if (targetModelIds.has(model.id) || model.customFamilyKey === groupKey) {
        model.customFamilyKey = groupKey;
        model.customFamilyLabel = name;
      }
    });

    syncAiModelsToSettings();
    ElMessage.success('分组重命名成功');
  }

  categoryDialog.value.show = false;
};

const disabledGroupKeys = ref<string[]>([]);

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

const LOCAL_STORAGE_KEY = 'admin_ai_expanded_family_groups';
const expandedModelFamilyGroups = ref<string[]>(
  JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]'),
);

const toggleModelFamilyGroup = (key: string) => {
  if (expandedModelFamilyGroups.value.includes(key)) {
    expandedModelFamilyGroups.value = expandedModelFamilyGroups.value.filter(
      (item) => item !== key,
    );
  } else {
    expandedModelFamilyGroups.value.push(key);
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expandedModelFamilyGroups.value));
};

const modelFamilyGroups = computed<ModelFamilyGroup[]>(() => {
  const groups = new Map<string, AiModelConfig[]>();

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

      const minA = a.models.length > 0 ? Math.min(...a.models.map((m) => m.priority ?? 999)) : 999;
      const minB = b.models.length > 0 ? Math.min(...b.models.map((m) => m.priority ?? 999)) : 999;

      if (minA !== minB) return minA - minB;
      return a.label.localeCompare(b.label);
    });
});

const enabledModelFamilyGroups = computed(() => {
  return modelFamilyGroups.value.filter((group) => !disabledGroupKeys.value.includes(group.key));
});

const disabledModelFamilyGroups = computed(() => {
  return modelFamilyGroups.value.filter((group) => disabledGroupKeys.value.includes(group.key));
});

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

  if (
    batchTargetFamilyKey.value &&
    !expandedModelFamilyGroups.value.includes(batchTargetFamilyKey.value)
  ) {
    expandedModelFamilyGroups.value.push(batchTargetFamilyKey.value);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expandedModelFamilyGroups.value));
  }
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
  } catch {
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
  expandedModelId.value = model.id;
  if (group.key && !expandedModelFamilyGroups.value.includes(group.key)) {
    expandedModelFamilyGroups.value.push(group.key);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expandedModelFamilyGroups.value));
  }
  syncAiModelsToSettings();
};

const handleDropOnGroup = (event: DragEvent, group: ModelFamilyGroup) => {
  if (draggedGroupKey.value !== null) {
    const sourceGroupKey = draggedGroupKey.value;
    if (sourceGroupKey === group.key) return;

    const list = [...localAiModelConfigs.value];

    const sourceModels = list.filter((m) => {
      const fk = inferModelFamilyKey(m, { isPending: isPendingAiModel(m.id) });
      return fk === sourceGroupKey;
    });

    if (sourceModels.length === 0) return;

    const remainingList = list.filter((m) => {
      const fk = inferModelFamilyKey(m, { isPending: isPendingAiModel(m.id) });
      return fk !== sourceGroupKey;
    });

    let insertIndex = remainingList.findIndex((m) => {
      const fk = inferModelFamilyKey(m, { isPending: isPendingAiModel(m.id) });
      return fk === group.key;
    });

    if (insertIndex === -1) {
      insertIndex = remainingList.length;
    }

    remainingList.splice(insertIndex, 0, ...sourceModels);

    localAiModelConfigs.value = remainingList;
    syncAiModelsToSettings();
    ElMessage.success('已成功更新分组优先级顺序');
    return;
  }

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
  const rawModelName = model?.modelName || localSettings.AI_MODEL_NAME;
  const modelName =
    String(rawModelName || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)[0] || '';

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
      const msg = data.message || t('admin.ai_interface_test_successful');
      ElMessage.success({
        message: msg,
        duration: 4000,
        showClose: true,
      });
    } else {
      const msg = data.message || t('admin.the_test_failed_and');
      ElMessage.error({
        message: msg,
        duration: 5000,
        showClose: true,
      });
    }
  } catch (error: unknown) {
    logError(error, { operation: 'admin.testAi', component: 'AiSettingsTab' });
    const errMsg = getApiErrorMessage(error, t('admin.ai_connection_test_failed'));
    ElMessage.error({
      message: errMsg,
      duration: 5000,
      showClose: true,
    });
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
    logError(error, { operation: 'admin.fetchAiModels', component: 'AiSettingsTab' });
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
    logError(error, { operation: 'admin.importAiSettings', component: 'AiSettingsTab' });
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
    logError(error, { operation: 'admin.exportAiSettings', component: 'AiSettingsTab' });
    ElMessage.error('导出配置失败');
  }
};

const handleUpdateModel = (id: string, patch: Partial<AiModelConfig>) => {
  const model = localAiModelConfigs.value.find((m) => m.id === id);
  if (!model) return;
  Object.assign(model, patch);
  syncAiModelsToSettings();
};

const handleSetDefault = (model: AiModelConfig) => {
  localAiModelConfigs.value.forEach((m) => (m.isDefault = false));
  model.isDefault = true;
  syncAiModelsToSettings();
};

const handleModelNameBlur = (model: AiModelConfig) => {
  if (!isPendingAiModel(model.id)) {
    expandModelNameLines(model);
  } else {
    syncAiModelsToSettings();
  }
};

const handleAddBackupKey = (model: AiModelConfig) => {
  if (!model.apiKeys) model.apiKeys = [];
  model.apiKeys.push('');
  syncAiModelsToSettings();
};

const handleRemoveBackupKey = (model: AiModelConfig, index: number) => {
  model.apiKeys = (model.apiKeys || []).filter((_, i) => i !== index);
  syncAiModelsToSettings();
};

onMounted(() => {
  restoreDisabledGroups();
  restoreCustomCategories();
});
</script>

<template>
  <div class="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <AiSettingsHeader v-model:enabled="aiImportEnabled" />

    <div v-if="localSettings.AI_IMPORT_ENABLED" class="space-y-4">
      <AiModelPoolToolbar
        :total="localAiModelConfigs.length"
        :enabled="localAiModelConfigs.filter((m) => m.enabled).length"
        @add-model="addAiModel()"
        @add-category="addCustomCategory"
        @export-config="exportAiSettings"
        @import-file="importAiSettingsFile"
      />

      <AiBatchActionBar
        :selected-count="selectedAiModels.length"
        :total="localAiModelConfigs.length"
        :is-all-selected="isAllAiModelsSelected"
        :indeterminate="selectedAiModels.length > 0 && !isAllAiModelsSelected"
        :families="selectableBatchFamilies"
        @select-all="selectAllAiModels"
        @clear="clearSelectedAiModels"
        @enable="batchSetAiModelsEnabled(true)"
        @disable="batchSetAiModelsEnabled(false)"
        @move="handleBatchMoveSelect"
        @delete="batchDeleteAiModels"
      />

      <AiModelFamilyGroups
        :groups="enabledModelFamilyGroups"
        :configs="localAiModelConfigs"
        :disabled-group-keys="disabledGroupKeys"
        :expanded-groups="expandedModelFamilyGroups"
        :expanded-model-id="expandedModelId"
        :selected-ids="batchSelectedModelIds"
        :selection-active="selectedAiModels.length > 0"
        :pending-ids="localPendingModelFamilyIds"
        :is-testing-ai="isTestingAi"
        :testing-ai-model-id="testingAiModelId"
        :is-fetching-ai-models="isFetchingAiModels"
        :fetching-ai-models-model-id="fetchingAiModelsModelId"
        :is-handle-clicked="isHandleClicked"
        :is-group-handle-clicked="isGroupHandleClicked"
        :dragged-group-key="draggedGroupKey"
        :drag-index="dragIndex"
        @toggle-collapse="toggleModelFamilyGroup"
        @rename-group="renameModelFamilyGroup"
        @toggle-group-enabled="toggleGroupEnabled"
        @add-model-to-family="addAiModelToFamily"
        @toggle-group-selection="toggleGroupModelSelection"
        @group-dragstart="handleGroupDragStart"
        @group-dragend="handleGroupDragEnd"
        @group-mousedown="handleGroupMouseDown"
        @drop-on-group="handleDropOnGroup"
        @card-expand="toggleModelExpand"
        @card-dragstart="handleDragStart"
        @card-drop="handleDrop"
        @card-dragend="handleDragEnd"
        @card-mouse-down="handleMouseDown"
        @toggle-selection="toggleAiModelSelection"
        @update:model="handleUpdateModel"
        @set-default="handleSetDefault"
        @clone="cloneAiModel"
        @confirm-family="confirmAiModelFamily"
        @remove="removeAiModel($event.id)"
        @test="testAi"
        @fetch-models="fetchAiModels"
        @model-name-blur="handleModelNameBlur"
        @add-backup-key="handleAddBackupKey"
        @remove-backup-key="handleRemoveBackupKey"
      />

      <AiDisabledGroups
        :groups="disabledModelFamilyGroups"
        @enable-group="(key: string) => toggleGroupEnabled(key, true)"
      />
    </div>

    <AiModelPoolFooter
      v-if="localSettings.AI_IMPORT_ENABLED"
      :is-testing-ai="isTestingAi"
      :testing-ai-model-id="testingAiModelId"
      @test="testAi(localAiModelConfigs.find((model) => model.isDefault) || localAiModelConfigs[0])"
    />
  </div>

  <AiModelFetchModal
    :show="modelFetchDialogVisible"
    :target-name="modelFetchTarget?.name || modelFetchTarget?.provider || 'AI Model'"
    :total="fetchedModelOptions.length"
    :search="fetchedModelSearch"
    :options="fetchedModelOptions"
    :selected-ids="selectedFetchedModelIds"
    @close="modelFetchDialogVisible = false"
    @update:search="(val: string) => (fetchedModelSearch = val)"
    @update:selected-ids="(val: string[]) => (selectedFetchedModelIds = val)"
    @apply="applyFetchedModels"
  />

  <CategoryFormDialog
    v-model:show="categoryDialog.show"
    v-model:name="categoryDialog.name"
    mode="ai"
    :title="categoryDialogTitle"
    :label="categoryDialogLabel"
    @submit="submitCategoryDialog"
  />
</template>

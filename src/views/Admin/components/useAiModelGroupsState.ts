import { ref, watch, onUnmounted, type Ref } from 'vue';
import type { ModelFamilyGroup } from './AiSettingsTab.types';

export const EXPANDED_GROUPS_STORAGE_KEY = 'admin_ai_expanded_family_groups';
export const DISABLED_GROUPS_STORAGE_KEY = 'ai_model_disabled_groups';

export const parseDisabledGroupKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
};

export function useAiModelGroupsState(
  localSettings: Record<string, unknown>,
  modelFamilyGroups: Ref<ModelFamilyGroup[]>,
  syncAiModelsToSettings: () => void,
) {
  const disabledGroupKeys = ref<string[]>([]);
  // 使用超时机制：2秒内视为用户操作，避免标志永久阻断服务端数据同步
  let userActionTimeout: ReturnType<typeof setTimeout> | null = null;
  const markUserAction = () => {
    if (userActionTimeout) clearTimeout(userActionTimeout);
    userActionTimeout = setTimeout(() => {
      userActionTimeout = null;
    }, 2000);
  };
  const isUserAction = () => userActionTimeout !== null;

  const restoreDisabledGroups = () => {
    const persisted = parseDisabledGroupKeys(localSettings.AI_MODEL_DISABLED_GROUPS);
    const legacy = parseDisabledGroupKeys(localStorage.getItem(DISABLED_GROUPS_STORAGE_KEY));
    // If persisted from backend/localSettings has values, use it; otherwise fallback to legacy localStorage
    const mergedKeys = persisted.length > 0 ? persisted : legacy;
    disabledGroupKeys.value = mergedKeys;
    if (mergedKeys.length > 0) {
      localSettings.AI_MODEL_DISABLED_GROUPS = JSON.stringify(mergedKeys);
    }
  };

  const toggleGroupEnabled = (key: string, enabled: boolean) => {
    markUserAction();
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

  // Sync disabledGroupKeys to localStorage and localSettings
  watch(
    disabledGroupKeys,
    (newKeys) => {
      const jsonStr = JSON.stringify(newKeys);
      localStorage.setItem(DISABLED_GROUPS_STORAGE_KEY, jsonStr);
      localSettings.AI_MODEL_DISABLED_GROUPS = jsonStr;
    },
    { deep: true },
  );

  // Watch incoming AI_MODEL_DISABLED_GROUPS from parent/props
  watch(
    () => localSettings.AI_MODEL_DISABLED_GROUPS,
    (value) => {
      const incoming = parseDisabledGroupKeys(value);
      // If user toggled locally in this session, don't let empty server response override local user action
      if (incoming.length === 0 && disabledGroupKeys.value.length > 0 && !isUserAction()) {
        // Keep disabledGroupKeys and sync back to localSettings
        localSettings.AI_MODEL_DISABLED_GROUPS = JSON.stringify(disabledGroupKeys.value);
        return;
      }
      if (JSON.stringify(incoming) !== JSON.stringify(disabledGroupKeys.value)) {
        disabledGroupKeys.value = incoming;
      }
    },
  );

  // Accordion Expand/Collapse state
  // 使用安全解析函数，避免 localStorage 被篹改时抛出 SyntaxError
  const expandedModelFamilyGroups = ref<string[]>(
    parseDisabledGroupKeys(localStorage.getItem(EXPANDED_GROUPS_STORAGE_KEY)),
  );

  const toggleModelFamilyGroup = (key: string) => {
    if (expandedModelFamilyGroups.value.includes(key)) {
      expandedModelFamilyGroups.value = expandedModelFamilyGroups.value.filter(
        (item) => item !== key,
      );
    } else {
      expandedModelFamilyGroups.value.push(key);
    }
    localStorage.setItem(
      EXPANDED_GROUPS_STORAGE_KEY,
      JSON.stringify(expandedModelFamilyGroups.value),
    );
  };

  const expandGroupKey = (key: string) => {
    if (key && !expandedModelFamilyGroups.value.includes(key)) {
      expandedModelFamilyGroups.value.push(key);
      localStorage.setItem(
        EXPANDED_GROUPS_STORAGE_KEY,
        JSON.stringify(expandedModelFamilyGroups.value),
      );
    }
  };

  onUnmounted(() => {
    if (userActionTimeout) clearTimeout(userActionTimeout);
  });

  return {
    disabledGroupKeys,
    expandedModelFamilyGroups,
    parseDisabledGroupKeys,
    restoreDisabledGroups,
    toggleGroupEnabled,
    toggleModelFamilyGroup,
    expandGroupKey,
  };
}

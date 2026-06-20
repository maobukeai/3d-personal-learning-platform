import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import { fetchUserSettings, updateUserSettings } from '@/services/account.service';
import { preferences, type SidebarMode } from '@/utils/preferences';
import { useWorkspaceStore } from '@/stores/workspace';

const CLOUD_MODE_KEY = 'layoutSidebarMode';
const CLOUD_GROUPS_KEY = 'layoutSidebarCollapsedGroups';
const SAVE_DEBOUNCE_MS = 320;

interface SidebarPreferenceOptions {
  initialMode: SidebarMode;
  isAuthenticated: Ref<boolean>;
}

const parseCloudGroups = (value?: string) => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((key): key is string => typeof key === 'string' && key.length > 0);
  } catch {
    return null;
  }
};

export function useSidebarPreferences({ initialMode, isAuthenticated }: SidebarPreferenceOptions) {
  const workspaceStore = useWorkspaceStore();
  const sidebarMode = ref<SidebarMode>(initialMode);
  const collapsedGroupKeys = ref<Set<string>>(new Set(preferences.getSidebarCollapsedGroups()));
  const cloudPreferenceLoaded = ref(false);
  const isSavingPreference = ref(false);
  const hasLocalPreferenceChange = ref(false);
  const lastAvailableKeys = ref<string[]>([]);

  let savePreferenceTimer: number | undefined;

  const persistSidebarPreferences = () => {
    preferences.setSidebarMode(sidebarMode.value);
    preferences.setSidebarCollapsedGroups([...collapsedGroupKeys.value]);

    if (!isAuthenticated.value) return;

    if (savePreferenceTimer) window.clearTimeout(savePreferenceTimer);
    savePreferenceTimer = window.setTimeout(async () => {
      try {
        isSavingPreference.value = true;
        await updateUserSettings([
          { key: CLOUD_MODE_KEY, value: sidebarMode.value },
          { key: CLOUD_GROUPS_KEY, value: JSON.stringify([...collapsedGroupKeys.value]) },
        ]);
        cloudPreferenceLoaded.value = true;
      } catch {
        cloudPreferenceLoaded.value = false;
      } finally {
        isSavingPreference.value = false;
      }
    }, SAVE_DEBOUNCE_MS);
  };

  const setSidebarMode = (mode: SidebarMode) => {
    hasLocalPreferenceChange.value = true;
    sidebarMode.value = mode;
    persistSidebarPreferences();
  };

  const toggleGroupKey = (key: string) => {
    hasLocalPreferenceChange.value = true;
    const next = new Set(collapsedGroupKeys.value);

    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }

    collapsedGroupKeys.value = next;
    persistSidebarPreferences();
  };

  const expandGroupKey = (key: string) => {
    if (!collapsedGroupKeys.value.has(key)) return;
    hasLocalPreferenceChange.value = true;
    const next = new Set(collapsedGroupKeys.value);
    next.delete(key);
    collapsedGroupKeys.value = next;
    persistSidebarPreferences();
  };

  const checkAndApplyMigration = () => {
    if (!lastAvailableKeys.value.length) return;

    // If authenticated, wait until cloud preferences are loaded
    if (isAuthenticated.value && !cloudPreferenceLoaded.value) return;

    const user = preferences.getUser<{ id: string | number }>();
    const userId = user?.id ? `_${user.id}` : '';
    const workspaceId = workspaceStore.currentWorkspace?.id
      ? `_${workspaceStore.currentWorkspace.id}`
      : '';
    const migrationKey = `layout_sidebar_default_collapsed_v4${userId}${workspaceId}`;

    if (localStorage.getItem(migrationKey) !== null) return;

    const next = new Set(collapsedGroupKeys.value);
    let migrated = false;

    const isResourceWorkspace =
      window.location.pathname.startsWith('/mirror') ||
      window.location.pathname.startsWith('/manual');

    lastAvailableKeys.value.forEach((key) => {
      const lowercaseKey = key.toLowerCase();
      const isToolsGroup =
        lowercaseKey.includes('tools') ||
        lowercaseKey.includes('工具服务') ||
        lowercaseKey.includes('ai') ||
        lowercaseKey.includes('智能') ||
        lowercaseKey.includes('assistance');

      const isCategoryGroup = isResourceWorkspace && !key.startsWith('0:');

      if (isToolsGroup || isCategoryGroup) {
        if (!next.has(key)) {
          next.add(key);
          migrated = true;
        }
      }
    });

    localStorage.setItem(migrationKey, 'true');

    if (migrated) {
      collapsedGroupKeys.value = next;
      persistSidebarPreferences();
    }
  };

  const syncAvailableGroupKeys = (availableGroupKeys: string[]) => {
    if (!availableGroupKeys.length) return;

    lastAvailableKeys.value = availableGroupKeys;

    const hasStored =
      localStorage.getItem(CLOUD_GROUPS_KEY) !== null ||
      localStorage.getItem(preferences.keys.sidebarCollapsedGroups) !== null;

    let next: Set<string>;
    if (hasStored) {
      const availableKeys = new Set(availableGroupKeys);
      next = new Set([...collapsedGroupKeys.value].filter((key) => availableKeys.has(key)));
    } else {
      next = new Set<string>();
      availableGroupKeys.forEach((key) => {
        const lowercaseKey = key.toLowerCase();
        const isToolsGroup =
          lowercaseKey.includes('tools') ||
          lowercaseKey.includes('工具服务') ||
          lowercaseKey.includes('ai') ||
          lowercaseKey.includes('智能') ||
          lowercaseKey.includes('assistance');

        const isResourceWorkspace =
          window.location.pathname.startsWith('/mirror') ||
          window.location.pathname.startsWith('/manual');
        const isCategoryGroup = isResourceWorkspace && !key.startsWith('0:');

        if (isToolsGroup || isCategoryGroup) {
          next.add(key);
        }
      });
    }

    const hasChanged =
      next.size !== collapsedGroupKeys.value.size ||
      [...next].some((k) => !collapsedGroupKeys.value.has(k));

    if (hasChanged) {
      collapsedGroupKeys.value = next;
      preferences.setSidebarCollapsedGroups([...next]);
    }

    checkAndApplyMigration();
  };

  const loadCloudSidebarPreferences = async () => {
    if (!isAuthenticated.value) return;

    try {
      const settings = await fetchUserSettings();
      const mode = settings[CLOUD_MODE_KEY];
      const groups = parseCloudGroups(settings[CLOUD_GROUPS_KEY]);

      if (hasLocalPreferenceChange.value) {
        cloudPreferenceLoaded.value = true;
        return;
      }

      if (mode === 'rail' || mode === 'expanded') {
        sidebarMode.value = mode;
        preferences.setSidebarMode(mode);
      }

      if (groups) {
        collapsedGroupKeys.value = new Set(groups);
        preferences.setSidebarCollapsedGroups(groups);
      }

      cloudPreferenceLoaded.value = true;
      checkAndApplyMigration();
    } catch {
      cloudPreferenceLoaded.value = false;
    }
  };

  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      loadCloudSidebarPreferences();
    } else {
      cloudPreferenceLoaded.value = false;
      checkAndApplyMigration();
    }
  });

  watch(
    () => workspaceStore.currentWorkspace?.id,
    () => {
      checkAndApplyMigration();
    },
  );

  onMounted(loadCloudSidebarPreferences);

  onUnmounted(() => {
    if (savePreferenceTimer) window.clearTimeout(savePreferenceTimer);
  });

  return {
    sidebarMode,
    collapsedGroupKeys,
    cloudPreferenceLoaded,
    isSavingPreference,
    setSidebarMode,
    syncAvailableGroupKeys,
    toggleGroupKey,
    expandGroupKey,
  };
}

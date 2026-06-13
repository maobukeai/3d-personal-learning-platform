import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import { fetchUserSettings, updateUserSettings } from '@/services/account.service';
import { preferences, type SidebarMode } from '@/utils/preferences';

const CLOUD_MODE_KEY = 'layoutSidebarMode';
const CLOUD_GROUPS_KEY = 'layoutSidebarExpandedGroups';
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
  const sidebarMode = ref<SidebarMode>(initialMode);
  const expandedGroupKeys = ref<Set<string>>(new Set(preferences.getSidebarExpandedGroups()));
  const cloudPreferenceLoaded = ref(false);
  const isSavingPreference = ref(false);
  const hasLocalPreferenceChange = ref(false);

  let savePreferenceTimer: number | undefined;

  const persistSidebarPreferences = () => {
    preferences.setSidebarMode(sidebarMode.value);
    preferences.setSidebarExpandedGroups([...expandedGroupKeys.value]);

    if (!isAuthenticated.value) return;

    if (savePreferenceTimer) window.clearTimeout(savePreferenceTimer);
    savePreferenceTimer = window.setTimeout(async () => {
      try {
        isSavingPreference.value = true;
        await updateUserSettings([
          { key: CLOUD_MODE_KEY, value: sidebarMode.value },
          { key: CLOUD_GROUPS_KEY, value: JSON.stringify([...expandedGroupKeys.value]) },
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
    const next = new Set(expandedGroupKeys.value);

    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }

    expandedGroupKeys.value = next;
    persistSidebarPreferences();
  };

  const expandGroupKey = (key: string) => {
    if (expandedGroupKeys.value.has(key)) return;
    hasLocalPreferenceChange.value = true;
    const next = new Set(expandedGroupKeys.value);
    next.add(key);
    expandedGroupKeys.value = next;
    persistSidebarPreferences();
  };

  const syncAvailableGroupKeys = (availableGroupKeys: string[]) => {
    if (!availableGroupKeys.length) return;

    const availableKeys = new Set(availableGroupKeys);
    const next = new Set([...expandedGroupKeys.value].filter((key) => availableKeys.has(key)));

    if (!next.size) {
      availableGroupKeys.forEach((key) => next.add(key));
    }

    if (next.size !== expandedGroupKeys.value.size) {
      expandedGroupKeys.value = next;
      preferences.setSidebarExpandedGroups([...next]);
    }
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
        expandedGroupKeys.value = new Set(groups);
        preferences.setSidebarExpandedGroups(groups);
      }

      cloudPreferenceLoaded.value = true;
    } catch {
      cloudPreferenceLoaded.value = false;
    }
  };

  watch(isAuthenticated, (authenticated) => {
    if (authenticated) loadCloudSidebarPreferences();
  });

  onMounted(loadCloudSidebarPreferences);

  onUnmounted(() => {
    if (savePreferenceTimer) window.clearTimeout(savePreferenceTimer);
  });

  return {
    sidebarMode,
    expandedGroupKeys,
    cloudPreferenceLoaded,
    isSavingPreference,
    setSidebarMode,
    syncAvailableGroupKeys,
    toggleGroupKey,
    expandGroupKey,
  };
}

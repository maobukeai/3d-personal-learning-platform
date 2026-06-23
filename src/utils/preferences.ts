export type ThemePreference = 'glass-light' | 'glass-dark' | 'glass-auto';
export type LocalePreference = 'zh-CN' | 'en-US';
export type SidebarMode = 'rail' | 'expanded';
export type AccentColorModePreference = 'static' | 'refresh' | 'interval';
export type AccentColorIntervalPreference = '10s' | '1m' | '5m' | '30m';

const storageKeys = {
  activeWorkspaceId: 'activeWorkspaceId',
  accentColor: 'accentColor',
  accentColorMode: 'accentColorMode',
  accentColorInterval: 'accentColorInterval',
  deviceToken: 'deviceToken',
  language: 'language',
  lastBaseTheme: 'lastBaseTheme',
  refreshToken: 'refreshToken',
  searchHistory: 'searchHistory',
  sidebarCollapsedGroups: 'layoutSidebarCollapsedGroups',
  sidebarMode: 'layoutSidebarMode',
  theme: 'theme',
  token: 'token',
  user: 'user',
  aiSpriteModelId: 'ai_sprite_model_id',
  aiSpriteWidth: 'ai_sprite_width',
  aiSpriteHeight: 'ai_sprite_height',
  aiSpritePosX: 'ai_sprite_pos_x',
  aiSpritePosY: 'ai_sprite_pos_y',
  aiSpriteSessionId: 'ai_sprite_session_id',
  aiPendingRunsIndex: 'ai_pending_run_index',
} as const;

const fallbackStorage = new Map<string, string>();

const getStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

const getItem = (key: string): string | null => {
  const storage = getStorage();
  return storage?.getItem(key) ?? fallbackStorage.get(key) ?? null;
};

const setItem = (key: string, value: string) => {
  const storage = getStorage();
  if (storage) {
    storage.setItem(key, value);
    return;
  }
  fallbackStorage.set(key, value);
};

const removeItem = (key: string) => {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(key);
    return;
  }
  fallbackStorage.delete(key);
};

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'glass-light' || value === 'glass-dark' || value === 'glass-auto';

const isLocalePreference = (value: string | null): value is LocalePreference =>
  value === 'zh-CN' || value === 'en-US';

const isSidebarMode = (value: string | null): value is SidebarMode =>
  value === 'rail' || value === 'expanded';

export const preferences = {
  keys: storageKeys,

  getActiveWorkspaceId: () => getItem(storageKeys.activeWorkspaceId),
  setActiveWorkspaceId: (id: string) => setItem(storageKeys.activeWorkspaceId, id),
  clearActiveWorkspaceId: () => removeItem(storageKeys.activeWorkspaceId),

  getTheme: (): ThemePreference => {
    const theme = getItem(storageKeys.theme);
    return isThemePreference(theme) ? theme : 'glass-dark';
  },
  setTheme: (theme: ThemePreference) => setItem(storageKeys.theme, theme),

  getLastBaseTheme: (): 'light' | 'dark' => {
    const theme = getItem(storageKeys.lastBaseTheme);
    return theme === 'dark' ? 'dark' : 'light';
  },
  setLastBaseTheme: (theme: 'light' | 'dark') => setItem(storageKeys.lastBaseTheme, theme),

  getAccentColor: () => getItem(storageKeys.accentColor) || '#2563eb',
  setAccentColor: (color: string) => setItem(storageKeys.accentColor, color),

  getAccentColorMode: (): AccentColorModePreference => {
    const mode = getItem(storageKeys.accentColorMode);
    return mode === 'static' || mode === 'refresh' || mode === 'interval' ? mode : 'static';
  },
  setAccentColorMode: (mode: AccentColorModePreference) =>
    setItem(storageKeys.accentColorMode, mode),

  getAccentColorInterval: (): AccentColorIntervalPreference => {
    const interval = getItem(storageKeys.accentColorInterval);
    return interval === '10s' || interval === '1m' || interval === '5m' || interval === '30m'
      ? interval
      : '1m';
  },
  setAccentColorInterval: (interval: AccentColorIntervalPreference) =>
    setItem(storageKeys.accentColorInterval, interval),

  getLanguage: (): LocalePreference => {
    const language = getItem(storageKeys.language);
    return isLocalePreference(language) ? language : 'zh-CN';
  },
  setLanguage: (language: LocalePreference) => setItem(storageKeys.language, language),

  getSearchHistory: () => parseJson<string[]>(getItem(storageKeys.searchHistory), []),
  setSearchHistory: (history: string[]) =>
    setItem(storageKeys.searchHistory, JSON.stringify(history.slice(0, 5))),
  clearSearchHistory: () => removeItem(storageKeys.searchHistory),

  hasSidebarMode: () => isSidebarMode(getItem(storageKeys.sidebarMode)),
  getSidebarMode: (): SidebarMode => {
    const mode = getItem(storageKeys.sidebarMode);
    return isSidebarMode(mode) ? mode : 'expanded';
  },
  setSidebarMode: (mode: SidebarMode) => setItem(storageKeys.sidebarMode, mode),

  getSidebarCollapsedGroups: () =>
    parseJson<string[]>(getItem(storageKeys.sidebarCollapsedGroups), []).filter(
      (key) => typeof key === 'string' && key.length > 0,
    ),
  setSidebarCollapsedGroups: (groups: string[]) =>
    setItem(storageKeys.sidebarCollapsedGroups, JSON.stringify([...new Set(groups)])),

  getUser: <T>() => parseJson<T | null>(getItem(storageKeys.user), null),
  setUser: (user: unknown) => setItem(storageKeys.user, JSON.stringify(user)),
  clearUser: () => removeItem(storageKeys.user),

  getDeviceToken: () => getItem(storageKeys.deviceToken) || '',
  setDeviceToken: (token: string) => setItem(storageKeys.deviceToken, token),
  clearDeviceToken: () => removeItem(storageKeys.deviceToken),

  clearLegacyAuthTokens: () => {
    removeItem(storageKeys.token);
    removeItem(storageKeys.refreshToken);
  },

  getAiSpriteModelId: () => getItem(storageKeys.aiSpriteModelId) || '',
  setAiSpriteModelId: (id: string) => setItem(storageKeys.aiSpriteModelId, id),
  removeAiSpriteModelId: () => removeItem(storageKeys.aiSpriteModelId),

  getAiSpriteWidth: () => parseInt(getItem(storageKeys.aiSpriteWidth) || '1000', 10),
  getAiSpriteHeight: () => parseInt(getItem(storageKeys.aiSpriteHeight) || '720', 10),
  setAiSpriteDimensions: (width: number, height: number) => {
    setItem(storageKeys.aiSpriteWidth, width.toString());
    setItem(storageKeys.aiSpriteHeight, height.toString());
  },

  getAiSpritePosX: () => getItem(storageKeys.aiSpritePosX),
  getAiSpritePosY: () => getItem(storageKeys.aiSpritePosY),
  setAiSpritePosition: (x: number, y: number) => {
    setItem(storageKeys.aiSpritePosX, x.toString());
    setItem(storageKeys.aiSpritePosY, y.toString());
  },

  getAiSpriteSessionId: () => getItem(storageKeys.aiSpriteSessionId),
  setAiSpriteSessionId: (id: string) => setItem(storageKeys.aiSpriteSessionId, id),
  removeAiSpriteSessionId: () => removeItem(storageKeys.aiSpriteSessionId),

  getAiPendingRunsIndex: () => parseJson<string[]>(getItem(storageKeys.aiPendingRunsIndex), []),
  setAiPendingRunsIndex: (index: string[]) =>
    setItem(storageKeys.aiPendingRunsIndex, JSON.stringify(index)),

  getAiPendingRun: (sessionId: string) => getItem(`ai_pending_run_${sessionId}`),
  setAiPendingRun: (sessionId: string, data: string) =>
    setItem(`ai_pending_run_${sessionId}`, data),
  removeAiPendingRun: (sessionId: string) => removeItem(`ai_pending_run_${sessionId}`),
};

export type ThemePreference = 'glass-light' | 'glass-dark';
export type LocalePreference = 'zh-CN' | 'en-US';

const storageKeys = {
  activeWorkspaceId: 'activeWorkspaceId',
  accentColor: 'accentColor',
  deviceToken: 'deviceToken',
  language: 'language',
  lastBaseTheme: 'lastBaseTheme',
  refreshToken: 'refreshToken',
  searchHistory: 'searchHistory',
  theme: 'theme',
  token: 'token',
  user: 'user',
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
  value === 'glass-light' || value === 'glass-dark';

const isLocalePreference = (value: string | null): value is LocalePreference =>
  value === 'zh-CN' || value === 'en-US';

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

  getLanguage: (): LocalePreference => {
    const language = getItem(storageKeys.language);
    return isLocalePreference(language) ? language : 'zh-CN';
  },
  setLanguage: (language: LocalePreference) => setItem(storageKeys.language, language),

  getSearchHistory: () => parseJson<string[]>(getItem(storageKeys.searchHistory), []),
  setSearchHistory: (history: string[]) =>
    setItem(storageKeys.searchHistory, JSON.stringify(history.slice(0, 5))),
  clearSearchHistory: () => removeItem(storageKeys.searchHistory),

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
};

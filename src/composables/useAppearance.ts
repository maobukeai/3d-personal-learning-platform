import { ref } from 'vue';
import { preferences, type LocalePreference, type ThemePreference } from '@/utils/preferences';

export const accentColors = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Indigo', value: '#6366f1' },
] as const;

export const languageOptions: Array<{ label: string; value: LocalePreference }> = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

export const applyThemeToDocument = (theme: ThemePreference) => {
  const root = document.documentElement;
  const classes = new Set(root.classList);
  classes.delete('dark');
  classes.delete('theme-glass');

  if (theme === 'light') {
    preferences.setLastBaseTheme('light');
  } else if (theme === 'dark') {
    preferences.setLastBaseTheme('dark');
    classes.add('dark');
  } else if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    preferences.setLastBaseTheme(isDark ? 'dark' : 'light');
    if (isDark) classes.add('dark');
  } else if (theme === 'glass') {
    classes.add('theme-glass');
    if (preferences.getLastBaseTheme() === 'dark') classes.add('dark');
  }

  root.className = Array.from(classes).join(' ');
};

export const applyAccentColorToDocument = (color: string) => {
  const root = document.documentElement;
  root.style.setProperty('--accent', color);
  root.style.setProperty('--el-color-primary', color);
  root.style.setProperty('--el-color-primary-light-3', `${color}b3`);
  root.style.setProperty('--el-color-primary-light-5', `${color}80`);
  root.style.setProperty('--el-color-primary-light-9', `${color}1a`);
};

export const useAppearance = () => {
  const currentTheme = ref<ThemePreference>(preferences.getTheme());
  const currentAccent = ref(preferences.getAccentColor());
  const currentLanguage = ref<LocalePreference>(preferences.getLanguage());

  const applyTheme = (theme: ThemePreference, options: { notify?: boolean } = {}) => {
    currentTheme.value = theme;
    preferences.setTheme(theme);
    applyThemeToDocument(theme);

    if (options.notify) {
      window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
    }
  };

  const applyAccentColor = (color: string) => {
    currentAccent.value = color;
    preferences.setAccentColor(color);
    applyAccentColorToDocument(color);
  };

  const applyLanguage = (language: LocalePreference) => {
    currentLanguage.value = language;
    preferences.setLanguage(language);
  };

  return {
    accentColors,
    applyAccentColor,
    applyLanguage,
    applyTheme,
    currentAccent,
    currentLanguage,
    currentTheme,
    languageOptions,
  };
};

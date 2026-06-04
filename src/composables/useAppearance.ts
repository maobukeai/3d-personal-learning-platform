import { ref } from 'vue';
import { preferences, type LocalePreference, type ThemePreference } from '@/utils/preferences';

export const accentColors = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Slate', value: '#475569' },
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

  if (theme === 'glass-light') {
    classes.add('theme-glass');
  } else if (theme === 'glass-dark') {
    classes.add('theme-glass');
    classes.add('dark');
  }

  root.className = Array.from(classes).join(' ');
};

export const applyAccentColorToDocument = (color: string) => {
  const root = document.documentElement;
  const hex = color.replace('#', '');
  const bigint = Number.parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
  const rgb = Number.isFinite(bigint)
    ? `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`
    : '37, 99, 235';

  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-rgb', rgb);
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

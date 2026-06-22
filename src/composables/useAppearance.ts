import { ref } from 'vue';
import { preferences, type LocalePreference, type ThemePreference } from '@/utils/preferences';

export const accentColors = [
  { name: 'Ocean Blue', value: '#2563eb' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#ec4899' },
  { name: 'Pine Green', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Cyan', value: '#0891b2' },
] as const;

export const languageOptions: Array<{ label: string; value: LocalePreference }> = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

export const getBeijingHour = (): number => {
  const utc = new Date().getTime() + new Date().getTimezoneOffset() * 60000;
  const beijingTime = new Date(utc + 3600000 * 8);
  return beijingTime.getHours();
};

export const getEffectiveTheme = (theme: ThemePreference): 'glass-light' | 'glass-dark' => {
  if (theme === 'glass-auto') {
    const hour = getBeijingHour();
    return hour >= 6 && hour < 18 ? 'glass-light' : 'glass-dark';
  }
  return theme;
};

export const applyThemeToDocument = (theme: ThemePreference) => {
  const root = document.documentElement;
  const classes = new Set(root.classList);
  classes.delete('dark');
  classes.delete('theme-glass');

  const effectiveTheme = getEffectiveTheme(theme);

  if (effectiveTheme === 'glass-light') {
    classes.add('theme-glass');
  } else if (effectiveTheme === 'glass-dark') {
    classes.add('theme-glass');
    classes.add('dark');
  }

  root.className = Array.from(classes).join(' ');
};

export const applyAccentColorToDocument = (color: string) => {
  const root = document.documentElement;
  const hex = color.replace('#', '');
  const bigint = Number.parseInt(
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex,
    16,
  );
  const rgb = Number.isFinite(bigint)
    ? `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`
    : '37, 99, 235';

  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-rgb', rgb);
  root.style.setProperty('--el-color-primary', color);
  root.style.setProperty('--el-color-primary-light-3', `${color}b3`);
  root.style.setProperty('--el-color-primary-light-5', `${color}80`);
  root.style.setProperty('--el-color-primary-light-9', `${color}1a`);

  try {
    window.dispatchEvent(new CustomEvent('accent-color-applied', { detail: color }));
  } catch (_e) {}
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

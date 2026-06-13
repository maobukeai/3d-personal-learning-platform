import { ref } from 'vue';
import { preferences, type ThemePreference } from '@/utils/preferences';
import { applyAccentColorToDocument, applyThemeToDocument } from '@/composables/useAppearance';

export function useThemeManager() {
  const currentTheme = ref<ThemePreference>(preferences.getTheme());

  let autoThemeInterval: number | null = null;

  const startAutoThemeInterval = () => {
    stopAutoThemeInterval();
    applyThemeToDocument('glass-auto');
    autoThemeInterval = window.setInterval(() => {
      applyThemeToDocument('glass-auto');
    }, 60000);
  };

  const stopAutoThemeInterval = () => {
    if (autoThemeInterval !== null) {
      clearInterval(autoThemeInterval);
      autoThemeInterval = null;
    }
  };

  const applyTheme = (theme: ThemePreference) => {
    currentTheme.value = theme;
    if (theme === 'glass-auto') {
      startAutoThemeInterval();
    } else {
      stopAutoThemeInterval();
      applyThemeToDocument(theme);
    }
  };

  const applyAccentColor = (color: string) => {
    applyAccentColorToDocument(color);
  };

  const handleThemeChangeExternal = (e: Event) => {
    applyTheme((e as CustomEvent<ThemePreference>).detail);
  };

  const initTheme = () => {
    const storedTheme = preferences.getTheme();
    applyTheme(storedTheme);
    applyAccentColor(preferences.getAccentColor());
    window.addEventListener('theme-changed', handleThemeChangeExternal);
  };

  const cleanupTheme = () => {
    window.removeEventListener('theme-changed', handleThemeChangeExternal);
    stopAutoThemeInterval();
  };

  return {
    currentTheme,
    applyTheme,
    applyAccentColor,
    initTheme,
    cleanupTheme,
  };
}

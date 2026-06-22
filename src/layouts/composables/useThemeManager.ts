import { ref } from 'vue';
import { preferences, type ThemePreference } from '@/utils/preferences';
import { applyAccentColorToDocument, applyThemeToDocument, accentColors } from '@/composables/useAppearance';

export function useThemeManager() {
  const currentTheme = ref<ThemePreference>(preferences.getTheme());

  let autoThemeInterval: number | null = null;
  let autoAccentInterval: number | null = null;

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

  const getIntervalMs = (intervalStr: string): number => {
    switch (intervalStr) {
      case '10s':
        return 10000;
      case '1m':
        return 60000;
      case '5m':
        return 300000;
      case '30m':
        return 1800000;
      default:
        return 60000;
    }
  };

  const applyRandomAccentColor = () => {
    const list = accentColors.map((c) => c.value);
    if (list.length <= 1) return;

    // Get current applied color to make sure the next one is different
    const applied = document.documentElement.style.getPropertyValue('--accent').trim() || preferences.getAccentColor();
    const candidates = list.filter((val) => val.toLowerCase() !== applied.toLowerCase());
    const fallbackList = candidates.length > 0 ? candidates : list;
    const randomColor = fallbackList[Math.floor(Math.random() * fallbackList.length)];

    applyAccentColorToDocument(randomColor);
  };

  const startAutoAccentInterval = (intervalStr: string) => {
    stopAutoAccentInterval();
    applyRandomAccentColor();
    const ms = getIntervalMs(intervalStr);
    autoAccentInterval = window.setInterval(() => {
      applyRandomAccentColor();
    }, ms);
  };

  const stopAutoAccentInterval = () => {
    if (autoAccentInterval !== null) {
      clearInterval(autoAccentInterval);
      autoAccentInterval = null;
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

  const handleAccentChangeExternal = (e: Event) => {
    const detail = (
      e as CustomEvent<{
        color: string;
        mode: 'static' | 'refresh' | 'interval';
        interval: '10s' | '1m' | '5m' | '30m';
      }>
    ).detail;

    if (detail.mode === 'static') {
      stopAutoAccentInterval();
      applyAccentColor(detail.color);
    } else if (detail.mode === 'refresh') {
      stopAutoAccentInterval();
      applyRandomAccentColor();
    } else if (detail.mode === 'interval') {
      startAutoAccentInterval(detail.interval);
    }
  };

  const initAccent = () => {
    const mode = preferences.getAccentColorMode();
    const interval = preferences.getAccentColorInterval();
    const staticColor = preferences.getAccentColor();

    if (mode === 'static') {
      stopAutoAccentInterval();
      applyAccentColor(staticColor);
    } else if (mode === 'refresh') {
      stopAutoAccentInterval();
      applyRandomAccentColor();
    } else if (mode === 'interval') {
      startAutoAccentInterval(interval);
    }
  };

  const initTheme = () => {
    const storedTheme = preferences.getTheme();
    applyTheme(storedTheme);
    initAccent();
    window.addEventListener('theme-changed', handleThemeChangeExternal);
    window.addEventListener('accent-settings-changed', handleAccentChangeExternal);
  };

  const cleanupTheme = () => {
    window.removeEventListener('theme-changed', handleThemeChangeExternal);
    window.removeEventListener('accent-settings-changed', handleAccentChangeExternal);
    stopAutoThemeInterval();
    stopAutoAccentInterval();
  };

  return {
    currentTheme,
    applyTheme,
    applyAccentColor,
    initTheme,
    cleanupTheme,
  };
}

import { ref } from 'vue';
import {
  preferences,
  type ThemePreference,
  type ThemeBackgroundPreference,
} from '@/utils/preferences';
import {
  applyAccentColorToDocument,
  applyThemeToDocument,
  accentColors,
} from '@/composables/useAppearance';

export function useThemeManager() {
  const currentTheme = ref<ThemePreference>(preferences.getTheme());
  const currentBackground = ref<ThemeBackgroundPreference>(preferences.getBackground());
  const isDark = ref(false);

  const updateIsDark = () => {
    isDark.value = document.documentElement.classList.contains('dark');
  };

  let autoThemeInterval: number | null = null;
  let autoAccentInterval: number | null = null;

  const startAutoThemeInterval = () => {
    stopAutoThemeInterval();
    applyThemeToDocument('glass-auto');
    updateIsDark();
    autoThemeInterval = window.setInterval(() => {
      applyThemeToDocument('glass-auto');
      updateIsDark();
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
    const applied =
      document.documentElement.style.getPropertyValue('--accent').trim() ||
      preferences.getAccentColor();
    const candidates = list.filter((val) => val.toLowerCase() !== applied.toLowerCase());
    const fallbackList = candidates.length > 0 ? candidates : list;
    const randomColor = fallbackList[Math.floor(Math.random() * fallbackList.length)];

    applyAccentColorToDocument(randomColor);
  };

  const applyRandomBackground = () => {
    const backgrounds: ThemeBackgroundPreference[] = [
      'grid',
      'aurora',
      'blobs',
      'dots',
      'prism',
      'solid',
    ];
    const current = currentBackground.value;
    const candidates = backgrounds.filter((background) => background !== current);
    const next = candidates[Math.floor(Math.random() * candidates.length)] || current;
    preferences.setBackground(next);
    applyBackground(next);
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
      updateIsDark();
    }
  };

  const applyAccentColor = (color: string) => {
    applyAccentColorToDocument(color);
  };

  const applyBackground = (bg: ThemeBackgroundPreference) => {
    currentBackground.value = bg;
  };

  const handleThemeChangeExternal = (e: Event) => {
    applyTheme((e as CustomEvent<ThemePreference>).detail);
  };

  const handleBackgroundChangeExternal = (e: Event) => {
    applyBackground((e as CustomEvent<ThemeBackgroundPreference>).detail);
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
      if (!window.location.pathname.includes('/share/')) {
        applyRandomBackground();
      }
    } else if (mode === 'interval') {
      startAutoAccentInterval(interval);
    }
  };

  const initTheme = () => {
    const storedTheme = preferences.getTheme();
    const storedBg = preferences.getBackground();
    applyBackground(storedBg);
    applyTheme(storedTheme);
    initAccent();

    window.addEventListener('theme-changed', handleThemeChangeExternal);
    window.addEventListener('background-changed', handleBackgroundChangeExternal);
    window.addEventListener('accent-settings-changed', handleAccentChangeExternal);
  };

  const cleanupTheme = () => {
    window.removeEventListener('theme-changed', handleThemeChangeExternal);
    window.removeEventListener('background-changed', handleBackgroundChangeExternal);
    window.removeEventListener('accent-settings-changed', handleAccentChangeExternal);
    stopAutoThemeInterval();
    stopAutoAccentInterval();
  };

  return {
    currentTheme,
    currentBackground,
    isDark,
    applyTheme,
    applyAccentColor,
    applyBackground,
    initTheme,
    cleanupTheme,
  };
}

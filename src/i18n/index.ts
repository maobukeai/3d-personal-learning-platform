import { createI18n } from 'vue-i18n';
import { ref } from 'vue';
import { preferences, type LocalePreference } from '@/utils/preferences';

type LocaleMessages = Record<string, unknown>;

const localeLoaders: Record<LocalePreference, () => Promise<{ default: LocaleMessages }>> = {
  'zh-CN': () => import('../locales/zh-CN'),
  'en-US': () => import('../locales/en-US'),
};

const loadedLocales = new Set<LocalePreference>();
const initialLocale = preferences.getLanguage();

const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'zh-CN',
  messages: {},
});

// Reactive flag that becomes true once the initial locale messages are loaded.
// Allows the app to mount immediately (without blocking on locale chunk fetch)
// and gate the RouterView behind a lightweight splash until translations are ready.
export const isI18nReady = ref(false);

export const loadLocaleMessages = async (locale: LocalePreference) => {
  if (!loadedLocales.has(locale)) {
    const messages = await localeLoaders[locale]();
    i18n.global.setLocaleMessage(locale, messages.default);
    loadedLocales.add(locale);
  }
};

export const setLocale = async (locale: LocalePreference) => {
  await loadLocaleMessages(locale);
  i18n.global.locale.value = locale;
  preferences.setLanguage(locale);
  document.documentElement.lang = locale;
};

export const setupI18n = async () => {
  await setLocale(initialLocale);
  isI18nReady.value = true;
  return i18n;
};

export default i18n;

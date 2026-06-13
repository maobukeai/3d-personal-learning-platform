import { createI18n } from 'vue-i18n';
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
  return i18n;
};

export default i18n;

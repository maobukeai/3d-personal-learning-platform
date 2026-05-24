import { createI18n } from 'vue-i18n';
import zhCN from '../locales/zh-CN';
import enUS from '../locales/en-US';
import { preferences } from '@/utils/preferences';

const i18n = createI18n({
  legacy: false,
  locale: preferences.getLanguage(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
});

export default i18n;

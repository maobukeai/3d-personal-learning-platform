import { useI18n } from 'vue-i18n';

/**
 * Returns a bilingual label helper that picks English or Chinese
 * based on the current vue-i18n locale.
 */
export const useLabel = () => {
  const { locale } = useI18n();
  return (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);
};

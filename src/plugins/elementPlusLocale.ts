import { watch, type App, type Ref, type WritableComputedRef } from 'vue';
import type { Language } from 'element-plus/es/locale';
import type { LocalePreference } from '@/utils/preferences';

type LocaleRef = Ref<string> | WritableComputedRef<string>;

const localeLoaders: Record<LocalePreference, () => Promise<{ default: Language }>> = {
  'zh-CN': () => import('element-plus/es/locale/lang/zh-cn'),
  'en-US': () => import('element-plus/es/locale/lang/en'),
};

const normalizeLocale = (locale: string): LocalePreference =>
  locale === 'en-US' ? 'en-US' : 'zh-CN';

export const installElementPlusLocaleBridge = (app: App, locale: LocaleRef) => {
  const applyLocale = async (value: string) => {
    const normalizedLocale = normalizeLocale(value);
    const [{ provideGlobalConfig }, messages] = await Promise.all([
      import('element-plus/es/components/config-provider/src/hooks/use-global-config'),
      localeLoaders[normalizedLocale](),
    ]);

    provideGlobalConfig({
      locale: messages.default,
      popper: {
        gpuAcceleration: false,
      },
    } as any, app, true);
  };

  void applyLocale(locale.value);
  watch(locale, (value) => {
    void applyLocale(value);
  });
};

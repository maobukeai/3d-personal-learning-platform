import { reactive, watch } from 'vue';

/**
 * Two-way settings sync boilerplate for admin settings tabs.
 *
 * Extracted from the duplicated `localSettings` + watch pair that previously
 * appeared verbatim in BrandingSettingsTab, GeneralSettingsTab,
 * SecuritySettingsTab, SocialSettingsTab, SmtpSettingsTab,
 * TemplateSettingsTab, and UploadSettingsTab.
 *
 * Creates a local reactive copy of `props.settings`, keeps it in sync when
 * the parent updates, and emits `update:settings` whenever the local copy
 * changes.
 *
 * @param props - component props containing a `settings` record
 * @param emit  - component emit function for `update:settings`
 *
 * @returns `{ localSettings }` — reactive local copy; bind form fields to this.
 */
export function useSettingsSync<T extends Record<string, any>>(
  props: { settings: T },
  emit: (event: 'update:settings', value: T) => void,
) {
  const localSettings = reactive({ ...props.settings }) as T;

  watch(
    () => props.settings,
    (newVal) => {
      Object.assign(localSettings, newVal);
    },
    { deep: true },
  );

  watch(
    localSettings,
    () => {
      emit('update:settings', { ...props.settings, ...localSettings });
    },
    { deep: true },
  );

  return { localSettings };
}

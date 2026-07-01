import { ref, onMounted, onUnmounted } from 'vue';

/**
 * Reactive `isDark` ref that stays in sync with the `<html>` element's
 * `dark` class.
 *
 * Extracted from the duplicated `MutationObserver` + `isDark` block that
 * previously appeared verbatim in AssetDetailModal, MaterialDetailPanel,
 * PluginDetailModal, ResourceSearchDialog, and MarkdownEditor.
 *
 * On mount, a `MutationObserver` watches `document.documentElement` for
 * `class` attribute changes and updates the ref. The observer is
 * automatically disconnected on unmount.
 *
 * @returns `{ isDark }` — reactive boolean ref, `true` when the `dark`
 *          class is present on `<html>`.
 */
export function useThemeObserver() {
  const isDark = ref(document.documentElement.classList.contains('dark'));

  let themeObserver: MutationObserver | null = null;

  onMounted(() => {
    themeObserver = new MutationObserver(() => {
      isDark.value = document.documentElement.classList.contains('dark');
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  });

  onUnmounted(() => {
    if (themeObserver) {
      themeObserver.disconnect();
    }
  });

  return { isDark };
}

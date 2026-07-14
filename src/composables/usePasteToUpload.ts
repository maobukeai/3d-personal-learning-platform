import { ref, onMounted, onUnmounted, type Ref } from 'vue';

interface PasteOptions {
  accept?: string;
  multiple?: boolean;
  disabled?: Ref<boolean> | (() => boolean);
}

// Module-level registry to track which dropzones are currently hovered by the user
const hoveredElements = new Set<HTMLElement>();

function isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  let parent: HTMLElement | null = el;
  while (parent) {
    const style = window.getComputedStyle(parent);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity || '1') === 0
    ) {
      return false;
    }
    parent = parent.parentElement;
  }
  return true;
}

export function usePasteToUpload(
  elementRef: Ref<HTMLElement | null>,
  onFilesPasted: (files: File[]) => void,
  options: PasteOptions = {},
) {
  const isHovered = ref(false);

  const handlePaste = (e: ClipboardEvent) => {
    // If another handler has already consumed the paste event, skip
    if (e.defaultPrevented) return;

    // Check if disabled
    if (options.disabled) {
      const isDisabled =
        typeof options.disabled === 'function' ? options.disabled() : options.disabled.value;
      if (isDisabled) return;
    }

    const activeEl = document.activeElement;

    // Detect if we are focusing an editor or textarea where image pasting is explicitly handled or meaningful.
    const isEditingText =
      activeEl &&
      (activeEl.tagName === 'TEXTAREA' ||
        activeEl.hasAttribute('contenteditable') ||
        activeEl.classList.contains('ProseMirror') ||
        activeEl.classList.contains('tiptap'));

    const hasFocus =
      elementRef.value && (activeEl === elementRef.value || elementRef.value.contains(activeEl));

    // Determine targeting priority:
    // 1. If any dropzone is hovered, only the hovered dropzone should handle the paste.
    // 2. If no dropzone is hovered, but this dropzone or its contents has focus.
    // 3. Global fallback: If no dropzone is hovered/focused, but this dropzone is visible and the user is NOT editing text in a textarea/rich-editor.
    let isTargeted = false;

    if (hoveredElements.size > 0) {
      isTargeted = elementRef.value !== null && hoveredElements.has(elementRef.value);
    } else if (hasFocus) {
      isTargeted = true;
    } else if (!isEditingText && isElementVisible(elementRef.value)) {
      isTargeted = true;
    }

    if (!isTargeted) return;

    const files: File[] = [];
    const clipFiles = e.clipboardData?.files;
    if (!clipFiles || clipFiles.length === 0) return;

    const accept = options.accept || '*';
    const multiple = options.multiple ?? false;

    for (let i = 0; i < clipFiles.length; i++) {
      const file = clipFiles[i];
      if (accept !== '*') {
        const mimeType = file.type;
        const acceptedTypes = accept.split(',').map((t) => t.trim());
        const matches = acceptedTypes.some((type) => {
          if (type.startsWith('.')) {
            // Extension match (e.g. .jpg)
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          } else if (type.endsWith('/*')) {
            // Wildcard MIME match (e.g. image/*)
            const prefix = type.replace('/*', '');
            return mimeType.startsWith(prefix);
          } else {
            // Exact MIME match (e.g. image/png)
            return mimeType === type;
          }
        });
        if (!matches) continue;
      }
      files.push(file);
      if (!multiple) break; // If multiple is false, we only grab the first valid file
    }

    if (files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      onFilesPasted(files);
    }
  };

  const handleMouseEnter = () => {
    isHovered.value = true;
    if (elementRef.value) {
      hoveredElements.add(elementRef.value);
    }
  };
  const handleMouseLeave = () => {
    isHovered.value = false;
    if (elementRef.value) {
      hoveredElements.delete(elementRef.value);
    }
  };

  onMounted(() => {
    window.addEventListener('paste', handlePaste, true);
    if (elementRef.value) {
      elementRef.value.addEventListener('mouseenter', handleMouseEnter);
      elementRef.value.addEventListener('mouseleave', handleMouseLeave);
    }
  });

  onUnmounted(() => {
    window.removeEventListener('paste', handlePaste, true);
    if (elementRef.value) {
      elementRef.value.removeEventListener('mouseenter', handleMouseEnter);
      elementRef.value.removeEventListener('mouseleave', handleMouseLeave);
      hoveredElements.delete(elementRef.value);
    }
  });

  return {
    isHovered,
  };
}

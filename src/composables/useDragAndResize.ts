import { ref, onMounted, onUnmounted, nextTick, isRef, type Ref } from 'vue';

export function useDragAndResize(
  options: {
    initialWidth?: number;
    initialHeight?: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    storageWidthKey?: string;
    storageHeightKey?: string;
    onPostScroll?: () => void;
  } = {},
) {
  const minWidth = options.minWidth ?? 260;
  const minHeight = options.minHeight ?? 300;
  const maxWidth = options.maxWidth ?? 800;
  const maxHeight = options.maxHeight ?? 800;
  const storageWidthKey = options.storageWidthKey ?? 'drag_resize_width';
  const storageHeightKey = options.storageHeightKey ?? 'drag_resize_height';

  const chatBoxWidth = ref(options.initialWidth ?? 380);
  const chatBoxHeight = ref(options.initialHeight ?? 480);
  const isResizing = ref(false);
  const isMaximized = ref(false);

  let resizeType = '';
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;
  let resizeStartX = 0;
  let resizeStartY = 0;

  const position = ref({ bottom: 24, right: 24 });
  const isDragging = ref(false);
  let startX = 0;
  let startY = 0;
  let startBottom = 0;
  let startRight = 0;
  let hasMoved = false;

  const adjustBoxSizeForViewport = () => {
    const maxW = Math.max(minWidth, window.innerWidth - position.value.right - 20);
    if (chatBoxWidth.value > maxW) {
      chatBoxWidth.value = maxW;
    }
    const maxH = Math.max(minHeight, window.innerHeight - position.value.bottom - 90);
    if (chatBoxHeight.value > maxH) {
      chatBoxHeight.value = maxH;
    }
  };

  const onDragStart = (e: MouseEvent | TouchEvent, isOpen: Ref<boolean> | boolean) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('.el-dropdown')
    ) {
      return;
    }

    isDragging.value = true;
    hasMoved = false;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;
    startBottom = position.value.bottom;
    startRight = position.value.right;

    const onDragMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (!isDragging.value) return;
      if ('touches' in moveEvt) {
        moveEvt.preventDefault();
      }

      const currentX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const currentY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        hasMoved = true;
      }

      const nextBottom = startBottom - deltaY;
      const nextRight = startRight - deltaX;

      const opened = isRef(isOpen) ? isOpen.value : isOpen;

      const maxBottom = opened
        ? Math.max(10, window.innerHeight - chatBoxHeight.value - 90)
        : window.innerHeight - 80;
      const maxRight = opened
        ? Math.max(10, window.innerWidth - chatBoxWidth.value - 40)
        : window.innerWidth - 80;

      position.value.bottom = Math.max(10, Math.min(maxBottom, nextBottom));
      position.value.right = Math.max(10, Math.min(maxRight, nextRight));
    };

    const onDragEnd = () => {
      isDragging.value = false;
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('touchend', onDragEnd);
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  };

  const onResizeStart = (e: MouseEvent | TouchEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.value = true;
    resizeType = type;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    resizeStartX = clientX;
    resizeStartY = clientY;
    resizeStartWidth = chatBoxWidth.value;
    resizeStartHeight = chatBoxHeight.value;

    const onResizeMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (!isResizing.value) return;

      const currentX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const currentY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

      const deltaX = currentX - resizeStartX;
      const deltaY = currentY - resizeStartY;

      if (resizeType === 'left' || resizeType === 'top-left') {
        const newWidth = resizeStartWidth - deltaX;
        const maxAllowedWidth = Math.max(minWidth, window.innerWidth - position.value.right - 20);
        chatBoxWidth.value = Math.max(minWidth, Math.min(maxAllowedWidth, maxWidth, newWidth));
      }

      if (resizeType === 'top' || resizeType === 'top-left') {
        const newHeight = resizeStartHeight - deltaY;
        const maxAllowedHeight = Math.max(
          minHeight,
          window.innerHeight - position.value.bottom - 90,
        );
        chatBoxHeight.value = Math.max(minHeight, Math.min(maxAllowedHeight, maxHeight, newHeight));
      }
    };

    const onResizeEnd = () => {
      isResizing.value = false;
      document.removeEventListener('mousemove', onResizeMove);
      document.removeEventListener('mouseup', onResizeEnd);
      document.removeEventListener('touchmove', onResizeMove);
      document.removeEventListener('touchend', onResizeEnd);

      localStorage.setItem(storageWidthKey, chatBoxWidth.value.toString());
      localStorage.setItem(storageHeightKey, chatBoxHeight.value.toString());
    };

    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
    document.addEventListener('touchmove', onResizeMove, { passive: false });
    document.addEventListener('touchend', onResizeEnd);
  };

  const toggleMaximize = () => {
    isMaximized.value = !isMaximized.value;
    nextTick(() => {
      if (options.onPostScroll) {
        options.onPostScroll();
      }
    });
  };

  onMounted(() => {
    const savedWidth = localStorage.getItem(storageWidthKey);
    const savedHeight = localStorage.getItem(storageHeightKey);
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (w >= minWidth && w <= maxWidth) chatBoxWidth.value = w;
    }
    if (savedHeight) {
      const h = parseInt(savedHeight, 10);
      if (h >= minHeight && h <= maxHeight) chatBoxHeight.value = h;
    }
    adjustBoxSizeForViewport();
    window.addEventListener('resize', adjustBoxSizeForViewport);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', adjustBoxSizeForViewport);
  });

  return {
    chatBoxWidth,
    chatBoxHeight,
    isResizing,
    isMaximized,
    position,
    isDragging,
    getHasMoved: () => hasMoved,
    resetHasMoved: () => {
      hasMoved = false;
    },
    onDragStart,
    onResizeStart,
    toggleMaximize,
    adjustBoxSizeForViewport,
  };
}

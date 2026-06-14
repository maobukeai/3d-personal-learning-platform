import { ref, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue';
import { preferences } from '@/utils/preferences';

export function useSpriteDraggable(
  isMobile: Ref<boolean> | ComputedRef<boolean>,
  isFullscreen: Ref<boolean> | ComputedRef<boolean>
) {
  const offsetX = ref(0);
  const offsetY = ref(0);

  const savedPosX = preferences.getAiSpritePosX();
  const savedPosY = preferences.getAiSpritePosY();
  const spriteX = ref<number | null>(savedPosX ? parseFloat(savedPosX) : null);
  const spriteY = ref<number | null>(savedPosY ? parseFloat(savedPosY) : null);

  const isDraggingSprite = ref(false);
  const hasDraggedSprite = ref(false);

  let isDragging = false;
  let startDragX = 0;
  let startDragY = 0;

  let spriteDragStartX = 0;
  let spriteDragStartY = 0;
  let spriteDragInitialX = 0;
  let spriteDragInitialY = 0;

  const clampSpritePosition = () => {
    if (spriteX.value !== null && spriteY.value !== null) {
      const buttonSize = 62;
      spriteX.value = Math.max(10, Math.min(window.innerWidth - buttonSize - 10, spriteX.value));
      spriteY.value = Math.max(10, Math.min(window.innerHeight - buttonSize - 10, spriteY.value));
    }
  };

  // Drag logic for the chat window / sidebar panel
  const startDrag = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      isFullscreen.value ||
      isMobile.value
    ) {
      return;
    }

    isDragging = true;
    startDragX = event.clientX - offsetX.value;
    startDragY = event.clientY - offsetY.value;

    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  const handleDrag = (event: MouseEvent) => {
    if (!isDragging) return;
    offsetX.value = event.clientX - startDragX;
    offsetY.value = event.clientY - startDragY;
  };

  const stopDrag = () => {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  };

  // Sprite Dragging Logic (Mouse)
  const startDragSprite = (event: MouseEvent) => {
    if (event.button !== 0) return;
    isDraggingSprite.value = true;
    hasDraggedSprite.value = false;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    spriteDragInitialX = rect.left;
    spriteDragInitialY = rect.top;

    spriteDragStartX = event.clientX;
    spriteDragStartY = event.clientY;

    document.addEventListener('mousemove', handleDragSprite);
    document.addEventListener('mouseup', stopDragSprite);
  };

  const handleDragSprite = (event: MouseEvent) => {
    if (!isDraggingSprite.value) return;
    const deltaX = event.clientX - spriteDragStartX;
    const deltaY = event.clientY - spriteDragStartY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasDraggedSprite.value = true;
    }

    let newX = spriteDragInitialX + deltaX;
    let newY = spriteDragInitialY + deltaY;
    const buttonSize = 62;
    newX = Math.max(10, Math.min(window.innerWidth - buttonSize - 10, newX));
    newY = Math.max(10, Math.min(window.innerHeight - buttonSize - 10, newY));

    spriteX.value = newX;
    spriteY.value = newY;
  };

  const stopDragSprite = () => {
    isDraggingSprite.value = false;
    document.removeEventListener('mousemove', handleDragSprite);
    document.removeEventListener('mouseup', stopDragSprite);

    if (spriteX.value !== null && spriteY.value !== null) {
      preferences.setAiSpritePosition(spriteX.value, spriteY.value);
    }
  };

  // Sprite Dragging Logic (Touch)
  const startDragSpriteTouch = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];

    isDraggingSprite.value = true;
    hasDraggedSprite.value = false;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    spriteDragInitialX = rect.left;
    spriteDragInitialY = rect.top;

    spriteDragStartX = touch.clientX;
    spriteDragStartY = touch.clientY;

    document.addEventListener('touchmove', handleDragSpriteTouch, { passive: false });
    document.addEventListener('touchend', stopDragSpriteTouch);
  };

  const handleDragSpriteTouch = (event: TouchEvent) => {
    if (!isDraggingSprite.value || event.touches.length !== 1) return;
    const touch = event.touches[0];

    const deltaX = touch.clientX - spriteDragStartX;
    const deltaY = touch.clientY - spriteDragStartY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasDraggedSprite.value = true;
      event.preventDefault(); // Prevent page scrolling while dragging
    }

    let newX = spriteDragInitialX + deltaX;
    let newY = spriteDragInitialY + deltaY;
    const buttonSize = 62;
    newX = Math.max(10, Math.min(window.innerWidth - buttonSize - 10, newX));
    newY = Math.max(10, Math.min(window.innerHeight - buttonSize - 10, newY));

    spriteX.value = newX;
    spriteY.value = newY;
  };

  const stopDragSpriteTouch = () => {
    isDraggingSprite.value = false;
    document.removeEventListener('touchmove', handleDragSpriteTouch);
    document.removeEventListener('touchend', stopDragSpriteTouch);

    if (spriteX.value !== null && spriteY.value !== null) {
      preferences.setAiSpritePosition(spriteX.value, spriteY.value);
    }
  };

  const updateWindowSize = () => {
    clampSpritePosition();
  };

  onMounted(() => {
    window.addEventListener('resize', updateWindowSize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateWindowSize);
  });

  return {
    spriteX,
    spriteY,
    offsetX,
    offsetY,
    isDraggingSprite,
    hasDraggedSprite,
    startDrag,
    startDragSprite,
    startDragSpriteTouch,
    clampSpritePosition,
  };
}

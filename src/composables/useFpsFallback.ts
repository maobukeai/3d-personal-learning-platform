import { ref, onMounted, onUnmounted } from 'vue';

const isFallbackActive = ref(false);

/**
 * Universal Composable to monitor FPS and trigger blur fallback when performance degrades.
 * When FPS drops below 45 for consecutive frames, it disables expensive backdrop-blurs.
 */
export function useFpsFallback() {
  const fps = ref(60);
  let lastTime = performance.now();
  let frameCount = 0;
  let lowFpsCount = 0;
  let animationFrameId: number | null = null;

  const checkFps = () => {
    const now = performance.now();
    frameCount++;

    if (now - lastTime >= 1000) {
      fps.value = Math.round((frameCount * 1000) / (now - lastTime));
      frameCount = 0;
      lastTime = now;

      // Drop threshold check: if FPS < 45, start counting towards fallback
      if (fps.value < 45) {
        lowFpsCount++;
        if (lowFpsCount >= 3) {
          isFallbackActive.value = true;
        }
      } else {
        lowFpsCount = 0;
        isFallbackActive.value = false;
      }
    }

    animationFrameId = requestAnimationFrame(checkFps);
  };

  onMounted(() => {
    lastTime = performance.now();
    frameCount = 0;
    lowFpsCount = 0;
    animationFrameId = requestAnimationFrame(checkFps);
  });

  onUnmounted(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  return {
    fps,
    disableBlur: isFallbackActive,
  };
}

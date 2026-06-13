import { ref, onMounted, onUnmounted } from 'vue';

export const useMobile = (breakpoint = 768) => {
  const isMobile = ref(window.innerWidth < breakpoint);
  let ticking = false;

  const update = () => {
    isMobile.value = window.innerWidth < breakpoint;
    ticking = false;
  };

  const handleResize = () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  };

  onMounted(() => {
    window.addEventListener('resize', handleResize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });

  return {
    isMobile,
  };
};

import { ref, onMounted, onUnmounted } from 'vue';

export const useMobile = (breakpoint = 768) => {
  const isMobile = ref(window.innerWidth < breakpoint);
  
  const handleResize = () => {
    isMobile.value = window.innerWidth < breakpoint;
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

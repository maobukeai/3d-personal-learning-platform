import { ref, onMounted, onUnmounted } from 'vue';

const isMobile = ref(false);
const isSearchOpen = ref(false);
const isMobileSidebarOpen = ref(false);

function updateResponsive() {
  isMobile.value = window.innerWidth < 1024; // Standard desktop breakpoint is usually 1024px
}

export function useAppLayout() {
  const openSearch = () => {
    isSearchOpen.value = true;
  };

  const closeSearch = () => {
    isSearchOpen.value = false;
  };

  const openMobileSidebar = () => {
    isMobileSidebarOpen.value = true;
  };

  const closeMobileSidebar = () => {
    isMobileSidebarOpen.value = false;
  };

  const closeTopmostShellOverlay = () => {
    if (isSearchOpen.value) {
      isSearchOpen.value = false;
      return true;
    }
    if (isMobileSidebarOpen.value) {
      isMobileSidebarOpen.value = false;
      return true;
    }
    return false;
  };

  onMounted(() => {
    updateResponsive();
    window.addEventListener('resize', updateResponsive);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateResponsive);
  });

  return {
    isMobile,
    isSearchOpen,
    isMobileSidebarOpen,
    openSearch,
    closeSearch,
    openMobileSidebar,
    closeMobileSidebar,
    closeTopmostShellOverlay,
  };
}

export type UseAppLayoutReturn = ReturnType<typeof useAppLayout>;

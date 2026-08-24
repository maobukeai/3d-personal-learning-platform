<script lang="ts">
export default {
  name: 'MirrorPortalLayout',
};
</script>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterView } from 'vue-router';
import PortalHeader from '@/views/MirrorPortal/components/PortalHeader.vue';
import PortalBillingModal from '@/views/MirrorPortal/components/PortalBillingModal.vue';
import PortalUserModal from '@/views/MirrorPortal/components/PortalUserModal.vue';
import LoginModal from '@/components/auth/LoginModal.vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const showBillingModal = ref(false);
const showUserModal = ref(false);

function handleOpenLogin() {
  authStore.setShowLoginModal(true);
}

function handleOpenBilling() {
  if (!authStore.isAuthenticated) {
    authStore.setShowLoginModal(true);
    return;
  }
  showBillingModal.value = true;
}

function handleOpenUser() {
  if (!authStore.isAuthenticated) {
    authStore.setShowLoginModal(true);
    return;
  }
  showUserModal.value = true;
}
</script>

<template>
  <div
    class="mirror-portal-layout min-h-screen h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased overflow-hidden selection:bg-blue-500 selection:text-white"
  >
    <!-- Dedicated Top Navigation Header -->
    <PortalHeader
      @open-login="handleOpenLogin"
      @open-billing="handleOpenBilling"
      @open-user="handleOpenUser"
    />

    <!-- Main Content Area -->
    <main class="flex-1 overflow-hidden relative">
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <!-- Global Modals in Portal -->
    <LoginModal />
    <PortalBillingModal v-model:show="showBillingModal" />
    <PortalUserModal v-model:show="showUserModal" @open-billing="showBillingModal = true" />
  </div>
</template>

<style scoped>
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.15s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>

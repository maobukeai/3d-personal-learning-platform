<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';
import { RouterView } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { logError } from '@/utils/error';
import { isI18nReady } from '@/i18n';

const { t } = useI18n();

const hasError = ref(false);
const errorMessage = ref('');

onErrorCaptured((err: Error, _instance, _info) => {
  logError(err, { operation: 'app.globalError', component: 'App' });
  hasError.value = true;
  errorMessage.value = err.message || '发生了未知错误';
  return false;
});

const reload = () => {
  hasError.value = false;
  errorMessage.value = '';
  window.location.reload();
};
</script>

<template>
  <div v-if="hasError" class="flex items-center justify-center min-h-screen bg-[var(--bg-app)]">
    <div class="text-center p-8 max-w-md">
      <div
        class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center"
      >
        <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h2 class="text-xl font-bold text-[var(--text-primary)] mb-2">页面出现错误</h2>
      <p class="text-[var(--text-secondary)] mb-6 text-sm">{{ errorMessage }}</p>
      <button
        type="button"
        class="px-6 py-2.5 bg-[var(--accent)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
        @click="reload"
      >
        {{ t('error.refreshPage') }}
      </button>
    </div>
  </div>
  <!-- Lightweight splash shown until the initial locale messages are loaded.
       App mounts immediately, but we avoid rendering route content before
       translations are ready to prevent a flash of raw translation keys. -->
  <div
    v-else-if="!isI18nReady"
    class="flex items-center justify-center min-h-screen bg-[var(--bg-app)]"
  >
    <div
      class="w-10 h-10 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin"
    ></div>
  </div>
  <template v-else>
    <RouterView />
    <ToastContainer />
    <NotificationContainer />
    <ConfirmContainer />
  </template>
</template>

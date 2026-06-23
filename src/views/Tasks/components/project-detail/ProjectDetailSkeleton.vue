<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-20 opacity-50">
    <div
      class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"
    ></div>
    <p class="text-xs font-bold text-slate-400">{{ t('projects.loadingDetails') }}</p>
  </div>
</template>

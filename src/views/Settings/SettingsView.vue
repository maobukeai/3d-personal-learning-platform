<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  User,
  ShieldCheck,
  ChevronRight,
  Bell,
  Palette,
  Users,
  Download,
} from 'lucide-vue-next';

// Sub-sections decomposed from SettingsView
import ProfileSection from './components/ProfileSection.vue';
import NotificationSection from './components/NotificationSection.vue';
import SecuritySection from './components/SecuritySection.vue';
import AppearanceSection from './components/AppearanceSection.vue';
import TeamsSection from './components/TeamsSection.vue';
import DataSection from './components/DataSection.vue';

const { t } = useI18n();
const route = useRoute();
const activeSection = ref('profile');

const sections = [
  { id: 'profile', label: t('settings.profile'), icon: User },
  { id: 'notifications', label: t('settings.notifications'), icon: Bell },
  { id: 'security', label: t('settings.account'), icon: ShieldCheck },
  { id: 'appearance', label: t('settings.appearance'), icon: Palette },
  { id: 'teams', label: t('settings.teams'), icon: Users },
  { id: 'data', label: t('settings.dangerZone'), icon: Download },
];

onMounted(() => {
  if (route.query.tab) {
    activeSection.value = route.query.tab as string;
  }
});

watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab) activeSection.value = newTab as string;
  },
);
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <div
      class="h-14 md:h-16 px-3 sm:px-6 flex items-center justify-between shrink-0 border-b transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">
          {{ t('settings.title') }}
        </h1>
      </div>
    </div>

    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <!-- Sidebar Navigation -->
      <div
        class="w-full lg:w-64 border-b lg:border-b-0 lg:border-r shrink-0 overflow-x-auto lg:overflow-y-auto px-4 py-3 lg:p-4 transition-colors duration-300 scrollbar-hide sticky top-0 z-10"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <div class="px-4 mb-4 hidden lg:block">
          <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-400">设置选项</h2>
        </div>
        <nav class="flex lg:flex-col gap-1.5 lg:gap-1 pb-1 lg:pb-0">
          <button
v-for="section in sections" :key="section.id" type="button" class="flex-none w-auto lg:w-full flex items-center justify-between px-3 py-2.5 lg:px-4 lg:py-3 rounded-xl text-xs lg:text-sm font-medium transition-all shrink-0 whitespace-nowrap" :class="
              activeSection === section.id
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
            " @click="activeSection = section.id">
            <div class="flex items-center gap-2 lg:gap-3">
              <component :is="section.icon" class="w-4 h-4 shrink-0" />
              <span>{{ section.label }}</span>
            </div>
            <ChevronRight class="w-3.5 h-3.5 opacity-50 hidden lg:block" />
          </button>
        </nav>
      </div>

      <!-- Main Section Content -->
      <div class="flex-1 overflow-y-auto px-4 py-6 lg:p-12 scrollbar-hide">
        <div class="max-w-6xl mx-auto">
          <ProfileSection v-if="activeSection === 'profile'" />
          <NotificationSection v-else-if="activeSection === 'notifications'" />
          <SecuritySection v-else-if="activeSection === 'security'" />
          <AppearanceSection v-else-if="activeSection === 'appearance'" />
          <TeamsSection v-else-if="activeSection === 'teams'" />
          <DataSection v-else-if="activeSection === 'data'" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.animate-in {
  animation: animate-in 0.5s ease-out;
}
@keyframes animate-in {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

<script setup lang="ts">
import { Search, Globe, Loader2, Users } from 'lucide-vue-next';
import TeamCard from '@/components/TeamCard.vue';
import Button from '@/components/ui/Button.vue';
import type { ExploreTeam } from './exploreTeamsTypes';

defineProps<{
  teams: ExploreTeam[];
  myTeamIds: Set<string>;
  applyingIds: Set<string>;
  isLoading: boolean;
  searchQuery: string;
  t: (key: string, ...args: unknown[]) => string;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', val: string): void;
  (e: 'view', team: ExploreTeam): void;
  (e: 'join', team: ExploreTeam): void;
  (e: 'enter', team: ExploreTeam): void;
  (e: 'create'): void;
}>();
</script>

<template>
  <main
    class="flex-1 flex flex-col min-w-0 p-3 sm:p-5 lg:p-6 overflow-hidden relative z-10 mobile-adaptive"
  >
    <div
      class="w-full flex-1 flex flex-col min-h-0 space-y-3 lg:space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200"
    >
      <div
        class="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 pb-2 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0 w-full"
      >
        <h2
          class="text-base sm:text-lg lg:text-xl font-black flex items-center gap-2 sm:gap-3"
          style="color: var(--text-primary)"
        >
          <div
            class="w-7 h-7 bg-accent/10 rounded-lg flex items-center justify-center border border-accent/20 shadow-2xs"
          >
            <Globe class="w-3.5 h-3.5 text-accent" />
          </div>
          <span>{{ t('teams.discoverTeams') }}</span>
          <span
            class="text-xs font-black text-accent bg-accent/8 dark:bg-accent/15 px-2.5 py-0.5 rounded-full border border-accent/10"
            >{{ teams.length }}</span
          >
        </h2>

        <div class="flex justify-center w-full mobile-row">
          <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
            <Search />
            <input
              :value="searchQuery"
              type="text"
              :placeholder="t('teams.searchPlaceholder')"
              @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>

        <div class="hidden sm:block"></div>
      </div>

      <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
        <div v-if="isLoading" class="flex flex-col items-center justify-center h-full py-20">
          <Loader2 class="w-10 h-10 text-accent animate-spin" />
          <p class="mt-5 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">
            {{ t('teams.loading') }}
          </p>
        </div>

        <div
          v-else-if="teams.length > 0"
          class="grid sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5 pb-6 teams-grid"
        >
          <TeamCard
            v-for="(group, index) in teams"
            :key="group.id"
            :team="group"
            :is-joined="myTeamIds.has(group.id)"
            :is-applying="applyingIds.has(group.id)"
            :index="index"
            @click="emit('view', group)"
            @join="emit('join', group)"
            @enter="emit('enter', group)"
          />
        </div>

        <div
          v-else
          class="flex flex-col items-center justify-center h-full min-h-[300px] rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 p-6"
        >
          <Users class="w-14 h-14 opacity-10 mb-5" style="color: var(--text-muted)" />
          <h4 class="text-xl font-black mb-2" style="color: var(--text-primary)">
            {{ t('teams.noMatchingTeams') }}
          </h4>
          <p class="text-xs font-medium text-slate-400 text-center max-w-sm">
            {{ t('teams.noMatchingTeamsSub') }}
          </p>
          <Button
            variant="primary"
            class="!mt-8 !px-8 !py-3.5 !rounded-xl font-black text-xs hover:scale-105 transition-all shadow-lg shadow-accent/20"
            @click="emit('create')"
          >
            {{ t('teams.createFirstTeam') }}
          </Button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

@media (max-width: 767px) {
  .teams-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 375px) {
  .teams-grid {
    grid-template-columns: 1fr;
  }
}
</style>

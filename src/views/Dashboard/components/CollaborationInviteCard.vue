<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Users } from 'lucide-vue-next';
import api from '@/utils/api';
import type { Team } from '@/types';

const router = useRouter();
const teams = ref<Team[]>([]);
const totalTeamsCount = ref(0);

const fetchTeams = async () => {
  try {
    const response = await api.get('/api/teams/public');
    const allTeams = (response.data || []) as Team[];
    teams.value = allTeams.slice(0, 4);
    totalTeamsCount.value = allTeams.length;
  } catch (error) {
    console.error('Failed to fetch public teams:', error);
  }
};

const getRandomGradient = (name: string) => {
  const gradients = [
    'bg-rose-600',
    'bg-amber-600',
    'bg-emerald-600',
    'bg-blue-600',
    'bg-slate-600',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return gradients[sum % gradients.length];
};

onMounted(() => {
  fetchTeams();
});
</script>

<template>
  <div class="p-4 sm:p-5 blender-card">
    <div class="flex items-center gap-2.5 mb-3">
      <div class="p-2 bg-accent-subtle rounded-lg border border-accent/10">
        <Users class="w-4 h-4 text-accent" />
      </div>
      <h3 class="font-bold text-sm sm:text-base" style="color: var(--text-primary)">
        团队协作
      </h3>
    </div>
    <p class="text-xs sm:text-sm leading-relaxed mb-4" style="color: var(--text-secondary)">
      加入一个兴趣小组，与志同道合的伙伴一起完成大型渲染项目。
    </p>
    <div class="flex -space-x-1.5 mb-4">
      <template v-if="teams.length > 0">
        <div
          v-for="team in teams"
          :key="team.id"
          class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white select-none overflow-hidden shrink-0"
          style="border-color: var(--bg-card)"
          :title="team.name"
        >
          <img v-if="team.avatarUrl" alt="" :src="team.avatarUrl" class="w-full h-full object-cover" />
          <div
            v-else
            class="w-full h-full flex items-center justify-center"
            :class="getRandomGradient(team.name)"
          >
            {{ team.name.substring(0, 1).toUpperCase() }}
          </div>
        </div>
        <div
          v-if="totalTeamsCount > 4"
          class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-secondary);
          "
        >
          +{{ totalTeamsCount - 4 }}
        </div>
      </template>
      <template v-else>
        <div
          v-for="(letter, idx) in ['K', 'J', 'Y', 'H']"
          :key="idx"
          class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white select-none shrink-0"
          style="border-color: var(--bg-card)"
          :class="[
            idx === 0 ? 'bg-rose-600' : '',
            idx === 1 ? 'bg-amber-600' : '',
            idx === 2 ? 'bg-emerald-600' : '',
            idx === 3 ? 'bg-blue-600' : '',
          ]"
        >
          {{ letter }}
        </div>
        <div
          class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-secondary);
          "
        >
          +5
        </div>
      </template>
    </div>
    <button type="button" class="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs sm:text-sm font-bold transition-opacity hover:opacity-90 cursor-pointer" @click="router.push('/explore-teams')">
      寻找团队伙伴
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Users } from 'lucide-vue-next';
import api from '@/utils/api';

const router = useRouter();
const teams = ref<any[]>([]);
const totalTeamsCount = ref(0);

const fetchTeams = async () => {
  try {
    const response = await api.get('/api/teams/public');
    const allTeams = response.data || [];
    teams.value = allTeams.slice(0, 4);
    totalTeamsCount.value = allTeams.length;
  } catch (error) {
    console.error('Failed to fetch public teams:', error);
  }
};

const getRandomGradient = (name: string) => {
  const gradients = [
    'bg-gradient-to-tr from-pink-500 to-rose-400',
    'bg-gradient-to-tr from-amber-500 to-orange-400',
    'bg-gradient-to-tr from-emerald-500 to-teal-400',
    'bg-gradient-to-tr from-blue-500 to-indigo-400',
    'bg-gradient-to-tr from-purple-500 to-violet-400',
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
  <div class="p-3.5 sm:p-4 glass-card bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
    <div class="flex items-center gap-2.5 mb-2">
      <div class="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
        <Users class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
      </div>
      <h3 class="font-bold text-sm sm:text-base" style="color: var(--text-primary)">
        团队协作
      </h3>
    </div>
    <p class="text-xs sm:text-sm leading-relaxed mb-2 sm:mb-3" style="color: var(--text-secondary)">
      加入一个兴趣小组，与志同道合的伙伴一起完成大型渲染项目。
    </p>
    <div class="flex -space-x-1.5 mb-3 sm:mb-3.5">
      <template v-if="teams.length > 0">
        <div
          v-for="team in teams"
          :key="team.id"
          class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-white shadow-md select-none overflow-hidden shrink-0"
          style="border-color: var(--bg-card)"
          :title="team.name"
        >
          <img v-if="team.avatarUrl" :src="team.avatarUrl" class="w-full h-full object-cover" />
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
          class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0"
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
          class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-white shadow-md select-none shrink-0"
          style="border-color: var(--bg-card)"
          :class="[
            idx === 0 ? 'bg-gradient-to-tr from-pink-500 to-rose-400' : '',
            idx === 1 ? 'bg-gradient-to-tr from-amber-500 to-orange-400' : '',
            idx === 2 ? 'bg-gradient-to-tr from-emerald-500 to-teal-400' : '',
            idx === 3 ? 'bg-gradient-to-tr from-blue-500 to-indigo-400' : '',
          ]"
        >
          {{ letter }}
        </div>
        <div
          class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0"
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
    <button
      class="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs sm:text-sm font-bold transition-transform hover:scale-[1.02] cursor-pointer"
      @click="router.push('/explore-teams')"
    >
      寻找团队伙伴
    </button>
  </div>
</template>

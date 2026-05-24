<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { Users, ExternalLink } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { fetchTeams, type TeamWorkspaceResponse } from '@/services/workspace.service';

const authStore = useAuthStore();

const myTeams = ref<TeamWorkspaceResponse[]>([]);
const isLoadingTeams = ref(false);

const fetchMyTeams = async () => {
  isLoadingTeams.value = true;
  try {
    myTeams.value = await fetchTeams();
  } catch (error) {
    console.error('Fetch teams error:', error);
  } finally {
    isLoadingTeams.value = false;
  }
};

onMounted(() => {
  fetchMyTeams();
});
</script>

<template>
  <div class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold" style="color: var(--text-primary)">我的团队</h2>
        <p class="text-xs mt-1" style="color: var(--text-secondary)">
          管理你创建或加入的所有协作团队
        </p>
      </div>
    </div>

    <div v-if="isLoadingTeams" class="space-y-4">
      <div
        v-for="i in 3"
        :key="i"
        class="h-24 rounded-3xl bg-slate-100 dark:bg-white/5 animate-pulse"
      ></div>
    </div>

    <div v-else-if="myTeams.length > 0" class="grid gap-4">
      <div
        v-for="team in myTeams"
        :key="team.id"
        class="p-6 rounded-3xl border flex items-center justify-between transition-all hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-none"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold text-lg">
            {{ team.name.charAt(0) }}
          </div>
          <div>
            <h3 class="font-bold" style="color: var(--text-primary)">{{ team.name }}</h3>
            <div class="flex items-center gap-3 mt-1">
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500">
                {{ team._count?.members || 0 }} 名成员
              </span>
              <span
                v-if="team.ownerId === authStore.user?.id"
                class="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold"
              >创建者</span>
            </div>
          </div>
        </div>
        <RouterLink
          :to="`/team/${team.id}`"
          class="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-accent transition-all"
        >
          <ExternalLink class="w-5 h-5" />
        </RouterLink>
      </div>
    </div>

    <div
      v-else
      class="text-center py-20 border-2 border-dashed rounded-3xl transition-colors duration-300"
      style="border-color: var(--border-base)"
    >
      <div class="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
        <Users class="w-8 h-8 text-slate-300" />
      </div>
      <h3 class="text-sm font-bold mb-1" style="color: var(--text-primary)">暂无团队</h3>
      <p class="text-xs text-slate-400 mb-6">你还没有加入任何团队，快去创建一个吧！</p>
    </div>
  </div>
</template>

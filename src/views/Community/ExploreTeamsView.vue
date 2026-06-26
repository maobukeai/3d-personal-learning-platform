<script setup lang="ts">
import { getApiErrorMessage, logError } from '@/utils/error';
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCommunityI18n } from '@/composables/useCommunityI18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import CreateTeamDialog from '@/components/CreateTeamDialog.vue';
import GroupDetailDialog from '@/components/GroupDetailDialog.vue';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import ExploreTeamsSidebar from './components/ExploreTeamsSidebar.vue';
import ExploreTeamsGrid from './components/ExploreTeamsGrid.vue';
import type { ExploreTeam } from './components/exploreTeamsTypes';

const router = useRouter();
const workspaceStore = useWorkspaceStore();
const { t } = useCommunityI18n();

const isCreateTeamVisible = ref(false);
const isDetailVisible = ref(false);

const selectedTeam = ref<ExploreTeam | null>(null);
const searchQuery = ref('');
const isLoading = ref(false);
const publicTeams = ref<ExploreTeam[]>([]);
const myTeamIds = ref<Set<string>>(new Set());
const applyingIds = ref<Set<string>>(new Set());
const activeTeamsCount = ref(0);

const fetchData = async () => {
  isLoading.value = true;
  try {
    const [publicRes, myRes, statsRes] = await Promise.all([
      api.get('/api/teams/public', { params: { search: searchQuery.value } }),
      api.get('/api/teams'),
      api.get('/api/teams/stats'),
    ]);
    publicTeams.value = publicRes.data;
    myTeamIds.value = new Set((myRes.data as ExploreTeam[]).map((team) => team.id));
    activeTeamsCount.value = statsRes.data.activeTeamsCount || 0;
  } catch (error) {
    logError(error, { operation: 'teams.fetchPublic', component: 'ExploreTeamsView' });
    ElMessage.error(t('teams.fetchFailed'));
  } finally {
    isLoading.value = false;
  }
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchData, 400);
});

const handleTeamCreated = (team: ExploreTeam | null) => {
  workspaceStore.fetchWorkspaces();
  if (team?.id) {
    router.push(`/team/${team.id}`);
  } else {
    router.push('/dashboard');
  }
};

const handleApplyToJoin = async (group: ExploreTeam | null) => {
  if (!group) return;
  if (myTeamIds.value.has(group.id)) {
    router.push(`/team/${group.id}`);
    return;
  }

  try {
    await ElMessageBox.confirm(
      t('teams.applyConfirmMsg', { name: group.name }),
      t('teams.applyConfirmTitle'),
      {
        confirmButtonText: t('common.submit') || '提交申请',
        cancelButtonText: t('common.cancel') || '取消',
        type: 'info',
        customClass: 'custom-rounded-dialog',
      },
    );
    applyingIds.value.add(group.id);
    await api.post('/api/teams/apply', { teamId: group.id });
    ElMessage.success(
      t('teams.applySuccess', { name: group.name }) ||
        `申请已提交！等待 "${group.name}" 管理员审批`,
    );
    fetchData();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, t('teams.applyFailed') || '申请失败，请稍后重试'));
    }
  } finally {
    applyingIds.value.delete(group.id);
    isDetailVisible.value = false;
  }
};

const handleViewTeam = (group: ExploreTeam) => {
  selectedTeam.value = group;
  isDetailVisible.value = true;
};

const handleEnterTeam = (group: ExploreTeam) => {
  router.push(`/team/${group.id}`);
};

onMounted(() => {
  fetchData();
});

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <div
    class="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative mobile-adaptive"
    style="background-color: var(--bg-app)"
  >
    <div
      class="absolute inset-0 overflow-hidden pointer-events-none opacity-50 dark:opacity-20 hidden md:block"
    >
      <div
        class="absolute -left-[5%] top-[5%] w-[40%] h-[40%] bg-accent/10 rounded-full glass-glow-xl animate-pulse"
      ></div>
      <div
        class="absolute -right-[5%] top-[10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full glass-glow-xl animate-pulse"
        style="animation-delay: 2s"
      ></div>
    </div>

    <ExploreTeamsSidebar
      :active-teams-count="activeTeamsCount"
      :t="t"
      @create="isCreateTeamVisible = true"
    />

    <ExploreTeamsGrid
      v-model:search-query="searchQuery"
      :teams="publicTeams"
      :my-team-ids="myTeamIds"
      :applying-ids="applyingIds"
      :is-loading="isLoading"
      :t="t"
      @view="handleViewTeam"
      @join="handleApplyToJoin"
      @enter="handleEnterTeam"
      @create="isCreateTeamVisible = true"
    />

    <CreateTeamDialog v-model:visible="isCreateTeamVisible" @success="handleTeamCreated" />

    <GroupDetailDialog
      v-model:visible="isDetailVisible"
      :group="selectedTeam"
      @join="handleApplyToJoin(selectedTeam)"
    />
  </div>
</template>

<style scoped>
@keyframes float {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
  }
}

.animate-in {
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
</style>

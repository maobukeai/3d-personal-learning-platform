<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Users,
  Plus,
  Search,
  ArrowRight,
  Sparkles,
  Trophy,
  Globe,
  Loader2,
  ChevronLeft,
  Layers,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import CreateTeamDialog from '@/components/CreateTeamDialog.vue';
import GroupDetailDialog from '@/components/GroupDetailDialog.vue';
import TeamCard from '@/components/TeamCard.vue';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';

const router = useRouter();
const workspaceStore = useWorkspaceStore();
const { t: i18nT } = useI18n();
const t = (key: string, ...args: unknown[]) => {
  const prefixes = ['showcase.', 'teams.', 'members.', 'teamDetail.', 'discussions.', 'chat.'];
  if (prefixes.some((p) => key.startsWith(p))) {
    return (i18nT as (key: string, ...args: unknown[]) => string)(`community.${key}`, ...args);
  }
  return (i18nT as (key: string, ...args: unknown[]) => string)(key, ...args);
};

const isCreateTeamVisible = ref(false);
const isDetailVisible = ref(false);

interface ExploreTeam {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  memberCount?: number;
  _count?: {
    members?: number;
  };
}

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
    myTeamIds.value = new Set((myRes.data as ExploreTeam[]).map((t) => t.id));
    activeTeamsCount.value = statsRes.data.activeTeamsCount || 0;
  } catch (error) {
    console.error('Fetch teams error:', error);
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

onMounted(() => {
  fetchData();
});

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <div
    class="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative"
    style="background-color: var(--bg-app)"
  >
    <!-- Animated Background Elements -->
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

    <!-- Left Sidebar Panel: Info, Benefits, and Create Team -->
    <aside
      class="w-full md:w-80 lg:w-[360px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/20 backdrop-blur-xl p-4 sm:p-6 lg:p-7 flex flex-col justify-between overflow-y-auto custom-scrollbar gap-6 relative z-10"
    >
      <div class="flex flex-col gap-6">
        <!-- Back Button -->
        <Button
          variant="glass"
          size="sm"
          :icon="ChevronLeft"
          class="!rounded-full !py-0.5 !px-3 !h-7 hover:!text-accent transition-all text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] self-start shadow-sm"
          @click="router.back()"
        >
          {{ t('teams.back') }}
        </Button>

        <!-- Title & Intro -->
        <div>
          <div
            class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-accent/10 backdrop-blur-md border border-accent/20 text-accent rounded-full mb-3"
          >
            <Sparkles class="w-2.5 h-2.5" />
            <span class="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">{{
              t('teams.title')
            }}</span>
          </div>
          <h1
            class="text-xl sm:text-2xl font-black tracking-tight leading-tight"
            style="color: var(--text-primary)"
          >
            {{ t('teams.collaborateTitle') }}
            <span
              class="text-transparent bg-clip-text bg-gradient-to-r from-accent via-blue-400 to-indigo-500 block mt-1"
              >{{ t('teams.collaborateSub') }}</span
            >
          </h1>
          <p class="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            {{ t('teams.welcomeText') }}
          </p>
        </div>

        <!-- Vertical Benefit Items -->
        <div class="flex flex-col gap-2.5">
          <div
            class="flex items-center gap-3 px-3 py-2.5 bg-white/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-2xs hover:border-accent/20 transition-all duration-300"
          >
            <div class="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Layers class="w-4 h-4 text-accent" />
            </div>
            <div>
              <div class="font-black" style="color: var(--text-primary)">
                {{ t('teams.assetLib') }}
              </div>
              <div class="text-[10px] text-slate-400 font-medium mt-0.5">
                共享模型、资源与学习成果
              </div>
            </div>
          </div>

          <div
            class="flex items-center gap-3 px-3 py-2.5 bg-white/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-2xs hover:border-accent/20 transition-all duration-300"
          >
            <div
              class="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0"
            >
              <Users class="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div class="font-black" style="color: var(--text-primary)">
                {{ t('teams.realtimeCollab') }}
              </div>
              <div class="text-[10px] text-slate-400 font-medium mt-0.5">
                多人实时编辑、协作与评论
              </div>
            </div>
          </div>

          <div
            class="flex items-center gap-3 px-3 py-2.5 bg-white/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-2xs hover:border-accent/20 transition-all duration-300"
          >
            <div
              class="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"
            >
              <Trophy class="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div class="font-black" style="color: var(--text-primary)">
                {{ t('teams.tutorSupport') }}
              </div>
              <div class="text-[10px] text-slate-400 font-medium mt-0.5">
                行业大咖、导师在线答疑解惑
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Team Card at bottom -->
      <div
        class="group relative bg-white/80 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-2xl hover:shadow-lg hover:border-accent transition-all duration-300 cursor-pointer overflow-hidden mt-6 shadow-2xs"
        @click="isCreateTeamVisible = true"
      >
        <div
          class="absolute -right-6 -top-6 w-20 h-20 bg-accent/10 rounded-full blur-2xl group-hover:bg-accent/20 transition-colors duration-700"
        ></div>

        <div class="relative z-10 flex items-center gap-3.5 mb-2">
          <div
            class="w-9 h-9 bg-gradient-to-br from-accent to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-accent/20 group-hover:rotate-6 transition-all"
          >
            <Plus class="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3
              class="text-sm sm:text-base font-black tracking-tight"
              style="color: var(--text-primary)"
            >
              {{ t('teams.createTitle') }}
            </h3>
            <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Start Now
            </div>
          </div>
        </div>

        <p class="text-xs text-slate-500 dark:text-slate-400 mb-3.5 leading-relaxed font-medium">
          {{ t('teams.createSub') }}
        </p>

        <div class="flex items-center justify-between">
          <div
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] sm:text-xs bg-accent text-white rounded-lg font-black uppercase tracking-wider shadow-md shadow-accent/20"
          >
            {{ t('teams.startCreate') }} <ArrowRight class="w-3 h-3" />
          </div>
          <div class="text-right">
            <div class="text-base font-black leading-none" style="color: var(--text-primary)">
              {{ activeTeamsCount }}
            </div>
            <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {{ t('teams.activeTeams') }}
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Right Panel: Discovery List area -->
    <main class="flex-1 flex flex-col min-w-0 p-3 sm:p-5 lg:p-6 overflow-hidden relative z-10">
      <div
        class="w-full flex-1 flex flex-col min-h-0 space-y-3 lg:space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200"
      >
        <!-- Exploration Header -->
        <div
          class="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 pb-2 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0 w-full"
        >
          <!-- Left Section -->
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
              >{{ publicTeams.length }}</span
            >
          </h2>

          <!-- Center Section (Search) -->
          <div class="flex justify-center w-full">
            <Input
              v-model="searchQuery"
              type="text"
              :placeholder="t('teams.searchPlaceholder')"
              :icon="Search"
              class="w-full sm:w-64 md:w-80 animate-in fade-in"
              input-class="!py-1.5 !rounded-xl !text-xs"
            />
          </div>

          <!-- Right Offset Section for balancing -->
          <div class="hidden sm:block"></div>
        </div>

        <!-- Content Grid Container - Scrollable -->
        <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
          <!-- Loading -->
          <div v-if="isLoading" class="flex flex-col items-center justify-center h-full py-20">
            <Loader2 class="w-10 h-10 text-accent animate-spin" />
            <p
              class="mt-5 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse"
            >
              {{ t('teams.loading') }}
            </p>
          </div>

          <!-- Team Grid - Responsive Columns -->
          <div
            v-else-if="publicTeams.length > 0"
            class="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5 pb-6"
          >
            <TeamCard
              v-for="(group, index) in publicTeams"
              :key="group.id"
              :team="group"
              :is-joined="myTeamIds.has(group.id)"
              :is-applying="applyingIds.has(group.id)"
              :index="index"
              @click="handleViewTeam"
              @join="handleApplyToJoin"
              @enter="(team) => router.push(`/team/${team.id}`)"
            />
          </div>

          <!-- Empty State -->
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
              @click="isCreateTeamVisible = true"
            >
              {{ t('teams.createFirstTeam') }}
            </Button>
          </div>
        </div>
      </div>
    </main>

    <!-- Create Team Dialog -->
    <CreateTeamDialog v-model:visible="isCreateTeamVisible" @success="handleTeamCreated" />

    <!-- Team Detail Dialog -->
    <GroupDetailDialog
      v-model:visible="isDetailVisible"
      :group="selectedTeam"
      @join="handleApplyToJoin(selectedTeam)"
    />
  </div>
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

/* Custom easing for entrance animations */
.animate-in {
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

.group:hover :deep(svg) {
  transform: translateX(-3px);
  transition: transform 0.2s ease;
}
</style>

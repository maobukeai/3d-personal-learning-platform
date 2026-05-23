<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
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

const router = useRouter();
const workspaceStore = useWorkspaceStore();

const isCreateTeamVisible = ref(false);
const isDetailVisible = ref(false);
const selectedTeam = ref<any>(null);
const searchQuery = ref('');
const isLoading = ref(false);
const publicTeams = ref<any[]>([]);
const myTeamIds = ref<Set<string>>(new Set());
const applyingIds = ref<Set<string>>(new Set());

const fetchData = async () => {
  isLoading.value = true;
  try {
    const [publicRes, myRes] = await Promise.all([
      api.get('/api/teams/public', { params: { search: searchQuery.value } }),
      api.get('/api/teams'),
    ]);
    publicTeams.value = publicRes.data;
    myTeamIds.value = new Set(myRes.data.map((t: any) => t.id));
  } catch (error) {
    console.error('Fetch teams error:', error);
    ElMessage.error('获取小组失败');
  } finally {
    isLoading.value = false;
  }
};

let debounceTimer: any = null;
watch(searchQuery, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchData, 400);
});

const handleTeamCreated = (team: any) => {
  workspaceStore.fetchWorkspaces();
  if (team?.id) {
    router.push(`/team/${team.id}`);
  } else {
    router.push('/dashboard');
  }
};

const handleApplyToJoin = async (group: any) => {
  if (!group) return;
  if (myTeamIds.value.has(group.id)) {
    router.push(`/team/${group.id}`);
    return;
  }

  try {
    await ElMessageBox.confirm(
      `你正在申请加入 "${group.name}"，申请信息将发送给团队管理员。`,
      '申请加入团队',
      {
        confirmButtonText: '提交申请',
        cancelButtonText: '取消',
        type: 'info',
        customClass: 'custom-rounded-dialog',
      },
    );
    applyingIds.value.add(group.id);
    await api.post('/api/teams/apply', { teamId: group.id });
    ElMessage.success(`申请已提交！等待 "${group.name}" 管理员审批`);
    fetchData();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '申请失败，请稍后重试');
    }
  } finally {
    applyingIds.value.delete(group.id);
    isDetailVisible.value = false;
  }
};

const handleViewTeam = (group: any) => {
  selectedTeam.value = group;
  isDetailVisible.value = true;
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div
    class="flex-1 flex flex-col min-h-screen overflow-y-auto lg:overflow-hidden relative"
    style="background-color: var(--bg-app)"
  >
    <!-- Animated Background Elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none opacity-50 dark:opacity-20">
      <div
        class="absolute -left-[5%] top-[5%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] animate-pulse"
      ></div>
      <div
        class="absolute -right-[5%] top-[10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse"
        style="animation-delay: 2s"
      ></div>
    </div>
    <!-- Consolidated Hero Section -->
    <div class="relative px-4 sm:px-6 lg:px-10 pt-4 lg:pt-6 pb-4 lg:pb-6 overflow-hidden shrink-0">
      <div class="w-full relative z-10">
        <!-- Back Button -->
        <button
          class="inline-flex items-center gap-2 text-slate-400 hover:text-accent transition-all mb-3 lg:mb-4 group px-3 py-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full border border-white/20 dark:border-slate-700/50 shadow-sm"
          @click="router.back()"
        >
          <ChevronLeft class="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span class="text-xs font-black uppercase tracking-[0.2em]">返回</span>
        </button>

        <div class="flex flex-col lg:flex-row items-center gap-6 lg:gap-12">
          <!-- Info Content -->
          <div class="flex-1 animate-in fade-in slide-in-from-left-6 duration-700">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 backdrop-blur-md border border-accent/20 text-accent rounded-full mb-2 lg:mb-3 shadow-sm"
            >
              <Sparkles class="w-3 h-3" />
              <span class="text-[10px] font-black uppercase tracking-wider">3D 协作社区</span>
            </div>
            <h1
              class="text-2xl lg:text-4xl font-black tracking-tight leading-tight"
              style="color: var(--text-primary)"
            >
              找到属于你的
              <span
                class="text-transparent bg-clip-text bg-gradient-to-r from-accent via-blue-400 to-indigo-500"
                >创意团队</span
              >
            </h1>
            <p
              class="mt-2 lg:mt-3 text-xs lg:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium max-w-2xl"
            >
              在这里，你可以创建自己的学习小组，或者加入志同道合的团队。共享资产、协作项目，共同见证创意的诞生。
            </p>

            <!-- Small Benefits Tags - Hidden on very small screens to save space -->
            <div class="hidden sm:flex flex-wrap gap-3 mt-5">
              <div
                class="flex items-center gap-2 px-2.5 py-1.5 bg-white/40 dark:bg-slate-800/40 rounded-xl border border-white/40 dark:border-slate-700/40 text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400"
              >
                <Layers class="w-3.5 h-3.5 text-accent" /> 专属资产库
              </div>
              <div
                class="flex items-center gap-2 px-2.5 py-1.5 bg-white/40 dark:bg-slate-800/40 rounded-xl border border-white/40 dark:border-slate-700/40 text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400"
              >
                <Users class="w-3.5 h-3.5 text-purple-400" /> 实时协作
              </div>
              <div
                class="flex items-center gap-2 px-2.5 py-1.5 bg-white/40 dark:bg-slate-800/40 rounded-xl border border-white/40 dark:border-slate-700/40 text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400"
              >
                <Trophy class="w-3.5 h-3.5 text-amber-400" /> 导师辅导
              </div>
            </div>
          </div>

          <!-- Create Team Card -->
          <div
            class="w-full lg:w-72 shrink-0 animate-in fade-in slide-in-from-right-6 duration-700"
          >
            <div
              class="group relative bg-white/80 dark:bg-slate-800/80 p-4 lg:p-5 rounded-[24px] border-2 border-white/40 dark:border-slate-700/40 backdrop-blur-2xl hover:shadow-xl hover:border-accent transition-all duration-500 cursor-pointer overflow-hidden"
              @click="isCreateTeamVisible = true"
            >
              <div
                class="absolute -right-6 -top-6 w-32 h-32 bg-accent/10 rounded-full blur-2xl group-hover:bg-accent/20 transition-colors duration-700"
              ></div>

              <div class="relative z-10 flex items-center gap-4 mb-3 lg:mb-4">
                <div
                  class="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-accent to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-accent/40 group-hover:rotate-6 transition-all"
                >
                  <Plus class="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <div>
                  <h3 class="text-lg lg:text-xl font-black tracking-tight" style="color: var(--text-primary)">
                    创建团队
                  </h3>
                  <div
                    class="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5"
                  >
                    Start Now
                  </div>
                </div>
              </div>

              <p
                class="text-xs text-slate-500 dark:text-slate-400 mb-4 lg:mb-5 leading-relaxed font-medium"
              >
                主导项目架构，邀请精英成员加入协作。
              </p>

              <div class="flex items-center justify-between">
                <div
                  class="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs bg-accent text-white rounded-xl font-black uppercase tracking-wider shadow-md shadow-accent/20"
                >
                  开始创建 <ArrowRight class="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                </div>
                <div class="text-right">
                  <div class="text-lg lg:text-xl font-black leading-none" style="color: var(--text-primary)">
                    100+
                  </div>
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    活跃团队
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Section - Fills Width & Height -->
    <div class="flex-1 flex flex-col min-h-0 px-4 sm:px-6 lg:px-10 pb-4 overflow-visible lg:overflow-hidden">
      <div
        class="w-full flex-1 flex flex-col min-h-0 space-y-4 lg:space-y-5 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200"
      >
        <!-- Exploration Header -->
        <div
          class="flex flex-col md:flex-row md:items-center justify-between gap-3 lg:gap-4 pb-2 lg:pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0"
        >
          <h2
            class="text-xl lg:text-2xl font-black flex items-center gap-3"
            style="color: var(--text-primary)"
          >
            <div
              class="w-8 h-8 bg-accent rounded-xl flex items-center justify-center shadow-md shadow-accent/20"
            >
              <Globe class="w-4 h-4 text-white" />
            </div>
            发现公开小组
            <span
              class="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full"
              >{{ publicTeams.length }}</span
            >
          </h2>

          <div class="relative w-full md:w-96 group">
            <Search
              class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-all"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索小组名称..."
              class="w-full pl-12 pr-6 py-2.5 lg:py-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border-2 rounded-[20px] focus:border-accent outline-none transition-all text-xs lg:text-sm font-medium shadow-sm"
              style="border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>
        </div>

        <!-- Content Grid Container - Scrollable & Full Width -->
        <div class="flex-1 overflow-visible lg:overflow-y-auto pr-2 -mr-2 scrollbar-custom min-h-0">
          <!-- Loading -->
          <div v-if="isLoading" class="flex flex-col items-center justify-center h-full py-20">
            <Loader2 class="w-10 h-10 text-accent animate-spin" />
            <p class="mt-5 text-xs font-black text-slate-400 uppercase tracking-widest">
              连接中...
            </p>
          </div>

          <!-- Team Grid - Responsive Columns -->
          <div
            v-else-if="publicTeams.length > 0"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6 pb-6"
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
            class="flex flex-col items-center justify-center h-full rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10"
          >
            <Users class="w-14 h-14 opacity-10 mb-6" style="color: var(--text-muted)" />
            <h4 class="text-2xl font-black mb-2" style="color: var(--text-primary)">
              暂无匹配小组
            </h4>
            <p class="text-sm font-medium text-slate-400 text-center">
              试着精简搜索词，或点燃创意的火花。
            </p>
            <button
              class="mt-10 px-10 py-4 bg-accent text-white rounded-xl font-black text-sm shadow-lg shadow-accent/20 hover:scale-105 transition-all"
              @click="isCreateTeamVisible = true"
            >
              创建首个小组
            </button>
          </div>
        </div>
      </div>
    </div>

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
.scrollbar-custom::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-custom::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-custom::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
.scrollbar-custom::-webkit-scrollbar-thumb:hover {
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
</style>

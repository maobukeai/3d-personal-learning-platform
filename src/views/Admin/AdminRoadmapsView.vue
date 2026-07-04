<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, onMounted, computed } from 'vue';

import {
  Plus,
  Trash2,
  Edit2,
  Milestone,
  Search,
  FolderOpen,
  Calendar,
  Layers3,
  Layers,
  BookOpen,
  Flame,
  ArrowRight,
  RefreshCw,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchManagementInsights } from './adminManagementInsights';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import AdminHeader from './components/AdminHeader.vue';
import AdminRoadmapEditDialog from './components/AdminRoadmapEditDialog.vue';
import type { Roadmap } from '@/types';

const roadmaps = ref<Roadmap[]>([]);
const isLoading = ref(true);
const showEditModal = ref(false);
const currentRoadmap = ref<Roadmap | null>(null);

const searchQuery = ref('');

const filteredRoadmaps = computed(() => {
  if (!searchQuery.value) return roadmaps.value;
  const query = searchQuery.value.toLowerCase();
  return roadmaps.value.filter(
    (r) => r.title?.toLowerCase().includes(query) || r.description?.toLowerCase().includes(query),
  );
});

// Calculate metrics for dashboard summary cards
const totalRoadmapsCount = computed(() => roadmaps.value.length);
const totalStepsCount = computed(() => {
  return roadmaps.value.reduce((acc, curr) => acc + (curr.steps?.length || 0), 0);
});

const getBadgeVariant = (label: string) => {
  if (label === '正常' || label === '稳定') return 'success';
  if (label === '关注') return 'warning';
  if (label === '高压') return 'danger';
  return 'primary';
};

const consolidatedCards = computed(() => {
  const roadmapsVal = roadmaps.value;
  const totalRoadmaps = roadmapsVal.length;
  const totalSteps = roadmapsVal.reduce((acc, curr) => acc + (curr.steps?.length || 0), 0);
  const avgSteps = totalRoadmaps > 0 ? Math.round(totalSteps / totalRoadmaps) : 0;
  const completeRoadmaps = roadmapsVal.filter((r) => r.steps && r.steps.length > 0).length;

  return [
    {
      label: '官方路线',
      value: totalRoadmaps,
      hint: '已发布官方路线图谱',
      icon: Milestone,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      health: { label: '正常' },
    },
    {
      label: '路线节点',
      value: totalSteps,
      hint: `平均 ${avgSteps} 节点/路线`,
      icon: Layers3,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: '稳定' },
    },
    {
      label: '完整路线',
      value: completeRoadmaps,
      hint: '已配置步骤节点的路线',
      icon: BookOpen,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health: { label: '正常' },
    },
    {
      label: '运营状态',
      value: '正常',
      hint: '路线运营状态稳定',
      icon: Flame,
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      health: { label: '稳定' },
    },
  ];
});

const fetchRoadmaps = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/admin/roadmaps', { params: { page: 1, limit: 100 } });
    roadmaps.value = Array.isArray(data) ? data : data.data;
    fetchManagementInsights(true);
  } catch (error) {
    logError(error, { operation: 'admin.fetchRoadmaps', component: 'AdminRoadmapsView' });
  } finally {
    isLoading.value = false;
  }
};

const openEditModal = (roadmap: Roadmap | null = null) => {
  currentRoadmap.value = roadmap;
  showEditModal.value = true;
};

const handleDeleteRoadmap = async (id: string) => {
  try {
    await ElMessageBox.confirm(t('admin.are_you_sure_you_13'), t('admin.delete_confirmation'), {
      confirmButtonText: t('admin.confirm_deletion_1'),
      cancelButtonText: t('admin.cancel'),
      type: 'warning',
    });
  } catch {
    return;
  }

  try {
    isLoading.value = true;
    await api.delete(`/api/admin/roadmaps/${id}`);
    await fetchRoadmaps();
  } catch (error) {
    logError(error, { operation: 'admin.deleteRoadmap', component: 'AdminRoadmapsView' });
    ElMessage.error(t('admin.deletion_failed_please_try'));
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchRoadmaps();
});
</script>

<template>
  <div
    class="admin-roadmaps-page flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)] mobile-adaptive"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide">
      <!-- Ultra-Compact Single Row Header -->
      <AdminHeader
        title="官方学习路线管理"
        subtitle="定义和维护官方 3D 学习图谱"
        :cards="consolidatedCards"
        v-model="searchQuery"
        :placeholder="$t('admin.find_official_routes_quickly')"
      >
        <template #title-badge>
          <div class="flex items-center gap-1.5">
            <Badge variant="info"> 官方路线: {{ totalRoadmapsCount }} </Badge>
            <Badge variant="info"> 核心步骤总数: {{ totalStepsCount }} </Badge>
          </div>
        </template>

        <Button
          variant="primary"
          size="sm"
          :icon="Plus"
          @click="openEditModal()"
          class="!h-7.5 !text-xs !px-2.5"
        >
          新建学习路线
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchRoadmaps"
          class="!h-7.5 !text-xs !px-2.5"
        >
          刷新
        </Button>
      </AdminHeader>

      <!-- Workspace layout: Single Column Workspace -->
      <div class="mt-3 w-full min-w-0">
        <div class="space-y-3 min-w-0">
          <!-- Loading State -->
          <div
            v-if="isLoading"
            class="flex flex-col items-center justify-center py-32 text-slate-400"
          >
            <div class="relative w-16 h-16 flex items-center justify-center">
              <div class="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
              <div
                class="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"
              ></div>
              <Milestone class="w-6 h-6 text-indigo-500 animate-pulse" />
            </div>
            <p class="text-xs font-black tracking-widest text-indigo-500/70 mt-6 uppercase">
              Syncing with database...
            </p>
          </div>

          <!-- Empty State -->
          <div
            v-else-if="filteredRoadmaps.length === 0"
            class="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto"
          >
            <div
              class="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 flex items-center justify-center mb-6 shadow-inner text-slate-400"
            >
              <FolderOpen class="w-8 h-8" />
            </div>
            <h3 class="text-md font-bold mb-2" style="color: var(--text-primary)">
              {{ $t('admin.no_learning_route_found') }}
            </h3>
            <p class="text-xs text-slate-400 leading-relaxed mb-6">
              目前没有已发布的官方路线，或者搜索关键字未匹配到任何结果。点击右上角即可新建官方教学路径。
            </p>
            <button
              type="button"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/10 cursor-pointer whitespace-nowrap"
              @click="openEditModal()"
            >
              <Plus class="w-4 h-4" />
              <span>{{ $t('admin.create_the_first_official') }}</span>
            </button>
          </div>

          <!-- Roadmaps Grid List -->
          <div
            v-else
            class="max-w-none grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 mobile-grid"
          >
            <div
              v-for="roadmap in filteredRoadmaps"
              :key="roadmap.id"
              class="group relative rounded-2xl border flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <!-- Neon border glow effect on hover -->
              <div
                class="absolute inset-0 border border-indigo-500/0 group-hover:border-indigo-500/20 pointer-events-none rounded-2xl transition-all duration-300"
              ></div>

              <!-- Top Gradient Accent -->
              <div
                class="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400 opacity-60"
              ></div>

              <div class="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <!-- Header Row -->
                  <div class="flex items-start justify-between mb-3 gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div
                        class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20"
                      >
                        <Milestone class="w-4 h-4" />
                      </div>
                      <div class="min-w-0">
                        <h3
                          class="font-bold text-sm mb-0.5 truncate"
                          style="color: var(--text-primary)"
                        >
                          {{ roadmap.title }}
                        </h3>
                        <div class="flex items-center gap-1.5">
                          <span
                            class="px-1 py-0.2 rounded text-[8px] font-extrabold bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200/50 dark:border-white/5"
                          >
                            {{ roadmap.steps?.length || 0 }} 个步骤
                          </span>
                          <span class="text-[8px] text-slate-400 flex items-center gap-0.5">
                            <Flame class="w-2 h-2 text-indigo-500 animate-pulse" />
                            系统发布
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Quick Metadata Actions -->
                    <div class="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        class="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-indigo-500 transition-colors"
                        :title="$t('admin.edit_entire_route')"
                        @click="openEditModal(roadmap)"
                      >
                        <Edit2 class="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        class="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors"
                        :title="$t('admin.cascading_delete_routes')"
                        @click="handleDeleteRoadmap(roadmap.id)"
                      >
                        <Trash2 class="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <!-- Roadmap Description -->
                  <p
                    class="text-[11px] text-slate-400 dark:text-slate-400 leading-normal mb-3.5 line-clamp-2"
                  >
                    {{ roadmap.description || $t('admin.there_is_no_route') }}
                  </p>

                  <!-- Step Outline Pipeline Visualization -->
                  <div
                    v-if="roadmap.steps && roadmap.steps.length > 0"
                    class="space-y-2 mb-4 bg-slate-50/50 dark:bg-white/2 p-3 rounded-xl border border-slate-200/30 dark:border-white/5"
                  >
                    <div
                      class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"
                    >
                      <BookOpen class="w-2.5 h-2.5 text-indigo-500" />
                      <span>{{ $t('admin.core_knowledge_outline_preview') }}</span>
                    </div>

                    <div
                      class="relative pl-3.5 space-y-2 before:absolute before:left-[3px] before:top-1.5 before:bottom-1.5 before:w-[1px] before:bg-slate-200 dark:before:bg-white/5"
                    >
                      <div
                        v-for="step in roadmap.steps.slice(0, 3)"
                        :key="step.id"
                        class="relative flex items-center gap-2.5 text-left"
                      >
                        <div
                          class="absolute -left-[14px] top-1 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900"
                        ></div>
                        <div class="min-w-0 flex-1">
                          <h4
                            class="text-[11px] font-bold truncate"
                            style="color: var(--text-primary)"
                          >
                            {{ step.title }}
                          </h4>
                          <p class="text-[8px] text-slate-400 truncate mt-0.2">
                            {{ step.description }}
                          </p>
                        </div>
                      </div>

                      <!-- Over-limit step counter indicator -->
                      <div
                        v-if="roadmap.steps.length > 3"
                        class="pt-0.5 text-[8px] text-indigo-500/90 font-black flex items-center gap-1 pl-0.5"
                      >
                        <span>{{
                          $t('admin.there_are_also_roadmap', { count: roadmap.steps.length - 3 })
                        }}</span>
                        <ArrowRight class="w-2.5 h-2.5" />
                      </div>
                    </div>
                  </div>

                  <!-- No steps placeholder -->
                  <div
                    v-else
                    class="py-4 text-center bg-slate-50/50 dark:bg-white/2 rounded-xl border border-dashed border-slate-200 dark:border-white/5 text-slate-400 mb-4 flex flex-col items-center justify-center gap-1"
                  >
                    <Layers class="w-4 h-4 opacity-40" />
                    <span class="text-[10px] font-medium">{{
                      $t('admin.the_current_route_does_1')
                    }}</span>
                  </div>
                </div>

                <!-- Card Footer Metadata -->
                <div
                  class="pt-3 border-t flex items-center justify-between text-[9px] text-slate-400"
                  style="border-color: var(--border-base)"
                >
                  <div class="flex items-center gap-1">
                    <Calendar class="w-3 h-3 opacity-60" />
                    <span>{{
                      $t('admin.update_time_value', {
                        time: roadmap.createdAt
                          ? new Date(roadmap.createdAt).toLocaleDateString()
                          : '-',
                      })
                    }}</span>
                  </div>
                  <button
                    type="button"
                    class="text-[10px] font-black text-indigo-500 hover:text-indigo-600 transition-colors flex items-center gap-0.5"
                    @click="openEditModal(roadmap)"
                  >
                    <span>{{ $t('admin.enter_the_editor') }}</span>
                    <ArrowRight class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <AdminRoadmapEditDialog
      v-model:show="showEditModal"
      :roadmap="currentRoadmap"
      @saved="fetchRoadmaps"
    />
  </div>
</template>

<style scoped>
.admin-roadmaps-page {
  height: 100%;
  min-height: 0;
  background: transparent;
  color: var(--text-primary);
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

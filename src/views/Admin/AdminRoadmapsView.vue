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
  X,
  ChevronUp,
  ChevronDown,
  Layers,
  Info,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  FolderOpen,
  Calendar,
  Layers3,
  Flame,
  ArrowRight,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminOpsPanel from './components/AdminOpsPanel.vue';
import { fetchManagementInsights } from './adminManagementInsights';

interface RoadmapStep {
  id?: string;
  title: string;
  description?: string | null;
  subtasks?: string[] | string | null;
  order: number;
}

interface Roadmap {
  id: string;
  title: string;
  description?: string | null;
  steps?: RoadmapStep[];
  createdAt?: string;
  updatedAt?: string;
}

interface RoadmapFormStep {
  id?: string;
  title: string;
  description: string;
  subtasks: string[];
  order: number;
}

const roadmaps = ref<Roadmap[]>([]);
const isLoading = ref(true);
const showEditModal = ref(false);
const currentRoadmap = ref<Roadmap | null>(null);

const editForm = ref({
  title: '',
  description: '',
  steps: [] as RoadmapFormStep[],
});

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

const fetchRoadmaps = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/admin/roadmaps', { params: { page: 1, limit: 100 } });
    roadmaps.value = Array.isArray(data) ? data : data.data;
    fetchManagementInsights(true);
  } catch (error) {
    console.error('Fetch roadmaps error:', error);
  } finally {
    isLoading.value = false;
  }
};

const openEditModal = (roadmap: Roadmap | null = null) => {
  currentRoadmap.value = roadmap;
  if (roadmap) {
    editForm.value = {
      title: roadmap.title || '',
      description: roadmap.description || '',
      // Deep clone existing steps so that local edits don't leak until saved
      steps: roadmap.steps
        ? roadmap.steps.map((s) => {
            let subtasksArr: string[] = [];
            if (s.subtasks) {
              try {
                const parsed = typeof s.subtasks === 'string' ? JSON.parse(s.subtasks) : s.subtasks;
                subtasksArr = Array.isArray(parsed)
                  ? parsed.filter((item): item is string => typeof item === 'string')
                  : [];
              } catch (e) {
                console.error('Parse step subtasks error:', e);
              }
            }
            return {
              id: s.id,
              title: s.title || '',
              description: s.description || '',
              subtasks: Array.isArray(subtasksArr) ? subtasksArr : [],
              order: s.order || 0,
            };
          })
        : [],
    };
  } else {
    editForm.value = {
      title: '',
      description: '',
      steps: [
        {
          title: t('admin.phase_1_core_basic'),
          description: t('admin.introduce_basic_tool_interface'),
          subtasks: [
            t('admin.build_basic_scene_viewport'),
            t('admin.understand_common_geometric_models'),
            t('admin.proficient_in_modeling_using'),
          ],
          order: 1,
        },
        {
          title: t('admin.stage_2_in_depth'),
          description: t('admin.introduce_advanced_editing_instructions'),
          subtasks: [
            t('admin.use_the_subdivision_modifier'),
            t('admin.complete_the_uv_unfolding'),
            t('admin.debug_hdri_ambient_rendering'),
          ],
          order: 2,
        },
      ],
    };
  }
  showEditModal.value = true;
};

const addStep = () => {
  editForm.value.steps.push({
    title: '',
    description: '',
    subtasks: [],
    order: editForm.value.steps.length + 1,
  });
};

const removeStep = (index: number) => {
  editForm.value.steps.splice(index, 1);
  editForm.value.steps.forEach((step, idx) => {
    step.order = idx + 1;
  });
};

const moveStepUp = (index: number) => {
  if (index === 0) return;
  const temp = editForm.value.steps[index];
  editForm.value.steps[index] = editForm.value.steps[index - 1];
  editForm.value.steps[index - 1] = temp;
  editForm.value.steps.forEach((step, idx) => {
    step.order = idx + 1;
  });
};

const moveStepDown = (index: number) => {
  if (index === editForm.value.steps.length - 1) return;
  const temp = editForm.value.steps[index];
  editForm.value.steps[index] = editForm.value.steps[index + 1];
  editForm.value.steps[index + 1] = temp;
  editForm.value.steps.forEach((step, idx) => {
    step.order = idx + 1;
  });
};

const handleSaveRoadmap = async () => {
  if (!editForm.value.title.trim()) {
    ElMessage.warning(t('admin.please_enter_the_learning'));
    return;
  }

  // Clean steps with empty titles
  const validSteps = editForm.value.steps.filter((s) => s.title.trim());
  if (validSteps.length === 0) {
    try {
      await ElMessageBox.confirm(t('admin.the_current_route_does'), t('admin.save_confirmation'), {
        confirmButtonText: t('admin.continue_to_save'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
      });
    } catch {
      return;
    }
  }

  // Double check orders before submission and construct subtasks array
  const formattedSteps = validSteps.map((step, idx) => {
    const subtasks = step.subtasks
      ? step.subtasks.map((t: string) => t.trim()).filter(Boolean)
      : [];
    return {
      id: step.id,
      title: step.title,
      description: step.description,
      subtasks,
      order: idx + 1,
    };
  });

  const payload = {
    title: editForm.value.title,
    description: editForm.value.description,
    steps: formattedSteps,
  };

  try {
    isLoading.value = true;
    if (currentRoadmap.value) {
      await api.put(`/api/admin/roadmaps/${currentRoadmap.value.id}`, payload);
    } else {
      await api.post('/api/admin/roadmaps', payload);
    }
    showEditModal.value = false;
    await fetchRoadmaps();
  } catch (error) {
    console.error('Save roadmap error:', error);
    ElMessage.error(t('admin.saving_failed_please_check'));
  } finally {
    isLoading.value = false;
  }
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
    console.error('Delete roadmap error:', error);
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
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Header (超紧凑双行版) -->
    <div
      class="relative shrink-0 border-b overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- 极光背景装饰 -->
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-sm border border-indigo-500/20"
          >
            <Milestone class="w-4 h-4" />
          </span>
          <div>
            <h1
              class="text-sm font-black tracking-tight flex items-center gap-1.5"
              style="color: var(--text-primary)"
            >
              官方学习路线管理
              <span
                class="px-1.5 py-0.5 rounded text-[8px] bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-bold uppercase tracking-widest scale-90"
                >Official Only</span
              >
            </h1>
            <p class="text-[10px] text-slate-400 font-medium hidden xs:block">
              在这里定义、更新和维护官方推出的 3D 节点学习图谱
            </p>
          </div>
        </div>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all shadow-md shadow-indigo-500/15 cursor-pointer whitespace-nowrap hover:scale-102"
          @click="openEditModal()"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{{ $t('admin.create_a_new_learning') }}</span>
        </button>
      </div>

      <!-- Row 2: 条件筛选与快速搜索 -->
      <div
        class="px-4 sm:px-8 py-2 flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
      >
        <!-- 统计 Pills -->
        <div class="flex flex-wrap items-center gap-2 max-w-full shrink-0">
          <span
            class="px-2.5 py-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 text-[10px] sm:text-[11px] font-bold flex items-center gap-1.5 shrink-0"
          >
            <Milestone class="w-3 h-3" />
            <span>{{ $t('admin.official_route') }}</span>
            <span class="opacity-60 font-black">({{ totalRoadmapsCount }})</span>
          </span>
          <span
            class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] sm:text-[11px] font-bold flex items-center gap-1.5 shrink-0"
          >
            <Layers3 class="w-3 h-3" />
            <span>{{ $t('admin.total_number_of_core') }}</span>
            <span class="opacity-60 font-black">{{ totalStepsCount }}</span>
          </span>
        </div>

        <!-- 检索工具 -->
        <div
          class="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0"
        >
          <div class="relative flex-1 md:flex-none md:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="$t('admin.find_official_routes_quickly')"
              class="w-full pl-9 pr-7 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              @click="searchQuery = ''"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <AdminOpsPanel scope="roadmaps" />

      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-32 text-slate-400">
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
        class="max-w-none grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6"
      >
        <div
          v-for="roadmap in filteredRoadmaps"
          :key="roadmap.id"
          class="group relative rounded-3xl border flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <!-- Neon border glow effect on hover -->
          <div
            class="absolute inset-0 border border-indigo-500/0 group-hover:border-indigo-500/20 pointer-events-none rounded-3xl transition-all duration-300"
          ></div>

          <!-- Top Gradient Accent -->
          <div
            class="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400 opacity-60"
          ></div>

          <div class="p-6 flex-1 flex flex-col justify-between">
            <div>
              <!-- Header Row -->
              <div class="flex items-start justify-between mb-4 gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20"
                  >
                    <Milestone class="w-5 h-5" />
                  </div>
                  <div class="min-w-0">
                    <h3
                      class="font-bold text-md mb-0.5 truncate"
                      style="color: var(--text-primary)"
                    >
                      {{ roadmap.title }}
                    </h3>
                    <div class="flex items-center gap-2">
                      <span
                        class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200/50 dark:border-white/5"
                      >
                        {{ roadmap.steps?.length || 0 }} 个步骤节点
                      </span>
                      <span class="text-[9px] text-slate-400 flex items-center gap-0.5">
                        <Flame class="w-2.5 h-2.5 text-indigo-500 animate-pulse" />
                        系统发布
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Quick Metadata Actions -->
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    class="p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-indigo-500 transition-colors"
                    :title="$t('admin.edit_entire_route')"
                    @click="openEditModal(roadmap)"
                  >
                    <Edit2 class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors"
                    :title="$t('admin.cascading_delete_routes')"
                    @click="handleDeleteRoadmap(roadmap.id)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Roadmap Description -->
              <p
                class="text-xs text-slate-400 dark:text-slate-400 leading-relaxed mb-6 line-clamp-2"
              >
                {{ roadmap.description || $t('admin.there_is_no_route') }}
              </p>

              <!-- Step Outline Pipeline Visualization -->
              <div
                v-if="roadmap.steps && roadmap.steps.length > 0"
                class="space-y-3 mb-6 bg-slate-50/50 dark:bg-white/2 p-4 rounded-2xl border border-slate-200/30 dark:border-white/5"
              >
                <div
                  class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"
                >
                  <BookOpen class="w-3 h-3 text-indigo-500" />
                  <span>{{ $t('admin.core_knowledge_outline_preview') }}</span>
                </div>

                <div
                  class="relative pl-4 space-y-3 before:absolute before:left-[4px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200 dark:before:bg-white/5"
                >
                  <div
                    v-for="step in roadmap.steps.slice(0, 3)"
                    :key="step.id"
                    class="relative flex items-center gap-3 text-left"
                  >
                    <div
                      class="absolute -left-[15px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900"
                    ></div>
                    <div class="min-w-0 flex-1">
                      <h4 class="text-xs font-bold truncate" style="color: var(--text-primary)">
                        {{ step.title }}
                      </h4>
                      <p class="text-[9px] text-slate-400 truncate mt-0.5">
                        {{ step.description }}
                      </p>
                    </div>
                  </div>

                  <!-- Over-limit step counter indicator -->
                  <div
                    v-if="roadmap.steps.length > 3"
                    class="pt-1 text-[10px] text-indigo-500/90 font-black flex items-center gap-1 pl-1"
                  >
                    <span>{{
                      $t('admin.there_are_also_roadmap', { count: roadmap.steps.length - 3 })
                    }}</span>
                    <ArrowRight class="w-3 h-3" />
                  </div>
                </div>
              </div>

              <!-- No steps placeholder -->
              <div
                v-else
                class="py-6 text-center bg-slate-50/50 dark:bg-white/2 rounded-2xl border border-dashed border-slate-200 dark:border-white/5 text-slate-400 mb-6 flex flex-col items-center justify-center gap-1.5"
              >
                <Layers class="w-5 h-5 opacity-40" />
                <span class="text-xs font-medium">{{ $t('admin.the_current_route_does_1') }}</span>
              </div>
            </div>

            <!-- Card Footer Metadata -->
            <div
              class="pt-4 border-t flex items-center justify-between text-[10px] text-slate-400"
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

    <!-- Unified Edit Modal (One-stop Roadmap & Steps Editor) -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-5xl rounded-[32px] p-6 sm:p-8 shadow-2xl transition-colors duration-300 flex flex-col max-h-[90vh] overflow-hidden relative"
        style="background-color: var(--bg-card); border: 1px solid var(--border-base)"
      >
        <!-- Top Neon Stripe Accent -->
        <div
          class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500"
        ></div>

        <!-- Modal Header -->
        <div
          class="flex items-center justify-between border-b pb-4 mb-6"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-center gap-2">
            <span
              class="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
            >
              <Layers class="w-5 h-5" />
            </span>
            <div>
              <h3
                class="text-lg font-bold flex items-center gap-2"
                style="color: var(--text-primary)"
              >
                {{
                  currentRoadmap
                    ? t('admin.edit_official_learning_route')
                    : $t('admin.arrange_a_new_learning')
                }}
              </h3>
              <p class="text-[10px] text-slate-400">
                在这里统一进行路线元数据配置以及高精度节点流的增删、行内编辑和顺序调整
              </p>
            </div>
          </div>
          <button
            type="button"
            class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            @click="showEditModal = false"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Split Grid Container (Scrollable) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto pr-1 flex-1 pb-4">
          <!-- Left Column (lg:col-span-5): Basic Information -->
          <div class="lg:col-span-5 space-y-5">
            <div
              class="p-5 rounded-2xl bg-slate-50/50 dark:bg-white/2 border border-slate-200/50 dark:border-white/5 space-y-4"
            >
              <div
                class="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5"
              >
                <Info class="w-3.5 h-3.5" />
                <span>{{ $t('admin.basic_attribute_configuration') }}</span>
              </div>

              <div>
                <label
                  class="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider"
                  >{{ $t('admin.route_title') }}</label
                >
                <input
                  v-model="editForm.title"
                  type="text"
                  :placeholder="$t('admin.for_example_3d_character')"
                  class="w-full px-4 py-2.5 rounded-xl border transition-all outline-none text-xs font-bold"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                />
              </div>

              <div>
                <label
                  class="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider"
                  >{{ $t('admin.core_description') }}</label
                >
                <textarea
                  v-model="editForm.description"
                  rows="4"
                  :placeholder="$t('admin.briefly_describe_the_learning_1')"
                  class="w-full px-4 py-2.5 rounded-xl border transition-all outline-none resize-none text-xs leading-relaxed"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                ></textarea>
              </div>
            </div>

            <!-- Standard Guide Card -->
            <div
              class="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-slate-400 space-y-3"
            >
              <div
                class="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5"
              >
                <HelpCircle class="w-3.5 h-3.5 text-indigo-500" />
                <span>{{ $t('admin.suggestions_on_teaching_arrangement') }}</span>
              </div>
              <ul class="text-[10px] leading-relaxed space-y-2 text-slate-400">
                <li class="flex items-start gap-1.5">
                  <span class="text-indigo-500 mt-0.5">•</span>
                  <span
                    ><strong>{{ $t('admin.clear_steps') }}</strong
                    >{{ $t('admin.the_goal_of_each') }}</span
                  >
                </li>
                <li class="flex items-start gap-1.5">
                  <span class="text-indigo-500 mt-0.5">•</span>
                  <span
                    ><strong>{{ $t('admin.reasonable_step_size') }}</strong
                    >{{ $t('admin.the_official_route_recommends') }}</span
                  >
                </li>
                <li class="flex items-start gap-1.5">
                  <span class="text-indigo-500 mt-0.5">•</span>
                  <span
                    ><strong>{{ $t('admin.lossless_upgrade') }}</strong
                    >{{ $t('admin.for_the_route_being') }}</span
                  >
                </li>
              </ul>
            </div>
          </div>

          <!-- Right Column (lg:col-span-7): Steps Composer -->
          <div class="lg:col-span-7 flex flex-col h-full min-h-[300px]">
            <div class="flex items-center justify-between mb-3">
              <div
                class="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5"
              >
                <Layers3 class="w-3.5 h-3.5" />
                <span>{{ $t('admin.learning_stage_node_design') }}</span>
                <span
                  class="px-1.5 py-0.5 text-[9px] font-extrabold rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/25"
                >
                  {{ editForm.steps.length }} 节点
                </span>
              </div>

              <button
                type="button"
                class="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-500/30 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all text-[10px] font-black cursor-pointer"
                @click="addStep"
              >
                <Plus class="w-3 h-3" />
                <span>{{ $t('admin.add_new_steps') }}</span>
              </button>
            </div>

            <!-- Steps Scroll Container -->
            <div
              class="flex-1 overflow-y-auto space-y-4 max-h-[42vh] pr-2 scrollbar-hide border border-dashed border-slate-200/50 dark:border-white/5 rounded-2xl p-4 bg-slate-50/20 dark:bg-white/1"
            >
              <!-- Empty Steps State -->
              <div
                v-if="editForm.steps.length === 0"
                class="py-12 flex flex-col items-center justify-center text-slate-400 gap-2"
              >
                <Layers class="w-8 h-8 opacity-30" />
                <p class="text-xs font-medium">{{ $t('admin.there_are_currently_no_1') }}</p>
                <button
                  type="button"
                  class="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white text-[10px] font-bold border border-indigo-500/20 transition-all cursor-pointer"
                  @click="addStep"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>{{ $t('admin.add_first_step') }}</span>
                </button>
              </div>

              <!-- Steps List with Dynamic Connected Lines -->
              <div v-else class="relative space-y-4">
                <div
                  v-for="(step, index) in editForm.steps"
                  :key="index"
                  class="group/step relative rounded-2xl border p-4 bg-white dark:bg-slate-900 transition-all duration-300 hover:shadow-md hover:border-indigo-500/20"
                  style="border-color: var(--border-base)"
                >
                  <div class="flex items-start gap-3">
                    <!-- Left Rank Indicator & Reordering -->
                    <div class="flex flex-col items-center gap-1.5 shrink-0">
                      <!-- Sequential Rank Badge -->
                      <span
                        class="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-extrabold text-[10px] flex items-center justify-center shadow-sm"
                      >
                        {{ index + 1 }}
                      </span>

                      <!-- Arrow Controls -->
                      <div class="flex flex-col gap-0.5">
                        <button
                          type="button"
                          class="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-indigo-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          :disabled="index === 0"
                          :title="$t('admin.move_up')"
                          @click="moveStepUp(index)"
                        >
                          <ChevronUp class="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          class="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-indigo-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          :disabled="index === editForm.steps.length - 1"
                          :title="$t('admin.move_down')"
                          @click="moveStepDown(index)"
                        >
                          <ChevronDown class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <!-- Step Text Inputs (Inline) -->
                    <div class="flex-1 space-y-2">
                      <input
                        v-model="step.title"
                        type="text"
                        :placeholder="$t('admin.enter_a_node_title')"
                        class="w-full px-3 py-1.5 rounded-lg border text-xs font-bold outline-none transition-all focus:ring-1 focus:ring-indigo-500/30"
                        style="
                          background-color: var(--bg-app);
                          border-color: var(--border-base);
                          color: var(--text-primary);
                        "
                      />
                      <textarea
                        v-model="step.description"
                        rows="2"
                        :placeholder="$t('admin.briefly_describe_the_learning')"
                        class="w-full px-3 py-1.5 rounded-lg border text-[11px] leading-relaxed outline-none transition-all focus:ring-1 focus:ring-indigo-500/30 resize-none"
                        style="
                          background-color: var(--bg-app);
                          border-color: var(--border-base);
                          color: var(--text-primary);
                        "
                      ></textarea>

                      <!-- Interactive Subtasks List Editor -->
                      <div
                        class="mt-3 space-y-2 border-t border-slate-100 dark:border-white/5 pt-2"
                      >
                        <div class="flex items-center justify-between">
                          <label
                            class="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1"
                          >
                            <CheckCircle2 class="w-3.5 h-3.5 text-indigo-500" />
                            <span>{{ $t('admin.stage_breakdown_task_list') }}</span>
                          </label>
                          <button
                            type="button"
                            class="text-[10px] font-black text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer"
                            @click="step.subtasks.push('')"
                          >
                            <Plus class="w-3 h-3" />
                            <span>{{ $t('admin.add_task_item') }}</span>
                          </button>
                        </div>

                        <div class="space-y-1.5">
                          <div
                            v-for="(_, sIdx) in step.subtasks"
                            :key="sIdx"
                            class="flex items-center gap-2"
                          >
                            <div
                              class="w-4 h-4 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 text-[9px] font-black text-slate-400"
                            >
                              {{ sIdx + 1 }}
                            </div>
                            <input
                              v-model="step.subtasks[sIdx]"
                              type="text"
                              :placeholder="$t('admin.for_example_complete_polygon')"
                              class="flex-1 px-3 py-1 rounded-lg border text-[11px] outline-none transition-all focus:ring-1 focus:ring-indigo-500/30"
                              style="
                                background-color: var(--bg-app);
                                border-color: var(--border-base);
                                color: var(--text-primary);
                              "
                            />
                            <button
                              type="button"
                              class="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors shrink-0 cursor-pointer"
                              @click="step.subtasks.splice(sIdx, 1)"
                            >
                              <X class="w-3 h-3" />
                            </button>
                          </div>

                          <div
                            v-if="step.subtasks.length === 0"
                            class="text-[10px] text-slate-400 bg-slate-50 dark:bg-white/1 p-2.5 rounded-xl border border-dashed border-slate-200/40 dark:border-white/5 text-center font-medium"
                          >
                            暂无自定义任务，保存后系统将自动生成智能推荐词条
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Delete Step Action -->
                    <button
                      type="button"
                      class="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors shrink-0 align-self-start mt-1"
                      :title="$t('admin.removal_steps')"
                      @click="removeStep(index)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div
          class="flex items-center gap-4 mt-6 pt-4 border-t"
          style="border-color: var(--border-base)"
        >
          <button
            type="button"
            class="flex-1 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border border-slate-200/50 dark:border-white/5"
            @click="showEditModal = false"
          >
            取消返回
          </button>
          <button
            type="button"
            class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center gap-1.5"
            @click="handleSaveRoadmap"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>{{ $t('admin.save_route_arrangement') }}</span>
          </button>
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
</style>

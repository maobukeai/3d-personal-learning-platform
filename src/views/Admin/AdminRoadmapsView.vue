<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Plus, Trash2, Edit2, Milestone, Search, X } from 'lucide-vue-next';
import api from '@/utils/api';

const roadmaps = ref<any[]>([]);
const isLoading = ref(true);
const showRoadmapModal = ref(false);
const showStepModal = ref(false);
const currentRoadmap = ref<any>(null);
const currentStep = ref<any>(null);

const roadmapForm = ref({
  title: '',
  description: '',
});

const stepForm = ref({
  title: '',
  description: '',
  order: 0,
  roadmapId: '',
});

const searchQuery = ref('');

const filteredRoadmaps = computed(() => {
  if (!searchQuery.value) return roadmaps.value;
  const query = searchQuery.value.toLowerCase();
  return roadmaps.value.filter(
    (r) =>
      r.title?.toLowerCase().includes(query) ||
      r.description?.toLowerCase().includes(query),
  );
});

const fetchRoadmaps = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/admin/roadmaps');
    roadmaps.value = data;
  } catch (error) {
    console.error('Fetch roadmaps error:', error);
  } finally {
    isLoading.value = false;
  }
};

const handleSaveRoadmap = async () => {
  try {
    if (currentRoadmap.value) {
      await api.put(`/api/admin/roadmaps/${currentRoadmap.value.id}`, roadmapForm.value);
    } else {
      await api.post('/api/admin/roadmaps', roadmapForm.value);
    }
    showRoadmapModal.value = false;
    fetchRoadmaps();
  } catch (error) {
    console.error('Save roadmap error:', error);
  }
};

const handleDeleteRoadmap = async (id: string) => {
  if (!confirm('确定要删除这个路线吗？所有步骤将被删除。')) return;
  try {
    await api.delete(`/api/admin/roadmaps/${id}`);
    fetchRoadmaps();
  } catch (error) {
    console.error('Delete roadmap error:', error);
  }
};

const openRoadmapModal = (roadmap: any = null) => {
  currentRoadmap.value = roadmap;
  if (roadmap) {
    roadmapForm.value = {
      title: roadmap.title,
      description: roadmap.description,
    };
  } else {
    roadmapForm.value = { title: '', description: '' };
  }
  showRoadmapModal.value = true;
};

const openStepModal = (roadmap: any, step: any = null) => {
  currentRoadmap.value = roadmap;
  currentStep.value = step;
  if (step) {
    stepForm.value = {
      title: step.title,
      description: step.description,
      order: step.order,
      roadmapId: roadmap.id,
    };
  } else {
    stepForm.value = {
      title: '',
      description: '',
      order: (roadmap.steps?.length || 0) + 1,
      roadmapId: roadmap.id,
    };
  }
  showStepModal.value = true;
};

const handleSaveStep = async () => {
  try {
    if (currentStep.value) {
      await api.put(`/api/admin/roadmaps/steps/${currentStep.value.id}`, stepForm.value);
    } else {
      await api.post('/api/admin/roadmaps/steps', stepForm.value);
    }
    showStepModal.value = false;
    fetchRoadmaps();
  } catch (error) {
    console.error('Save step error:', error);
  }
};

const handleDeleteStep = async (id: string) => {
  if (!confirm('确定要删除这个步骤吗？')) return;
  try {
    await api.delete(`/api/admin/roadmaps/steps/${id}`);
    fetchRoadmaps();
  } catch (error) {
    console.error('Delete step error:', error);
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
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-orange-500/10 via-amber-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1 rounded-xl bg-orange-500/10 text-orange-600 shadow-sm border border-orange-500/20"
          >
            <Milestone class="w-4 h-4" />
          </span>
          <h1 class="text-sm font-black tracking-tight" style="color: var(--text-primary)">
            学习路线管理
          </h1>
        </div>

        <button
          class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-[11px] transition-all shadow-sm cursor-pointer whitespace-nowrap"
          @click="openRoadmapModal()"
        >
          <Plus class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">新建路线</span>
        </button>
      </div>

      <!-- Row 2: 条件筛选与快速搜索 -->
      <div
        class="px-4 sm:px-8 py-2 flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
      >
        <!-- 统计 Pills -->
        <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
          <span
            class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-600 text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 shrink-0"
          >
            <Milestone class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            <span>全部路线</span>
            <span class="opacity-60">({{ filteredRoadmaps.length }})</span>
          </span>
        </div>

        <!-- 检索工具 -->
        <div class="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0">
          <div class="relative flex-1 md:flex-none md:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索路线标题或描述..."
              class="w-full pl-9 pr-7 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-orange-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
            <button
              v-if="searchQuery"
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
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 text-slate-400">
        <div
          class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"
        ></div>
        <p class="text-sm font-bold">加载学习路线...</p>
      </div>

      <div v-else class="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        <div
          v-for="roadmap in filteredRoadmaps"
          :key="roadmap.id"
          class="group rounded-3xl border overflow-hidden transition-all hover:shadow-lg"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <div class="p-4 sm:p-8">
            <div class="flex items-start justify-between mb-6 gap-3">
              <div class="flex items-center gap-3 sm:gap-4 min-w-0">
                <div
                  class="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center shrink-0"
                >
                  <Milestone class="w-6 h-6" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-bold text-lg sm:text-xl mb-1 truncate" style="color: var(--text-primary)">
                    {{ roadmap.title }}
                  </h3>
                  <p class="text-xs text-slate-400 max-w-2xl truncate">{{ roadmap.description }}</p>
                </div>
              </div>
              <div class="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  class="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 transition-colors"
                  @click="openRoadmapModal(roadmap)"
                >
                  <Edit2 class="w-4 h-4" />
                </button>
                <button
                  class="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors"
                  @click="handleDeleteRoadmap(roadmap.id)"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Steps Progress Line -->
            <div
              class="relative pl-5 sm:pl-6 space-y-4 sm:space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-white/5"
            >
              <div v-for="step in roadmap.steps" :key="step.id" class="relative group/step">
                <div
                  class="absolute -left-[23px] top-2 w-[18px] h-[18px] rounded-full bg-white dark:bg-slate-900 border-2 border-accent z-10"
                ></div>

                <div
                  class="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all gap-3"
                >
                  <div class="flex items-center gap-3 sm:gap-4 min-w-0">
                    <span class="text-[10px] font-black text-slate-400 w-4 shrink-0">{{ step.order }}</span>
                    <div class="min-w-0">
                      <h4 class="text-xs sm:text-sm font-bold truncate" style="color: var(--text-primary)">
                        {{ step.title }}
                      </h4>
                      <p class="text-[10px] text-slate-400 mt-0.5 truncate">{{ step.description }}</p>
                    </div>
                  </div>
                  <div
                    class="flex items-center gap-1 md:opacity-0 md:group-hover/step:opacity-100 transition-opacity shrink-0"
                  >
                    <button
                      class="p-1.5 rounded-lg text-slate-400 hover:text-accent"
                      @click="openStepModal(roadmap, step)"
                    >
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                      @click="handleDeleteStep(step.id)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <button
                class="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/5 text-slate-400 hover:text-accent hover:border-accent/40 transition-all text-xs font-bold flex items-center justify-center gap-2"
                @click="openStepModal(roadmap)"
              >
                <Plus class="w-4 h-4" />
                添加步骤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Roadmap Modal -->
    <div
      v-if="showRoadmapModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-xl rounded-3xl p-5 sm:p-8 shadow-2xl transition-colors duration-300"
        style="background-color: var(--bg-card)"
      >
        <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">
          {{ currentRoadmap ? '编辑路线' : '新建路线' }}
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >路线标题</label
            >
            <input
              v-model="roadmapForm.title"
              type="text"
              placeholder="例如：从零开始的 Blender 大师之路"
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >路线描述</label
            >
            <textarea
              v-model="roadmapForm.description"
              rows="3"
              placeholder="简述该路线的学习目标..."
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            ></textarea>
          </div>
        </div>
        <div class="flex items-center gap-4 mt-8">
          <button
            class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            @click="showRoadmapModal = false"
          >
            取消
          </button>
          <button
            class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20"
            @click="handleSaveRoadmap"
          >
            保存路线
          </button>
        </div>
      </div>
    </div>

    <!-- Step Modal -->
    <div
      v-if="showStepModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-xl rounded-3xl p-5 sm:p-8 shadow-2xl transition-colors duration-300"
        style="background-color: var(--bg-card)"
      >
        <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">
          {{ currentStep ? '编辑步骤' : '新建步骤' }}
        </h3>
        <div class="space-y-4">
          <div class="grid grid-cols-4 gap-4">
            <div class="col-span-3">
              <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
                >步骤名称</label
              >
              <input
                v-model="stepForm.title"
                type="text"
                placeholder="例如：掌握基础快捷键"
                class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
                >阶段排序</label
              >
              <input
                v-model="stepForm.order"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all outline-none text-center font-bold"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >详细说明</label
            >
            <textarea
              v-model="stepForm.description"
              rows="3"
              placeholder="该阶段具体需要学习哪些内容..."
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            ></textarea>
          </div>
        </div>
        <div class="flex items-center gap-4 mt-8">
          <button
            class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            @click="showStepModal = false"
          >
            取消
          </button>
          <button
            class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20"
            @click="handleSaveStep"
          >
            保存步骤
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

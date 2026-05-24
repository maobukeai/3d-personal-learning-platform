<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  X,
  Map,
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
  Loader2,
  Zap,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';

const props = defineProps<{
  show: boolean;
  roadmap: any | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', data: any): void;
}>();

const formLoading = ref(false);
const customRoadmapForm = ref({
  id: '',
  title: '',
  description: '',
  steps: [] as Array<{ id?: string; title: string; description: string; subtasks: string[] }>,
});

watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      if (props.roadmap) {
        // Edit mode
        customRoadmapForm.value = {
          id: props.roadmap.id,
          title: props.roadmap.title,
          description: props.roadmap.description || '',
          steps: props.roadmap.steps.map((s: any) => {
            let subtasksArr = [];
            if (s.subtasks) {
              try {
                subtasksArr = typeof s.subtasks === 'string' ? JSON.parse(s.subtasks) : s.subtasks;
              } catch (e) {
                console.error('Parse step subtasks error:', e);
              }
            }
            return {
              id: s.id,
              title: s.title,
              description: s.description || '',
              subtasks: Array.isArray(subtasksArr) ? subtasksArr : [],
            };
          }),
        };
      } else {
        // Create mode
        customRoadmapForm.value = {
          id: '',
          title: '',
          description: '',
          steps: [{ title: '阶段 1: 起步入门', description: '', subtasks: [] }],
        };
      }
    }
  },
  { immediate: true }
);

const addFormStep = () => {
  customRoadmapForm.value.steps.push({
    title: `阶段 ${customRoadmapForm.value.steps.length + 1}: `,
    description: '',
    subtasks: [],
  });
};

const removeFormStep = (index: number) => {
  if (customRoadmapForm.value.steps.length <= 1) {
    return ElMessage.warning('学习路线至少需要包含一个阶段');
  }
  customRoadmapForm.value.steps.splice(index, 1);
};

const moveFormStep = (index: number, direction: 'up' | 'down') => {
  const steps = customRoadmapForm.value.steps;
  if (direction === 'up' && index > 0) {
    const temp = steps[index];
    steps[index] = steps[index - 1];
    steps[index - 1] = temp;
  } else if (direction === 'down' && index < steps.length - 1) {
    const temp = steps[index];
    steps[index] = steps[index + 1];
    steps[index + 1] = temp;
  }
};

const submitCustomRoadmap = async () => {
  if (!customRoadmapForm.value.title.trim()) {
    return ElMessage.warning('请输入学习路线名称');
  }
  const invalidStep = customRoadmapForm.value.steps.some((s) => !s.title.trim());
  if (invalidStep) {
    return ElMessage.warning('所有阶段的标题均不能为空');
  }

  // Format steps: filter empty subtasks for each step
  const formattedSteps = customRoadmapForm.value.steps.map((step) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    subtasks: step.subtasks ? step.subtasks.map((t) => t.trim()).filter(Boolean) : [],
  }));

  const payload = {
    id: customRoadmapForm.value.id,
    title: customRoadmapForm.value.title,
    description: customRoadmapForm.value.description,
    steps: formattedSteps,
  };

  formLoading.value = true;
  try {
    if (props.roadmap) {
      const res = await api.put(`/api/roadmaps/${customRoadmapForm.value.id}`, payload);
      ElMessage.success('路线更新成功');
      emit('saved', res.data);
    } else {
      const res = await api.post('/api/roadmaps', payload);
      ElMessage.success('自定义学习路线创建成功');
      emit('saved', res.data);
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存路线方案失败'));
  } finally {
    formLoading.value = false;
  }
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      @click.self="emit('close')"
    >
      <div
        class="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] border border-slate-100 dark:border-slate-700 overflow-hidden"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30"
        >
          <div class="flex items-center gap-2">
            <div class="p-1.5 rounded-lg bg-accent text-white">
              <Map class="w-4 h-4" />
            </div>
            <h3 class="text-base font-black text-slate-800 dark:text-slate-100">
              {{ roadmap ? '编辑我的学习路线' : '规划新学习路线' }}
            </h3>
          </div>
          <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" @click="emit('close')">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Form Area -->
        <div class="flex-1 p-5 overflow-y-auto space-y-4">
          <div class="space-y-1.5">
            <label class="block text-xs font-black text-slate-500 uppercase tracking-wider"
              >路线名称</label
            >
            <input
              v-model="customRoadmapForm.title"
              type="text"
              placeholder="例如: Blender 物理动画攻坚计划"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          <div class="space-y-1.5">
            <label class="block text-xs font-black text-slate-500 uppercase tracking-wider"
              >描述（目标）</label
            >
            <textarea
              v-model="customRoadmapForm.description"
              rows="2"
              placeholder="用简短的内容描述该学习路线的大致目标与期望..."
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
            ></textarea>
          </div>

          <!-- Steps timeline editing list -->
          <div class="space-y-3 pt-2">
            <div
              class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2"
            >
              <label class="block text-xs font-black text-slate-500 uppercase tracking-wider"
                >学习大纲与阶段 ({{ customRoadmapForm.steps.length }})</label
              >
              <button type="button" class="text-[10px] font-bold text-accent hover:text-accent-dark flex items-center gap-1 cursor-pointer" @click="addFormStep">
                <Plus class="w-3.5 h-3.5" />
                新增学习阶段
              </button>
            </div>

            <div class="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
              <div
                v-for="(step, idx) in customRoadmapForm.steps"
                :key="idx"
                class="p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-500/[0.01] dark:bg-slate-900/30 space-y-2 relative group"
              >
                <!-- Controls inside step row -->
                <div class="flex items-center justify-between gap-2.5">
                  <span class="text-xs font-black text-accent shrink-0">阶段 {{ idx + 1 }}</span>

                  <div class="flex items-center gap-1.5">
                    <!-- Move up -->
                    <button type="button" class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-30 disabled:pointer-events-none" :disabled="idx === 0" @click="moveFormStep(idx, 'up')">
                      <ChevronUp class="w-3.5 h-3.5" />
                    </button>
                    <!-- Move down -->
                    <button type="button" class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-30 disabled:pointer-events-none" :disabled="idx === customRoadmapForm.steps.length - 1" @click="moveFormStep(idx, 'down')">
                      <ChevronDown class="w-3.5 h-3.5" />
                    </button>
                    <!-- Delete -->
                    <button type="button" class="p-1 rounded text-red-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer" @click="removeFormStep(idx)">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <!-- Step Inputs -->
                <input
                  v-model="step.title"
                  type="text"
                  placeholder="阶段标题 (例如: 掌握物理动力学与重力场)"
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <textarea
                  v-model="step.description"
                  rows="1"
                  placeholder="该阶段需要攻克的具体技能或任务说明（选填）"
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                ></textarea>

                <!-- User Customizable Subtasks List Editor -->
                <div class="mt-2 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                  <div class="flex items-center justify-between">
                    <label
                      class="block text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider flex items-center gap-1"
                    >
                      <Plus class="w-3 h-3 text-accent" />
                      <span>阶段细分任务清单</span>
                    </label>
                    <button type="button" class="text-[10px] font-black text-accent hover:text-accent-dark flex items-center gap-0.5 cursor-pointer" @click="step.subtasks.push('')">
                      <Plus class="w-3 h-3" />
                      <span>添加任务项</span>
                    </button>
                  </div>

                  <div class="space-y-1.5">
                    <div
                      v-for="(_, sIdx) in step.subtasks"
                      :key="sIdx"
                      class="flex items-center gap-2"
                    >
                      <div
                        class="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0 text-[9px] font-black text-slate-400"
                      >
                        {{ sIdx + 1 }}
                      </div>
                      <input
                        v-model="step.subtasks[sIdx]"
                        type="text"
                        placeholder="例如: 掌握多边形布线与拓扑原理"
                        class="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-750 text-xs outline-none focus:ring-1 focus:ring-accent text-slate-900 dark:text-white"
                      />
                      <button type="button" class="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 transition-colors shrink-0 cursor-pointer" @click="step.subtasks.splice(sIdx, 1)">
                        <X class="w-3 h-3" />
                      </button>
                    </div>

                    <div
                      v-if="!step.subtasks || step.subtasks.length === 0"
                      class="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100/50 dark:bg-white/5 py-2 px-3 rounded-xl border border-dashed border-slate-200/50 dark:border-white/5 text-center font-medium"
                    >
                      暂无自定义细分任务，留空则在前台页面直接隐藏细分任务模块
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div
          class="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-end gap-3"
        >
          <button type="button" class="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer" @click="emit('close')">
            取消
          </button>
          <button type="button" class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-accent hover:bg-accent-dark transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-accent/20" :class="formLoading ? 'opacity-70 pointer-events-none' : ''" @click="submitCustomRoadmap">
            <Zap v-if="!formLoading" class="w-3.5 h-3.5" />
            <Loader2 v-else class="w-3.5 h-3.5 animate-spin" />
            保存我的路线
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

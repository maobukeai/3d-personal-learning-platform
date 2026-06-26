<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Plus,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  Layers,
  Info,
  HelpCircle,
  CheckCircle2,
  Wand2,
  RefreshCw,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';
import { parseMarkdownToPlanJson } from '@/utils/planParser';
import { logError } from '@/utils/error';
import type { PlanRoadmapStep } from '@/utils/planParser';
import Modal from '@/components/ui/Modal.vue';
import type { Roadmap } from '@/types';

interface RoadmapFormStep {
  id?: string;
  title: string;
  description: string;
  subtasks: string[];
  order: number;
}

interface Props {
  show: boolean;
  roadmap: Roadmap | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'saved'): void;
}>();

const { t } = useI18n();

const editForm = ref({
  title: '',
  description: '',
  steps: [] as RoadmapFormStep[],
});

const aiPrompt = ref('');
const isAiGenerating = ref(false);
const isSaving = ref(false);

const resetForm = () => {
  aiPrompt.value = '';
  if (props.roadmap) {
    editForm.value = {
      title: props.roadmap.title || '',
      description: props.roadmap.description || '',
      steps:
        props.roadmap.steps?.map((s) => {
          let subtasksArr: string[] = [];
          if (s.subtasks) {
            try {
              const parsed = typeof s.subtasks === 'string' ? JSON.parse(s.subtasks) : s.subtasks;
              subtasksArr = Array.isArray(parsed)
                ? parsed.filter((item): item is string => typeof item === 'string')
                : [];
            } catch (e) {
              logError(e, {
                operation: 'admin.parseStepSubtasks',
                component: 'AdminRoadmapEditDialog',
              });
            }
          }
          return {
            id: s.id,
            title: s.title || '',
            description: s.description || '',
            subtasks: Array.isArray(subtasksArr) ? subtasksArr : [],
            order: s.order || 0,
          };
        }) || [],
    };
  } else {
    editForm.value = {
      title: '',
      description: '',
      steps: [],
    };
  }
};

watch(
  () => props.show,
  (show) => {
    if (show) resetForm();
  },
);

watch(
  () => props.roadmap,
  () => {
    if (props.show) resetForm();
  },
);

const close = () => emit('update:show', false);

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

const handleAiGenerate = async () => {
  if (!aiPrompt.value.trim()) {
    ElMessage.warning('请输入您的教学目标或路线设想');
    return;
  }

  if (editForm.value.title.trim() || editForm.value.steps.some((s) => s.title.trim())) {
    try {
      await ElMessageBox.confirm(
        'AI 生成路线将会覆盖当前已填写的内容，确定要继续吗？',
        '确认提示',
        {
          confirmButtonText: '确定覆盖',
          cancelButtonText: '取消',
          type: 'warning',
        },
      );
    } catch {
      return;
    }
  }

  isAiGenerating.value = true;
  editForm.value.title = '';
  editForm.value.description = '';
  editForm.value.steps = [];

  let currentText = '';
  let lastParseTime = 0;

  try {
    const headers = createJsonHeaders();
    const response = await fetch('/api/admin/roadmaps/ai-generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: aiPrompt.value.trim(),
      }),
    });

    if (!response.ok) {
      throw new Error(await readFetchErrorMessage(response, 'AI 规划失败'));
    }

    if (!response.body) {
      throw new Error('未获得数据流响应');
    }

    const reader = response.body.getReader();

    await parseSSEStream(
      reader,
      (payload) => {
        if (payload.error) {
          throw new Error(payload.error);
        }
        if (payload.text) {
          currentText += payload.text;

          const now = Date.now();
          if (now - lastParseTime > 150) {
            lastParseTime = now;
            try {
              const parsed = parseMarkdownToPlanJson(currentText);
              if (parsed) {
                editForm.value.title = parsed.title !== '未命名导入项目' ? parsed.title : '';
                editForm.value.description = parsed.description || '';
                if (parsed.roadmap?.steps) {
                  editForm.value.steps = parsed.roadmap.steps.map(
                    (s: PlanRoadmapStep, idx: number) => ({
                      title: s.title || '',
                      description: s.description || '',
                      subtasks: s.subtasks ? s.subtasks.map((sub) => sub.text) : [],
                      order: idx + 1,
                    }),
                  );
                }
              }
            } catch {
              // Ignore partial parsing errors
            }
          }
        }
      },
      () => {},
      (err) => {
        throw err;
      },
    );

    try {
      const finalParsed = parseMarkdownToPlanJson(currentText);
      if (finalParsed) {
        editForm.value.title = finalParsed.title !== '未命名导入项目' ? finalParsed.title : '';
        editForm.value.description = finalParsed.description || '';
        if (finalParsed.roadmap?.steps) {
          editForm.value.steps = finalParsed.roadmap.steps.map(
            (s: PlanRoadmapStep, idx: number) => ({
              title: s.title || '',
              description: s.description || '',
              subtasks: s.subtasks ? s.subtasks.map((sub) => sub.text) : [],
              order: idx + 1,
            }),
          );
        }
      }
    } catch (e) {
      logError('Final parse error:', e);
    }

    ElMessage.success('AI 已成功为您规划官方路线，请核对并继续编辑！');
    aiPrompt.value = '';
  } catch (error: unknown) {
    logError(error, { operation: 'admin.aiGenerateRoadmap', component: 'AdminRoadmapEditDialog' });
    ElMessage.error((error as Error)?.message || 'AI 生成失败');
  } finally {
    isAiGenerating.value = false;
  }
};

const handleSaveRoadmap = async () => {
  if (!editForm.value.title.trim()) {
    ElMessage.warning(t('admin.please_enter_the_learning'));
    return;
  }

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

  isSaving.value = true;
  try {
    if (props.roadmap) {
      await api.put(`/api/admin/roadmaps/${props.roadmap.id}`, payload);
    } else {
      await api.post('/api/admin/roadmaps', payload);
    }
    close();
    emit('saved');
  } catch (error) {
    logError(error, { operation: 'admin.saveRoadmap', component: 'AdminRoadmapEditDialog' });
    ElMessage.error(t('admin.saving_failed_please_check'));
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <Modal :show="show" size="xxl" padding="none" glass-card @close="close">
    <div
      class="w-full p-6 sm:p-8 transition-colors duration-300 flex flex-col max-h-[90vh] overflow-hidden relative"
    >
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
                roadmap
                  ? t('admin.edit_official_learning_route')
                  : t('admin.arrange_a_new_learning')
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
          @click="close"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Split Grid Container (Scrollable) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto pr-1 flex-1 pb-4">
        <!-- Left Column (lg:col-span-5): Basic Information & AI Generator -->
        <div class="lg:col-span-5 space-y-5">
          <!-- AI Generate Panel -->
          <div
            class="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/20 space-y-4 shadow-sm"
          >
            <div
              class="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5"
            >
              <Wand2
                class="w-3.5 h-3.5 text-indigo-500"
                :class="{ 'animate-spin': isAiGenerating }"
              />
              <span>AI 智能生成路线</span>
            </div>
            <p class="text-[10px] text-slate-400 leading-relaxed">
              输入您的教学目标或路线设想，AI 将自动为您规划整套学习阶段、节点及拆分任务。
            </p>
            <div class="space-y-2">
              <textarea
                v-model="aiPrompt"
                rows="3"
                placeholder="例如：3D 角色绑定与骨骼动画从入门到精通，包含基础绑定、刷权重、IK/FK 切换和动画实战。"
                class="w-full px-3 py-2 rounded-xl border transition-all outline-none resize-none text-[11px] leading-relaxed"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              ></textarea>
              <button
                type="button"
                class="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isAiGenerating || !aiPrompt.trim()"
                @click="handleAiGenerate"
              >
                <RefreshCw v-if="isAiGenerating" class="w-3.5 h-3.5 animate-spin" />
                <Wand2 v-else class="w-3.5 h-3.5" />
                <span>{{ isAiGenerating ? 'AI 正在规划中...' : '开始 AI 智能规划' }}</span>
              </button>
            </div>
          </div>

          <div
            class="p-5 rounded-2xl bg-slate-50/50 dark:bg-white/2 border border-slate-200/50 dark:border-white/5 space-y-4"
          >
            <div
              class="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5"
            >
              <Info class="w-3.5 h-3.5" />
              <span>{{ t('admin.basic_attribute_configuration') }}</span>
            </div>

            <div>
              <label
                class="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider"
                >{{ t('admin.route_title') }}</label
              >
              <input
                v-model="editForm.title"
                type="text"
                :placeholder="t('admin.for_example_3d_character')"
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
                >{{ t('admin.core_description') }}</label
              >
              <textarea
                v-model="editForm.description"
                rows="4"
                :placeholder="t('admin.briefly_describe_the_learning_1')"
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
              <span>{{ t('admin.suggestions_on_teaching_arrangement') }}</span>
            </div>
            <ul class="text-[10px] leading-relaxed space-y-2 text-slate-400">
              <li class="flex items-start gap-1.5">
                <span class="text-indigo-500 mt-0.5">•</span>
                <span
                  ><strong>{{ t('admin.clear_steps') }}</strong
                  >{{ t('admin.the_goal_of_each') }}</span
                >
              </li>
              <li class="flex items-start gap-1.5">
                <span class="text-indigo-500 mt-0.5">•</span>
                <span
                  ><strong>{{ t('admin.reasonable_step_size') }}</strong
                  >{{ t('admin.the_official_route_recommends') }}</span
                >
              </li>
              <li class="flex items-start gap-1.5">
                <span class="text-indigo-500 mt-0.5">•</span>
                <span
                  ><strong>{{ t('admin.lossless_upgrade') }}</strong
                  >{{ t('admin.for_the_route_being') }}</span
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
              <Layers class="w-3.5 h-3.5" />
              <span>{{ t('admin.learning_stage_node_design') }}</span>
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
              <span>{{ t('admin.add_new_steps') }}</span>
            </button>
          </div>

          <!-- Steps Scroll Container -->
          <div
            class="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide border border-dashed border-slate-200/50 dark:border-white/5 rounded-2xl p-4 bg-slate-50/20 dark:bg-white/1"
          >
            <!-- Empty Steps State -->
            <div
              v-if="editForm.steps.length === 0"
              class="py-12 flex flex-col items-center justify-center text-slate-400 gap-2"
            >
              <Layers class="w-8 h-8 opacity-30" />
              <p class="text-xs font-medium">{{ t('admin.there_are_currently_no_1') }}</p>
              <button
                type="button"
                class="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white text-[10px] font-bold border border-indigo-500/20 transition-all cursor-pointer"
                @click="addStep"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>{{ t('admin.add_first_step') }}</span>
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
                        :title="t('admin.move_up')"
                        @click="moveStepUp(index)"
                      >
                        <ChevronUp class="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        class="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-indigo-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        :disabled="index === editForm.steps.length - 1"
                        :title="t('admin.move_down')"
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
                      :placeholder="t('admin.enter_a_node_title')"
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
                      :placeholder="t('admin.briefly_describe_the_learning')"
                      class="w-full px-3 py-1.5 rounded-lg border text-[11px] leading-relaxed outline-none transition-all focus:ring-1 focus:ring-indigo-500/30 resize-none"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                    ></textarea>

                    <!-- Interactive Subtasks List Editor -->
                    <div class="mt-3 space-y-2 border-t border-slate-100 dark:border-white/5 pt-2">
                      <div class="flex items-center justify-between">
                        <label
                          class="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1"
                        >
                          <CheckCircle2 class="w-3.5 h-3.5 text-indigo-500" />
                          <span>{{ t('admin.stage_breakdown_task_list') }}</span>
                        </label>
                        <button
                          type="button"
                          class="text-[10px] font-black text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer"
                          @click="step.subtasks.push('')"
                        >
                          <Plus class="w-3 h-3" />
                          <span>{{ t('admin.add_task_item') }}</span>
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
                            :placeholder="t('admin.for_example_complete_polygon')"
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
                    :title="t('admin.removal_steps')"
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
          @click="close"
        >
          取消返回
        </button>
        <button
          type="button"
          class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center gap-1.5"
          :disabled="isSaving"
          @click="handleSaveRoadmap"
        >
          <RefreshCw v-if="isSaving" class="w-4 h-4 animate-spin" />
          <CheckCircle2 v-else class="w-4 h-4" />
          <span>{{ t('admin.save_route_arrangement') }}</span>
        </button>
      </div>
    </div>
  </Modal>
</template>

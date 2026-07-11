<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Map, Plus, Trash2, ChevronUp, ChevronDown, X, Zap, CheckCircle2 } from 'lucide-vue-next';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import type { Roadmap, RoadmapStep } from '@/types';

interface FormStep {
  id?: string;
  title: string;
  description: string;
  subtasks: string[];
}

interface Props {
  show: boolean;
  roadmap: Roadmap | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'saved', roadmap: Roadmap, isEditing: boolean): void;
}>();

const { t } = useI18n();

const isEditing = computed(() => !!props.roadmap);
const formLoading = ref(false);
const customRoadmapForm = ref({
  id: '',
  title: '',
  description: '',
  steps: [] as FormStep[],
});

const resetForm = () => {
  if (props.roadmap) {
    customRoadmapForm.value = {
      id: props.roadmap.id,
      title: props.roadmap.title,
      description: props.roadmap.description || '',
      steps: (props.roadmap.steps || []).map((s: RoadmapStep) => {
        let subtasksArr: unknown = [];
        if (s.subtasks) {
          try {
            subtasksArr = typeof s.subtasks === 'string' ? JSON.parse(s.subtasks) : s.subtasks;
          } catch (e) {
            logError(e, { operation: 'roadmap.parseStepSubtasks', component: 'RoadmapFormDialog' });
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
    customRoadmapForm.value = {
      id: '',
      title: '',
      description: '',
      steps: [{ title: t('roadmaps.defaultStepTitle', { n: 1 }), description: '', subtasks: [] }],
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

const addFormStep = () => {
  customRoadmapForm.value.steps.push({
    title: t('roadmaps.stepTitlePrefix', { n: customRoadmapForm.value.steps.length + 1 }),
    description: '',
    subtasks: [],
  });
};

const removeFormStep = (index: number) => {
  if (customRoadmapForm.value.steps.length <= 1) {
    return ElMessage.warning(t('roadmaps.atLeastOneStep'));
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
    return ElMessage.warning(t('roadmaps.titleRequired'));
  }
  const invalidStep = customRoadmapForm.value.steps.some((s) => !s.title.trim());
  if (invalidStep) {
    return ElMessage.warning(t('roadmaps.stepTitleRequired'));
  }

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
    if (isEditing.value) {
      const res = await api.put(`/api/roadmaps/${customRoadmapForm.value.id}`, payload);
      ElMessage.success(t('roadmaps.updateSuccess'));
      emit('saved', res.data, true);
    } else {
      const res = await api.post('/api/roadmaps', payload);
      ElMessage.success(t('roadmaps.createSuccess'));
      emit('saved', res.data, false);
    }
    close();
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, t('roadmaps.saveFailed')));
  } finally {
    formLoading.value = false;
  }
};
</script>

<template>
  <Modal :show="show" size="lg" @close="close">
    <template #header>
      <div class="flex items-center gap-2">
        <div class="p-1.5 rounded-lg bg-accent text-white">
          <Map class="w-4 h-4" />
        </div>
        <h3 class="text-base font-black text-[var(--text-primary)]">
          {{ isEditing ? t('roadmaps.editRoadmapTitle') : t('roadmaps.createRoadmapTitle') }}
        </h3>
      </div>
    </template>

    <div class="space-y-4">
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >{{ t('roadmaps.formTitle') }}</label
        >
        <input
          v-model="customRoadmapForm.title"
          type="text"
          :placeholder="t('roadmaps.formTitlePlaceholder')"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        />
      </div>

      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >{{ t('roadmaps.formDesc') }}</label
        >
        <textarea
          v-model="customRoadmapForm.description"
          rows="2"
          :placeholder="t('roadmaps.formDescPlaceholder')"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm resize-none"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        ></textarea>
      </div>

      <!-- Steps timeline editing list -->
      <div class="space-y-3 pt-2">
        <div class="flex items-center justify-between border-b border-white/10 pb-2">
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >{{ t('roadmaps.formStagesLabel', { n: customRoadmapForm.steps.length }) }}</label
          >
          <button
            type="button"
            class="text-[10px] font-bold text-accent hover:text-accent-dark flex items-center gap-1 cursor-pointer"
            @click="addFormStep"
          >
            <Plus class="w-3.5 h-3.5" />
            {{ t('roadmaps.formAddStage') }}
          </button>
        </div>

        <div class="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
          <div
            v-for="(step, idx) in customRoadmapForm.steps"
            :key="idx"
            class="p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-500/[0.01] dark:bg-slate-900/30 space-y-2 relative group"
          >
            <!-- Controls inside step row -->
            <div class="mobile-row flex items-center justify-between gap-2.5">
              <span class="text-xs font-black text-accent shrink-0">{{
                t('roadmaps.formStageNum', { n: idx + 1 })
              }}</span>

              <div class="flex items-center gap-1.5">
                <!-- Move up -->
                <button
                  type="button"
                  class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                  :disabled="idx === 0"
                  @click="moveFormStep(idx, 'up')"
                >
                  <ChevronUp class="w-3.5 h-3.5" />
                </button>
                <!-- Move down -->
                <button
                  type="button"
                  class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                  :disabled="idx === customRoadmapForm.steps.length - 1"
                  @click="moveFormStep(idx, 'down')"
                >
                  <ChevronDown class="w-3.5 h-3.5" />
                </button>
                <!-- Delete -->
                <button
                  type="button"
                  class="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                  @click="removeFormStep(idx)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Step Inputs -->
            <input
              v-model="step.title"
              type="text"
              :placeholder="t('roadmaps.formStageTitlePlaceholder')"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
            <textarea
              v-model="step.description"
              rows="1"
              :placeholder="t('roadmaps.formStageDescPlaceholder')"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs resize-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            ></textarea>

            <!-- User Customizable Subtasks List Editor -->
            <div class="mt-2 space-y-2 border-t border-white/10 pt-2">
              <div class="mobile-row flex items-center justify-between">
                <label
                  class="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1"
                >
                  <CheckCircle2 class="w-3 h-3 text-accent" />
                  <span>{{ t('roadmaps.formStageChecklistLabel') }}</span>
                </label>
                <button
                  type="button"
                  class="text-[10px] font-black text-accent hover:text-accent-dark flex items-center gap-0.5 cursor-pointer"
                  @click="step.subtasks.push('')"
                >
                  <Plus class="w-3 h-3" />
                  <span>{{ t('roadmaps.formAddTaskItem') }}</span>
                </button>
              </div>

              <div class="space-y-1.5">
                <div v-for="(_, sIdx) in step.subtasks" :key="sIdx" class="flex items-center gap-2">
                  <div
                    class="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0 text-[9px] font-black text-slate-400"
                  >
                    {{ sIdx + 1 }}
                  </div>
                  <input
                    v-model="step.subtasks[sIdx]"
                    type="text"
                    :placeholder="t('roadmaps.formTaskPlaceholder')"
                    class="flex-1 px-4 py-2.5 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                  <button
                    type="button"
                    class="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 transition-colors shrink-0 cursor-pointer"
                    @click="step.subtasks.splice(sIdx, 1)"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>

                <div
                  v-if="!step.subtasks || step.subtasks.length === 0"
                  class="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100/50 dark:bg-white/1 py-2 px-3 rounded-xl border border-dashed border-slate-200/50 dark:border-white/5 text-center font-medium"
                >
                  {{ t('roadmaps.formNoTasksDesc') }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center gap-3">
        <Button variant="secondary" size="md" @click="close">
          {{ t('common.cancel') }}
        </Button>
        <Button
          variant="primary"
          size="md"
          :loading="formLoading"
          :icon="Zap"
          @click="submitCustomRoadmap"
        >
          {{ t('roadmaps.formSaveBtn') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

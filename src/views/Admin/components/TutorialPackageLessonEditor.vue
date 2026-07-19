<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import { getApiErrorMessage } from '@/utils/error';
import TutorialStepEditor from './TutorialStepEditor.vue';
import type { TutorialLesson, TutorialSection } from '../tutorialPackageTypes';

const props = defineProps<{ lesson: TutorialLesson }>();
const emit = defineEmits<{ (event: 'changed'): void }>();
const expanded = ref(true);
const busy = ref(false);
const lessonForm = reactive({ title: '', order: 1 });
const sectionDrafts = reactive<
  Record<string, { title: string; order: number; startTime: number; endTime: number }>
>({});

const sync = () => {
  lessonForm.title = props.lesson.title;
  lessonForm.order = props.lesson.order;
  for (const section of props.lesson.tutorialSections) {
    sectionDrafts[section.id] = {
      title: section.title,
      order: section.order,
      startTime: section.startTime,
      endTime: section.endTime,
    };
  }
};
watch(() => props.lesson, sync, { immediate: true, deep: true });

const run = async (action: () => Promise<unknown>, success?: string) => {
  busy.value = true;
  try {
    await action();
    if (success) ElMessage.success(success);
    emit('changed');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '操作失败'));
  } finally {
    busy.value = false;
  }
};

const saveLesson = () =>
  run(
    () => api.patch(`/api/courses/tutorial-lessons/${props.lesson.id}`, lessonForm),
    '章节已保存',
  );
const removeLesson = () => {
  if (window.confirm(`确定删除章节“${props.lesson.title}”及其全部参考图吗？`)) {
    void run(() => api.delete(`/api/courses/tutorial-lessons/${props.lesson.id}`));
  }
};
const addSection = () =>
  run(() =>
    api.post('/api/courses/tutorial-sections', {
      lessonId: props.lesson.id,
      title: '新内容分组',
      order: props.lesson.tutorialSections.length + 1,
    }),
  );
const saveSection = (section: TutorialSection) =>
  run(
    () => api.patch(`/api/courses/tutorial-sections/${section.id}`, sectionDrafts[section.id]),
    '分组已保存',
  );
const removeSection = (section: TutorialSection) => {
  if (window.confirm(`确定删除分组“${section.title}”吗？`)) {
    void run(() => api.delete(`/api/courses/tutorial-sections/${section.id}`));
  }
};
const addStep = (section: TutorialSection) =>
  run(() =>
    api.post('/api/courses/tutorial-steps', {
      sectionId: section.id,
      title: '新步骤',
      description: '',
      order: section.steps.length + 1,
    }),
  );
</script>

<template>
  <section
    class="overflow-hidden rounded-xl border"
    style="border-color: var(--border-base); background: var(--bg-elevated)"
  >
    <header class="flex items-center gap-2 p-3">
      <button class="rounded-lg p-1 hover:bg-black/5" @click="expanded = !expanded">
        <ChevronDown v-if="expanded" class="h-4 w-4" /><ChevronRight v-else class="h-4 w-4" />
      </button>
      <input v-model="lessonForm.title" class="tutorial-input min-w-0 flex-1 font-bold" />
      <input
        v-model.number="lessonForm.order"
        class="tutorial-input w-16"
        type="number"
        title="章节顺序"
      />
      <button class="tutorial-primary-btn" :disabled="busy" @click="saveLesson">
        <Save class="h-3.5 w-3.5" />保存
      </button>
      <button class="tutorial-danger-btn" :disabled="busy" @click="removeLesson">
        <Trash2 class="h-3.5 w-3.5" />
      </button>
    </header>
    <div v-if="expanded" class="space-y-4 border-t p-3" style="border-color: var(--border-base)">
      <div
        v-for="section in lesson.tutorialSections"
        :key="section.id"
        class="space-y-3 rounded-xl border p-3"
        style="border-color: var(--border-base)"
      >
        <div class="grid grid-cols-[1fr_60px_88px_88px_auto_auto] gap-2">
          <input
            v-model="sectionDrafts[section.id].title"
            class="tutorial-input font-semibold"
            placeholder="分组名称"
          />
          <input
            v-model.number="sectionDrafts[section.id].order"
            class="tutorial-input"
            type="number"
            title="顺序"
          />
          <input
            v-model.number="sectionDrafts[section.id].startTime"
            class="tutorial-input"
            type="number"
            step="0.1"
            title="开始秒数"
          />
          <input
            v-model.number="sectionDrafts[section.id].endTime"
            class="tutorial-input"
            type="number"
            step="0.1"
            title="结束秒数"
          />
          <button class="tutorial-primary-btn" :disabled="busy" @click="saveSection(section)">
            <Save class="h-3.5 w-3.5" />
          </button>
          <button class="tutorial-danger-btn" :disabled="busy" @click="removeSection(section)">
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
        <TutorialStepEditor
          v-for="step in section.steps"
          :key="step.id"
          :step="step"
          @changed="emit('changed')"
        />
        <button class="tutorial-add-btn" :disabled="busy" @click="addStep(section)">
          <Plus class="h-3.5 w-3.5" />新增步骤
        </button>
      </div>
      <button class="tutorial-add-btn w-full justify-center" :disabled="busy" @click="addSection">
        <Plus class="h-3.5 w-3.5" />新增内容分组
      </button>
    </div>
  </section>
</template>

<style scoped>
.tutorial-input {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  padding: 7px 9px;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}
.tutorial-input:focus {
  border-color: var(--color-accent);
}
.tutorial-primary-btn,
.tutorial-danger-btn,
.tutorial-add-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
}
.tutorial-primary-btn {
  background: var(--color-accent);
  color: white;
}
.tutorial-danger-btn {
  color: var(--danger);
}
.tutorial-danger-btn:hover {
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}
.tutorial-add-btn {
  border: 1px dashed var(--border-base);
  color: var(--text-secondary);
}
button:disabled {
  opacity: 0.5;
}
</style>

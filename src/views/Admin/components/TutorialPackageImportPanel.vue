<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Archive, ArrowDown, ArrowUp, Loader2, RefreshCw, Upload, X } from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import { getApiErrorMessage } from '@/utils/error';
import TutorialPackageLessonEditor from './TutorialPackageLessonEditor.vue';
import type { Course } from '@/types';
import type {
  TutorialImportResult,
  TutorialLesson,
  TutorialUploadItem,
} from '../tutorialPackageTypes';

const emit = defineEmits<{ (event: 'saved'): void }>();
const courses = ref<Course[]>([]);
const selectedCourseId = ref('');
const uploadItems = ref<TutorialUploadItem[]>([]);
const packages = ref<TutorialLesson[]>([]);
const results = ref<TutorialImportResult[]>([]);
const loadingCourses = ref(false);
const loadingPackages = ref(false);
const uploading = ref(false);
const hasSelection = computed(() => !!selectedCourseId.value);
const nextLessonOrder = computed(() => {
  const course = courses.value.find((item) => item.id === selectedCourseId.value);
  return Math.max(0, ...(course?.lessons || []).map((lesson) => lesson.order || 0)) + 1;
});

const loadCourses = async () => {
  loadingCourses.value = true;
  try {
    const { data } = await api.get<Course[]>('/api/admin/courses');
    courses.value = data;
    if (!selectedCourseId.value && data[0]) selectedCourseId.value = data[0].id;
    if (selectedCourseId.value) await loadPackages();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '加载课程失败'));
  } finally {
    loadingCourses.value = false;
  }
};

const loadPackages = async () => {
  if (!selectedCourseId.value) {
    packages.value = [];
    return;
  }
  loadingPackages.value = true;
  try {
    const { data } = await api.get<TutorialLesson[]>(
      `/api/courses/${selectedCourseId.value}/tutorial-packages`,
    );
    packages.value = data;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '加载解析章节失败'));
  } finally {
    loadingPackages.value = false;
  }
};

const selectFiles = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const selected = Array.from(input.files || []).filter((file) =>
    file.name.toLowerCase().endsWith('.zip'),
  );
  const existing = new Set(uploadItems.value.map((item) => `${item.file.name}:${item.file.size}`));
  const additions = selected
    .filter((file) => !existing.has(`${file.name}:${file.size}`))
    .map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      title: '',
    }));
  uploadItems.value.push(...additions);
  input.value = '';
};

const move = (index: number, direction: -1 | 1) => {
  const target = index + direction;
  if (target < 0 || target >= uploadItems.value.length) return;
  const next = [...uploadItems.value];
  const [item] = next.splice(index, 1);
  if (item) next.splice(target, 0, item);
  uploadItems.value = next;
};

const removeUpload = (index: number) => uploadItems.value.splice(index, 1);

const upload = async () => {
  if (!selectedCourseId.value) return ElMessage.warning('请先选择课程');
  if (!uploadItems.value.length) return ElMessage.warning('请选择至少一个 ZIP 教程包');
  uploading.value = true;
  results.value = [];
  try {
    const data = new FormData();
    data.append(
      'metadata',
      JSON.stringify({
        items: uploadItems.value.map((item, index) => ({
          title: item.title.trim() || undefined,
          order: nextLessonOrder.value + index,
        })),
      }),
    );
    uploadItems.value.forEach((item) => data.append('files', item.file, item.file.name));
    const response = await api.post<{
      successCount: number;
      failedCount: number;
      results: TutorialImportResult[];
    }>(`/api/courses/${selectedCourseId.value}/tutorial-packages`, data);
    results.value = response.data.results;
    if (response.data.successCount) {
      ElMessage.success(`成功导入 ${response.data.successCount} 个章节`);
      uploadItems.value = [];
      await loadPackages();
      emit('saved');
    }
    if (response.data.failedCount)
      ElMessage.warning(`${response.data.failedCount} 个 ZIP 导入失败`);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '教程包导入失败'));
  } finally {
    uploading.value = false;
  }
};

onMounted(loadCourses);
</script>

<template>
  <div class="space-y-5">
    <div
      class="rounded-xl border p-4"
      style="border-color: var(--border-base); background: var(--bg-app)"
    >
      <label class="mb-2 block text-xs font-bold text-slate-400">导入到课程</label>
      <div class="flex gap-2">
        <select
          v-model="selectedCourseId"
          class="tutorial-select flex-1"
          :disabled="loadingCourses"
          @change="loadPackages"
        >
          <option value="" disabled>请选择已手动创建的课程</option>
          <option v-for="course in courses" :key="course.id" :value="course.id">
            {{ course.title }}
          </option>
        </select>
        <button class="icon-btn" title="刷新" @click="loadCourses">
          <RefreshCw class="h-4 w-4" :class="loadingCourses && 'animate-spin'" />
        </button>
      </div>
      <p class="mt-2 text-xs text-slate-400">
        课程名称、封面、简介等仍在“新建课程”中手动维护；这里每个 ZIP 只生成一个章节。
      </p>
    </div>

    <div class="rounded-xl border p-4" style="border-color: var(--border-base)">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-bold">选择教程包</h3>
          <p class="text-xs text-slate-400">支持一次选择多个 ZIP，使用箭头调整章节顺序。</p>
        </div>
        <label
          class="tutorial-primary-btn cursor-pointer"
          :class="!hasSelection && 'pointer-events-none opacity-50'"
          ><Upload class="h-4 w-4" />选择 ZIP<input
            class="hidden"
            type="file"
            accept=".zip,application/zip"
            multiple
            @change="selectFiles"
        /></label>
      </div>
      <div v-if="uploadItems.length" class="mt-3 space-y-2">
        <div
          v-for="(item, index) in uploadItems"
          :key="item.id"
          class="grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-lg border p-2"
          style="border-color: var(--border-base); background: var(--bg-app)"
        >
          <span class="text-center text-xs font-bold text-slate-400">{{ index + 1 }}</span>
          <div class="min-w-0">
            <input
              v-model="item.title"
              class="tutorial-input w-full font-semibold"
              :placeholder="`自动读取包内名称（可手动覆盖）`"
            />
            <p class="mt-1 truncate text-[11px] text-slate-400">
              {{ item.file.name }} · {{ (item.file.size / 1024 / 1024).toFixed(1) }} MB
            </p>
          </div>
          <div class="flex">
            <button class="icon-btn" :disabled="index === 0" title="上移" @click="move(index, -1)">
              <ArrowUp class="h-3.5 w-3.5" /></button
            ><button
              class="icon-btn"
              :disabled="index === uploadItems.length - 1"
              title="下移"
              @click="move(index, 1)"
            >
              <ArrowDown class="h-3.5 w-3.5" /></button
            ><button class="icon-btn text-red-500" title="移除" @click="removeUpload(index)">
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <button class="tutorial-primary-btn ml-auto" :disabled="uploading" @click="upload">
          <Loader2 v-if="uploading" class="h-4 w-4 animate-spin" /><Archive
            v-else
            class="h-4 w-4"
          />{{ uploading ? '解析并压缩中…' : `导入 ${uploadItems.length} 个章节` }}
        </button>
      </div>
    </div>

    <div
      v-if="results.length"
      class="space-y-1 rounded-xl border p-3"
      style="border-color: var(--border-base)"
    >
      <p
        v-for="result in results"
        :key="result.filename"
        class="text-xs"
        :class="result.success ? 'text-emerald-500' : 'text-red-500'"
      >
        {{ result.success ? '✓' : '✕' }} {{ result.filename
        }}<span v-if="result.error"> — {{ result.error }}</span>
      </p>
    </div>

    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold">已解析章节（可增删改查）</h3>
        <Loader2 v-if="loadingPackages" class="h-4 w-4 animate-spin" />
      </div>
      <TutorialPackageLessonEditor
        v-for="lesson in packages"
        :key="lesson.id"
        :lesson="lesson"
        @changed="loadPackages"
      />
      <div
        v-if="hasSelection && !loadingPackages && !packages.length"
        class="rounded-xl border border-dashed p-8 text-center text-xs text-slate-400"
      >
        这门课程还没有导入教程包
      </div>
    </div>
  </div>
</template>

<style scoped>
.tutorial-select,
.tutorial-input {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-elevated);
  padding: 8px 10px;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}
.tutorial-select:focus,
.tutorial-input:focus {
  border-color: var(--color-accent);
}
.tutorial-primary-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  background: var(--color-accent);
  padding: 8px 12px;
  color: white;
  font-size: 12px;
  font-weight: 700;
}
.icon-btn {
  display: flex;
  height: 30px;
  width: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.icon-btn:hover {
  background: color-mix(in srgb, var(--text-primary) 7%, transparent);
}
button:disabled {
  opacity: 0.4;
}
</style>

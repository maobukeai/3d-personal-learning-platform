<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import type { Category, Course } from '@/types';

const props = defineProps<{
  categories: Category[];
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const visible = ref(false);
const currentCourse = ref<Course | null>(null);

const courseForm = ref({
  title: '',
  description: '',
  thumbnail: '',
  categoryId: '',
  difficulty: 'BEGINNER',
  status: 'PUBLISHED',
});

const open = (course: Course | null = null) => {
  currentCourse.value = course;
  if (course) {
    courseForm.value = {
      title: course.title || '',
      description: course.description || '',
      thumbnail: course.thumbnail || '',
      categoryId: course.categoryId || '',
      difficulty: course.difficulty || 'BEGINNER',
      status: course.status || 'PUBLISHED',
    };
  } else {
    courseForm.value = {
      title: '',
      description: '',
      thumbnail: '',
      categoryId: '',
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
    };
  }
  visible.value = true;
};

const handleSaveCourse = async () => {
  if (!courseForm.value.title.trim()) {
    ElMessage.warning('请输入课程标题');
    return;
  }
  try {
    if (currentCourse.value) {
      await api.put(`/api/admin/courses/${currentCourse.value.id}`, courseForm.value);
      ElMessage.success('课程更新成功');
    } else {
      await api.post('/api/admin/courses', courseForm.value);
      ElMessage.success('课程创建成功');
    }
    visible.value = false;
    emit('saved');
  } catch (_error) {
    ElMessage.error('保存课程失败');
  }
};

defineExpose({ open });
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
  >
    <div
      class="w-full max-w-xl rounded-3xl p-5 sm:p-8 shadow-2xl transition-colors duration-300 max-h-[90vh] overflow-y-auto animate-fade-in"
      style="background-color: var(--bg-card)"
    >
      <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">
        {{ currentCourse ? '编辑课程' : '新建课程' }}
      </h3>
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
            >课程标题</label
          >
          <input
            v-model="courseForm.title"
            type="text"
            placeholder="输入课程标题..."
            class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >课程分类</label
            >
            <select
              v-model="courseForm.categoryId"
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none appearance-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            >
              <option value="">请选择分类</option>
              <option v-for="cat in props.categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >难度等级</label
            >
            <select
              v-model="courseForm.difficulty"
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none appearance-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            >
              <option value="BEGINNER">入门</option>
              <option value="INTERMEDIATE">进阶</option>
              <option value="ADVANCED">高级</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
            >发布状态</label
          >
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="courseForm.status"
                type="radio"
                value="PUBLISHED"
                class="accent-accent"
              />
              <span class="text-sm font-medium" style="color: var(--text-primary)">发布</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="courseForm.status"
                type="radio"
                value="DRAFT"
                class="accent-accent"
              />
              <span class="text-sm font-medium" style="color: var(--text-primary)">草稿</span>
            </label>
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
            >课程描述</label
          >
          <textarea
            v-model="courseForm.description"
            rows="3"
            placeholder="输入课程简介..."
            class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          ></textarea>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
            >封面图链接</label
          >
          <input
            v-model="courseForm.thumbnail"
            type="text"
            placeholder="https://..."
            class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
      </div>
      <div class="flex items-center gap-4 mt-8">
        <button type="button" class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer" @click="visible = false">
          取消
        </button>
        <button type="button" class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20 cursor-pointer" @click="handleSaveCourse">
          保存课程
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.animate-fade-in {
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>

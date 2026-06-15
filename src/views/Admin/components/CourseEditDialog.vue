<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
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
    ElMessage.warning(t('admin.please_enter_course_title'));
    return;
  }
  try {
    if (currentCourse.value) {
      await api.put(`/api/admin/courses/${currentCourse.value.id}`, courseForm.value);
      ElMessage.success(t('admin.course_updated_successfully'));
    } else {
      await api.post('/api/admin/courses', courseForm.value);
      ElMessage.success(t('admin.course_created_successfully'));
    }
    visible.value = false;
    emit('saved');
  } catch (_error) {
    ElMessage.error(t('admin.failed_to_save_course'));
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
        {{ currentCourse ? t('admin.edit_course') : $t('admin.create_new_course') }}
      </h3>
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{{
            $t('admin.course_title')
          }}</label>
          <input
            v-model="courseForm.title"
            type="text"
            :placeholder="$t('admin.enter_course_title')"
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
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{{
              $t('admin.course_classification')
            }}</label>
            <select
              v-model="courseForm.categoryId"
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none appearance-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            >
              <option value="">{{ $t('admin.please_select_a_category') }}</option>
              <option v-for="cat in props.categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{{
              $t('admin.difficulty_level')
            }}</label>
            <select
              v-model="courseForm.difficulty"
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none appearance-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            >
              <option value="BEGINNER">{{ $t('admin.getting_started') }}</option>
              <option value="INTERMEDIATE">{{ $t('admin.advanced') }}</option>
              <option value="ADVANCED">{{ $t('admin.advanced_1') }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{{
            $t('admin.release_status')
          }}</label>
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="courseForm.status"
                type="radio"
                value="PUBLISHED"
                class="accent-accent"
              />
              <span class="text-sm font-medium" style="color: var(--text-primary)">{{
                $t('admin.publish')
              }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="courseForm.status" type="radio" value="DRAFT" class="accent-accent" />
              <span class="text-sm font-medium" style="color: var(--text-primary)">{{
                $t('admin.draft')
              }}</span>
            </label>
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{{
            $t('admin.course_description')
          }}</label>
          <textarea
            v-model="courseForm.description"
            rows="3"
            :placeholder="$t('admin.enter_course_description')"
            class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          ></textarea>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{{
            $t('admin.cover_image_link')
          }}</label>
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
        <button
          type="button"
          class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
          @click="visible = false"
        >
          取消
        </button>
        <button
          type="button"
          class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20 cursor-pointer"
          @click="handleSaveCourse"
        >
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

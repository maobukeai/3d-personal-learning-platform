<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, onMounted, computed } from 'vue';
import {
  Plus,
  Search,
  BookOpen,
  Video,
  Trash2,
  Edit2,
  ChevronRight,
  GripVertical,
  Link as LinkIcon,
  FolderTree,
  Star,
  Eye,
  EyeOff,
  Clock,
  Users,
  RefreshCw,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import type { Category, Course } from '@/types';

// Subcomponents
import CourseEditDialog from './components/CourseEditDialog.vue';
import CategoryEditDialog from './components/CategoryEditDialog.vue';
import CourseImportDialog from './components/CourseImportDialog.vue';
import LessonEditDialog from './components/LessonEditDialog.vue';
import { fetchManagementInsights } from './adminManagementInsights';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Badge from '@/components/ui/Badge.vue';

const router = useRouter();

const courses = ref<Course[]>([]);
const categories = ref<Category[]>([]);
const isLoading = ref(true);
const activeTab = ref<'courses' | 'categories'>('courses');

// Subcomponent References
const courseEditDialogRef = ref<InstanceType<typeof CourseEditDialog> | null>(null);
const categoryEditDialogRef = ref<InstanceType<typeof CategoryEditDialog> | null>(null);
const courseImportDialogRef = ref<InstanceType<typeof CourseImportDialog> | null>(null);
const lessonEditDialogRef = ref<InstanceType<typeof LessonEditDialog> | null>(null);

const handleTabChange = (tab: string | number | null) => {
  if (tab === 'categories') {
    router.push('/admin/categories');
    setTimeout(() => {
      activeTab.value = 'courses';
    }, 100);
  } else if (tab === 'courses') {
    activeTab.value = tab;
  }
};

const searchQuery = ref('');
const sortBy = ref<'newest' | 'enrollments' | 'rating'>('newest');
const statusFilter = ref<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
const setStatusFilter = (key: string) => {
  if (key === 'ALL' || key === 'PUBLISHED' || key === 'DRAFT') {
    statusFilter.value = key;
  }
};

const courseStats = computed(() => {
  const total = courses.value.length;
  const published = courses.value.filter((c) => c.status === 'PUBLISHED').length;
  const draft = courses.value.filter((c) => c.status === 'DRAFT').length;
  const totalEnrollments = courses.value.reduce((sum, c) => sum + (c._count?.enrollments || 0), 0);
  const totalLessons = courses.value.reduce((sum, c) => sum + (c.lessons?.length || 0), 0);
  return { total, published, draft, totalEnrollments, totalLessons };
});

const getBadgeVariant = (label: string) => {
  if (label === '正常' || label === '稳定') return 'success';
  if (label === '关注') return 'warning';
  if (label === '高压') return 'danger';
  return 'primary';
};

const courseTabOptions = [
  { label: '课程列表', value: 'courses' },
  { label: '分类管理', value: 'categories' },
];

const presetTabOptions = computed(() => [
  { label: `全部课程 (${courseStats.value.total})`, value: 'ALL', icon: BookOpen },
  { label: `已发布 (${courseStats.value.published})`, value: 'PUBLISHED', icon: Eye },
  { label: `草稿 (${courseStats.value.draft})`, value: 'DRAFT', icon: EyeOff },
]);

const consolidatedCards = computed(() => {
  const stats = courseStats.value;
  const avgLessons = stats.total > 0 ? Math.round(stats.totalLessons / stats.total) : 0;
  return [
    {
      label: '课程规模',
      value: stats.total,
      hint: `${stats.published} 已发布 · ${stats.draft} 草稿`,
      icon: BookOpen,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      health: { label: '正常' },
    },
    {
      label: '教学总课时',
      value: stats.totalLessons,
      hint: `平均 ${avgLessons} 节/课`,
      icon: Clock,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: '稳定' },
    },
    {
      label: '累计学习人次',
      value: stats.totalEnrollments,
      hint: `全站学习总量`,
      icon: Users,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health: { label: '正常' },
    },
    {
      label: '分类规模',
      value: categories.value.length,
      hint: `已建立课程分类`,
      icon: FolderTree,
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      health: { label: '正常' },
    },
  ];
});

const expandedCourseIds = ref<Set<string>>(new Set());

const difficultyMap: Record<string, { label: string; color: string }> = {
  BEGINNER: { label: t('admin.getting_started'), color: 'text-emerald-500 bg-emerald-500/10' },
  INTERMEDIATE: { label: t('admin.advanced'), color: 'text-amber-500 bg-amber-500/10' },
  ADVANCED: { label: t('admin.advanced_1'), color: 'text-rose-500 bg-rose-500/10' },
};

const toggleCourseExpansion = (courseId: string) => {
  if (expandedCourseIds.value.has(courseId)) {
    expandedCourseIds.value.delete(courseId);
  } else {
    expandedCourseIds.value.add(courseId);
  }
};

const fetchCourses = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/admin/courses');
    courses.value = data;
    const existingIds = new Set(courses.value.map((course) => course.id));
    selectedCourseIds.value = new Set(
      Array.from(selectedCourseIds.value).filter((id) => existingIds.has(id)),
    );
    fetchManagementInsights(true);
  } catch (error) {
    console.error('Fetch courses error:', error);
  } finally {
    isLoading.value = false;
  }
};

const fetchCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/course-categories');
    categories.value = data;
  } catch (error) {
    console.error('Fetch categories error:', error);
  }
};

const filteredCourses = computed(() => {
  let list = [...courses.value];
  if (statusFilter.value !== 'ALL') {
    list = list.filter((c) => c.status === statusFilter.value);
  }
  if (searchQuery.value) {
    list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.value.toLowerCase()),
    );
  }
  switch (sortBy.value) {
    case 'newest':
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'enrollments':
      return list.sort((a, b) => (b._count?.enrollments || 0) - (a._count?.enrollments || 0));
    case 'rating':
      return list.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    default:
      return list;
  }
});

const selectedCourseIds = ref<Set<string>>(new Set());
const selectedCourseCount = computed(() => selectedCourseIds.value.size);
const selectedCourseIdList = computed(() => Array.from(selectedCourseIds.value));
const allFilteredSelected = computed(
  () =>
    filteredCourses.value.length > 0 &&
    filteredCourses.value.every((course) => selectedCourseIds.value.has(course.id)),
);

const isCourseSelected = (courseId: string) => selectedCourseIds.value.has(courseId);

const toggleCourseSelection = (courseId: string) => {
  const next = new Set(selectedCourseIds.value);
  if (next.has(courseId)) {
    next.delete(courseId);
  } else {
    next.add(courseId);
  }
  selectedCourseIds.value = next;
};

const toggleAllFilteredCourses = () => {
  const next = new Set(selectedCourseIds.value);
  if (allFilteredSelected.value) {
    filteredCourses.value.forEach((course) => next.delete(course.id));
  } else {
    filteredCourses.value.forEach((course) => next.add(course.id));
  }
  selectedCourseIds.value = next;
};

const clearCourseSelection = () => {
  selectedCourseIds.value = new Set();
};

const batchUpdateCourseStatus = async (status: 'PUBLISHED' | 'DRAFT') => {
  if (selectedCourseCount.value === 0) {
    ElMessage.warning('请先选择课程');
    return;
  }
  try {
    await api.put('/api/admin/courses/batch-status', {
      ids: selectedCourseIdList.value,
      status,
    });
    ElMessage.success(status === 'PUBLISHED' ? '已批量发布课程' : '已批量转为草稿');
    clearCourseSelection();
    await fetchCourses();
  } catch (error) {
    ElMessage.error('批量更新课程状态失败');
  }
};

const batchDeleteCourses = async () => {
  if (selectedCourseCount.value === 0) {
    ElMessage.warning('请先选择课程');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedCourseCount.value} 门课程吗？关联课时也会一并删除。`,
      '批量删除确认',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch {
    return;
  }

  try {
    await api.delete('/api/admin/courses/batch', {
      data: { ids: selectedCourseIdList.value },
    });
    ElMessage.success('已批量删除课程');
    clearCourseSelection();
    await fetchCourses();
  } catch (error) {
    ElMessage.error('批量删除课程失败');
  }
};

const handleDeleteCategory = async (id: string) => {
  try {
    await ElMessageBox.confirm(t('admin.are_you_sure_you_12'), t('admin.delete_confirmation'), {
      confirmButtonText: t('admin.confirm_deletion_1'),
      cancelButtonText: t('admin.cancel'),
      type: 'warning',
    });
  } catch {
    return;
  }

  try {
    await api.delete(`/api/admin/course-categories/${id}`);
    ElMessage.success(t('admin.category_deleted'));
    fetchCategories();
    fetchCourses();
  } catch (_error) {
    ElMessage.error(t('admin.failed_to_delete_category'));
  }
};

const handleDeleteCourse = async (id: string) => {
  try {
    await ElMessageBox.confirm(t('admin.are_you_sure_you_15'), t('admin.delete_confirmation'), {
      confirmButtonText: t('admin.confirm_deletion_1'),
      cancelButtonText: t('admin.cancel'),
      type: 'warning',
    });
  } catch {
    return;
  }

  try {
    await api.delete(`/api/admin/courses/${id}`);
    ElMessage.success(t('admin.course_deleted'));
    fetchCourses();
  } catch (error) {
    ElMessage.error(t('admin.failed_to_delete_course'));
  }
};

const toggleCourseStatus = async (course: Course) => {
  const newStatus = course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
  try {
    await api.put(`/api/admin/courses/${course.id}`, { ...course, status: newStatus });
    fetchCourses();
    ElMessage.success(
      newStatus === 'PUBLISHED'
        ? t('admin.course_published')
        : t('admin.course_has_been_converted'),
    );
  } catch (_error) {
    ElMessage.error(t('admin.update_status_failed'));
  }
};

const handleDeleteLesson = async (id: string) => {
  try {
    await ElMessageBox.confirm(t('admin.are_you_sure_you_14'), t('admin.delete_confirmation'), {
      confirmButtonText: t('admin.confirm_deletion_1'),
      cancelButtonText: t('admin.cancel'),
      type: 'warning',
    });
  } catch {
    return;
  }

  try {
    await api.delete(`/api/admin/courses/lessons/${id}`);
    ElMessage.success(t('admin.class_has_been_deleted'));
    fetchCourses();
  } catch (error) {
    ElMessage.error(t('admin.failed_to_delete_class'));
  }
};

onMounted(() => {
  fetchCourses();
  fetchCategories();
});
</script>

<template>
  <div
    class="admin-courses-page flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)]"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide">
      <!-- 奢华顶栏 (PageHeader card variant) -->
      <PageHeader title="学院课程" subtitle="系统课程与课时资源管理" variant="card">
        <template #center>
          <div class="overflow-x-auto scrollbar-hide shrink-0 max-w-full">
            <Tabs
              v-model="activeTab"
              :options="courseTabOptions"
              size="sm"
              @update:model-value="handleTabChange"
            />
          </div>
        </template>

        <!-- Compact Search Box -->
        <label class="search-box !min-h-0 !h-8 w-44 sm:w-60 shrink-0">
          <Search />
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="$t('admin.search_course_title_or')"
          />
        </label>

        <!-- Action Buttons -->
        <Button
          variant="secondary"
          size="sm"
          :icon="LinkIcon"
          @click="courseImportDialogRef?.open()"
        >
          导入
        </Button>
        <Button variant="primary" size="sm" :icon="Plus" @click="courseEditDialogRef?.open()">
          新建课程
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchCourses"
        >
          刷新
        </Button>
      </PageHeader>

      <!-- KPI Metrics Grid -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card
          v-for="card in consolidatedCards"
          :key="card.label"
          hoverable
          glow
          class="group !p-2 px-2.5"
        >
          <div class="flex items-center justify-between w-full gap-3">
            <!-- Left: Icon & Info -->
            <div class="flex items-center gap-2.5 min-w-0">
              <span
                class="panel-icon border border-base rounded-lg p-1.5 transition-transform group-hover:scale-105 shrink-0"
                :class="card.color"
              >
                <component :is="card.icon" class="h-3.5 w-3.5" />
              </span>
              <div class="min-w-0">
                <p
                  class="text-[11px] font-bold text-[var(--text-secondary)] truncate leading-tight"
                >
                  {{ card.label }}
                </p>
                <p
                  class="text-[9px] text-[var(--text-secondary)] opacity-80 truncate mt-0.5 leading-none"
                  :title="card.hint"
                >
                  {{ card.hint }}
                </p>
              </div>
            </div>

            <!-- Right: Metric & Health Badge -->
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-base font-black text-[var(--text-primary)] leading-none">
                {{ card.value.toLocaleString() }}
              </span>
              <Badge :variant="getBadgeVariant(card.health.label)">
                {{ card.health.label }}
              </Badge>
            </div>
          </div>
        </Card>
      </section>

      <!-- Workspace layout: Single Column Workspace -->
      <div class="mt-3 w-full min-w-0">
        <div class="space-y-3 min-w-0">
          <!-- Workbench Toolbar / Batch Operations Card -->
          <Card v-if="activeTab === 'courses'" padding="sm" class="workbench-toolbar-card">
            <div class="toolbar-top">
              <div
                class="flex items-center gap-3 overflow-x-auto scrollbar-hide shrink-0 max-w-full"
              >
                <!-- Checkbox to Select All -->
                <label
                  class="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] border-r border-slate-200 dark:border-slate-800 pr-3 shrink-0 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    :checked="allFilteredSelected"
                    :disabled="filteredCourses.length === 0"
                    @change="toggleAllFilteredCourses"
                  />
                  <span>全选</span>
                  <span class="text-[var(--text-muted)]">({{ selectedCourseCount }})</span>
                </label>

                <!-- Status Preset Tabs -->
                <Tabs v-model="statusFilter" :options="presetTabOptions" size="sm" />
              </div>

              <div class="toolbar-actions">
                <div class="text-[10px] font-bold text-slate-400 shrink-0">排序:</div>
                <el-select v-model="sortBy" size="small" style="width: 100px">
                  <el-option value="newest" :label="$t('admin.latest_creation')" />
                  <el-option value="enrollments" :label="$t('admin.most_registrations')" />
                  <el-option value="rating" :label="$t('admin.top_rated')" />
                </el-select>

                <div class="text-[10px] font-bold text-[var(--text-muted)] shrink-0 ml-2">
                  匹配:
                  <span class="text-indigo-600 font-extrabold">{{ filteredCourses.length }}</span> /
                  {{ courses.length }}
                </div>
              </div>
            </div>

            <!-- Batch Operations Toolbar -->
            <div v-if="selectedCourseCount" class="batch-bar">
              <div>
                已选 <strong>{{ selectedCourseCount }}</strong> 门课程
              </div>
              <div class="batch-actions">
                <el-button size="small" @click="batchUpdateCourseStatus('PUBLISHED')">
                  批量发布
                </el-button>
                <el-button size="small" @click="batchUpdateCourseStatus('DRAFT')">
                  转为草稿
                </el-button>
                <el-button size="small" type="danger" plain @click="batchDeleteCourses">
                  批量删除
                </el-button>
                <el-button size="small" text @click="clearCourseSelection">取消选择</el-button>
              </div>
            </div>
          </Card>

          <div v-if="isLoading" class="flex flex-col items-center justify-center py-24">
            <div
              class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"
            ></div>
          </div>

          <div v-else class="max-w-none space-y-6">
            <!-- Courses List -->
            <template v-if="activeTab === 'courses'">
              <div
                v-for="course in filteredCourses"
                :key="course.id"
                class="group rounded-3xl border overflow-hidden transition-all hover:shadow-lg animate-fade-in"
                style="background-color: var(--bg-card); border-color: var(--border-base)"
              >
                <div class="p-3.5 sm:p-6 flex items-center gap-3 sm:gap-6">
                  <input
                    type="checkbox"
                    class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                    :checked="isCourseSelected(course.id)"
                    @click.stop
                    @change="toggleCourseSelection(course.id)"
                  />
                  <!-- Thumbnail -->
                  <div
                    class="w-16 sm:w-40 aspect-video rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden shrink-0 relative"
                  >
                    <img
                      v-if="course.thumbnail"
                      alt=""
                      :src="course.thumbnail"
                      referrerpolicy="no-referrer"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <BookOpen class="w-8 h-8 text-slate-300" />
                    </div>
                    <div
                      v-if="course.status === 'DRAFT'"
                      class="absolute inset-0 bg-black/50 flex items-center justify-center"
                    >
                      <span
                        class="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 text-slate-300"
                        >{{ $t('admin.draft') }}</span
                      >
                    </div>
                  </div>

                  <!-- Info -->
                  <div
                    class="flex-1 min-w-0 cursor-pointer"
                    @click="toggleCourseExpansion(course.id)"
                  >
                    <div class="flex items-start justify-between gap-4 mb-2">
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 mb-1 min-w-0 flex-wrap">
                          <span
                            v-if="course.category"
                            class="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-bold shrink-0"
                            >{{ course.category.name }}</span
                          >
                          <span
                            :class="
                              difficultyMap[course.difficulty]?.color ||
                              'text-slate-400 bg-slate-400/10'
                            "
                            class="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0"
                          >
                            {{
                              difficultyMap[course.difficulty]?.label || $t('admin.getting_started')
                            }}
                          </span>
                          <h3
                            class="font-bold text-sm sm:text-xl truncate"
                            style="color: var(--text-primary)"
                          >
                            {{ course.title }}
                          </h3>
                          <ChevronRight
                            class="w-4 h-4 text-slate-300 transition-transform duration-300 shrink-0"
                            :class="{ 'rotate-90': expandedCourseIds.has(course.id) }"
                          />
                        </div>
                        <p class="text-xs text-slate-400 line-clamp-2">{{ course.description }}</p>
                      </div>
                      <div class="flex items-center gap-2 shrink-0" @click.stop>
                        <button
                          type="button"
                          class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          :title="
                            course.status === 'PUBLISHED'
                              ? $t('admin.convert_to_draft')
                              : $t('admin.publish_course')
                          "
                          @click="toggleCourseStatus(course)"
                        >
                          <Eye
                            v-if="course.status === 'PUBLISHED'"
                            class="w-4 h-4 text-emerald-500"
                          />
                          <EyeOff v-else class="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                          type="button"
                          class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 transition-colors cursor-pointer"
                          @click="courseEditDialogRef?.open(course)"
                        >
                          <Edit2 class="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          @click="handleDeleteCourse(course.id)"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div class="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                      <span class="flex items-center gap-1.5"
                        ><Video class="w-3.5 h-3.5" />
                        {{
                          $t('admin.lessons_count', { count: course.lessons?.length || 0 })
                        }}</span
                      >
                      <span>•</span>
                      <span>{{
                        $t('admin.enrollments_count', { count: course._count?.enrollments || 0 })
                      }}</span>
                      <span>•</span>
                      <span class="flex items-center gap-1"
                        ><Star class="w-3 h-3 text-amber-400" /> {{ course.avgRating || '-' }}</span
                      >
                      <span v-if="course._count?.reviews">•</span>
                      <span v-if="course._count?.reviews">{{
                        $t('admin.reviews_count', { count: course._count?.reviews || 0 })
                      }}</span>
                    </div>
                  </div>
                </div>

                <!-- Lessons List Accordion -->
                <div
                  v-if="expandedCourseIds.has(course.id)"
                  class="border-t p-4 transition-all duration-300 animate-fade-in"
                  style="background-color: var(--bg-app); border-color: var(--border-base)"
                >
                  <div class="space-y-2">
                    <div
                      v-for="lesson in course.lessons"
                      :key="lesson.id"
                      class="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-transparent hover:border-accent/20 transition-all group/lesson shadow-sm"
                    >
                      <div class="flex items-center gap-3">
                        <GripVertical class="w-4 h-4 text-slate-300" />
                        <span
                          class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-400"
                          >{{ lesson.order }}</span
                        >
                        <span
                          class="text-sm font-bold truncate max-w-md"
                          style="color: var(--text-primary)"
                          >{{ lesson.title }}</span
                        >
                        <span
                          v-if="lesson.duration"
                          class="flex items-center gap-1 text-[10px] text-slate-400"
                        >
                          <Clock class="w-3 h-3" /> {{ lesson.duration }}分钟
                        </span>
                      </div>
                      <div
                        class="flex items-center gap-1 md:opacity-0 md:group-hover/lesson:opacity-100 transition-opacity shrink-0"
                      >
                        <button
                          type="button"
                          class="p-1.5 rounded-lg text-slate-400 hover:text-accent cursor-pointer"
                          @click="lessonEditDialogRef?.open(course, lesson)"
                        >
                          <Edit2 class="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                          @click="handleDeleteLesson(lesson.id)"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/5 text-slate-400 hover:text-accent hover:border-accent/40 transition-all text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                      @click="lessonEditDialogRef?.open(course)"
                    >
                      <Plus class="w-4 h-4" />
                      添加课时
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <!-- Categories List -->
            <template v-else>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  v-for="cat in categories"
                  :key="cat.id"
                  class="p-6 rounded-3xl border flex items-center justify-between transition-all hover:shadow-md animate-fade-in"
                  style="background-color: var(--bg-card); border-color: var(--border-base)"
                >
                  <div class="flex items-center gap-4">
                    <div
                      class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent"
                    >
                      <FolderTree class="w-5 h-5" />
                    </div>
                    <div>
                      <h4 class="font-bold text-lg" style="color: var(--text-primary)">
                        {{ cat.name }}
                      </h4>
                      <p class="text-xs text-slate-400">
                        排序: {{ cat.order }} · {{ cat._count?.courses || 0 }} 门课程
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 transition-colors cursor-pointer"
                      @click="categoryEditDialogRef?.open(cat)"
                    >
                      <Edit2 class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      @click="handleDeleteCategory(cat.id)"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-if="categories.length === 0" class="py-24 text-center">
                <FolderTree class="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p class="text-slate-400 font-medium">{{ $t('admin.there_is_no_category') }}</p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </main>

    <!-- Modals Subcomponents -->
    <CourseEditDialog ref="courseEditDialogRef" :categories="categories" @saved="fetchCourses" />

    <CategoryEditDialog
      ref="categoryEditDialogRef"
      :categories-count="categories.length"
      @saved="
        () => {
          fetchCategories();
          fetchCourses();
        }
      "
    />

    <CourseImportDialog
      ref="courseImportDialogRef"
      :categories="categories"
      @saved="fetchCourses"
    />

    <LessonEditDialog ref="lessonEditDialogRef" @saved="fetchCourses" />
  </div>
</template>

<style scoped>
.admin-courses-page {
  height: 100%;
  min-height: 0;
  background: transparent;
  color: var(--text-primary);
}

.toolbar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex: 0 0 auto;
}

.search-box {
  width: min(320px, 28vw);
  height: 34px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 8px;
}

.search-box :deep(svg) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--text-muted);
}

.search-box input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 11px;
}

.batch-bar {
  margin: 10px 0 0;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #334155;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>

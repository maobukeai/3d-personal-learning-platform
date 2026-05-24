<script setup lang="ts">
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
  GraduationCap,
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

const handleTabChange = (tab: 'courses' | 'categories') => {
  if (tab === 'categories') {
    router.push('/admin/categories');
  } else {
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

const expandedCourseIds = ref<Set<string>>(new Set());

const difficultyMap: Record<string, { label: string; color: string }> = {
  BEGINNER: { label: '入门', color: 'text-emerald-500 bg-emerald-500/10' },
  INTERMEDIATE: { label: '进阶', color: 'text-amber-500 bg-amber-500/10' },
  ADVANCED: { label: '高级', color: 'text-rose-500 bg-rose-500/10' },
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

const handleDeleteCategory = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个分类吗？', '删除确认', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }

  try {
    await api.delete(`/api/admin/course-categories/${id}`);
    ElMessage.success('分类已删除');
    fetchCategories();
    fetchCourses();
  } catch (_error) {
    ElMessage.error('删除分类失败');
  }
};

const handleDeleteCourse = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个课程吗？所有关联的课时也将被删除。', '删除确认', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }

  try {
    await api.delete(`/api/admin/courses/${id}`);
    ElMessage.success('课程已删除');
    fetchCourses();
  } catch (error) {
    console.error('Delete course error:', error);
    ElMessage.error('删除课程失败');
  }
};

const toggleCourseStatus = async (course: Course) => {
  const newStatus = course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
  try {
    await api.put(`/api/admin/courses/${course.id}`, { ...course, status: newStatus });
    fetchCourses();
    ElMessage.success(newStatus === 'PUBLISHED' ? '课程已发布' : '课程已转为草稿');
  } catch (_error) {
    ElMessage.error('更新状态失败');
  }
};

const handleDeleteLesson = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个课时吗？', '删除确认', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }

  try {
    await api.delete(`/api/admin/courses/lessons/${id}`);
    ElMessage.success('课时已删除');
    fetchCourses();
  } catch (error) {
    console.error('Delete lesson error:', error);
    ElMessage.error('删除课时失败');
  }
};

onMounted(() => {
  fetchCourses();
  fetchCategories();
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- 奢华顶栏 (超紧凑高阶版) -->
    <div
      class="relative shrink-0 border-b overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- 极光背景装饰 -->
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 选项卡 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2.5 sm:gap-4 shrink-0">
          <div class="flex items-center gap-2">
            <span
              class="p-1 rounded-xl bg-indigo-500/10 text-indigo-500 shadow-sm border border-indigo-500/20"
            >
              <BookOpen class="w-4 h-4" />
            </span>
            <h1 class="text-sm font-black tracking-tight" style="color: var(--text-primary)">
              学院课程
            </h1>
          </div>

          <!-- 分段选项卡 -->
          <div
            class="flex items-center bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg gap-0.5 shadow-inner shrink-0"
          >
            <button
type="button" class="px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0" :class="
                activeTab === 'courses'
                  ? 'bg-white dark:bg-white/10 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              " @click="handleTabChange('courses')">
              课程列表
            </button>
            <button
type="button" class="px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0" :class="
                activeTab === 'categories'
                  ? 'bg-white dark:bg-white/10 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              " @click="handleTabChange('categories')">
              分类管理
            </button>
          </div>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <button type="button" class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap" style="border-color: var(--border-base); color: var(--text-secondary)" @click="courseImportDialogRef?.open()">
            <LinkIcon class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">外部导入</span>
          </button>
          <button type="button" class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[11px] transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer" @click="courseEditDialogRef?.open()">
            <Plus class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">新建课程</span>
          </button>
          <button type="button" class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap" style="border-color: var(--border-base); color: var(--text-secondary)" @click="fetchCourses">
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span class="hidden sm:inline">刷新</span>
          </button>
        </div>
      </div>

      <!-- Row 2: 状态筛选 Pills & 检索工具栏 -->
      <div
        class="px-4 sm:px-8 py-2 flex flex-col lg:flex-row lg:flex-wrap lg:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
      >
        <!-- 状态筛选 Pills -->
        <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
          <div class="flex flex-nowrap items-center gap-0.5 sm:gap-1.5 shrink-0">
            <button
v-for="filter in [
                {
                  key: 'ALL',
                  label: '所有课程',
                  count: courseStats.total,
                  color: 'indigo',
                  icon: BookOpen,
                },
                {
                  key: 'PUBLISHED',
                  label: '已发布',
                  count: courseStats.published,
                  color: 'emerald',
                  icon: Eye,
                },
                {
                  key: 'DRAFT',
                  label: '草稿',
                  count: courseStats.draft,
                  color: 'amber',
                  icon: EyeOff,
                },
              ]" :key="filter.key" type="button" class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0" :class="[
                statusFilter === filter.key
                  ? filter.key === 'PUBLISHED'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20 font-extrabold shadow-sm'
                    : filter.key === 'DRAFT'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 ring-1 ring-amber-500/20 font-extrabold shadow-sm'
                      : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 ring-1 ring-indigo-500/20 font-extrabold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
              ]" @click="setStatusFilter(filter.key)">
              <component :is="filter.icon" class="w-2 h-2 sm:w-3 sm:h-3" />
              <span>{{ filter.label }}</span>
              <span class="opacity-60">({{ filter.count }})</span>
            </button>
          </div>
          <span class="text-[8px] opacity-45 px-1 sm:px-2 shrink-0">|</span>
          <span
            class="text-[8px] xs:text-[9px] sm:text-[10px] text-slate-400 font-bold flex items-center gap-0.5 sm:gap-1 shrink-0"
          >
            <GraduationCap class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-indigo-500" /> 总课时:
            {{ courseStats.totalLessons }}
          </span>
          <span
            class="text-[8px] xs:text-[9px] sm:text-[10px] text-slate-400 font-bold flex items-center gap-0.5 sm:gap-1 shrink-0"
          >
            <Users class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-indigo-500" /> 总报名:
            {{ courseStats.totalEnrollments }}
          </span>
        </div>

        <!-- 检索与排序 -->
        <div
          class="flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto shrink-0"
        >
          <select
            v-model="sortBy"
            class="px-2 py-1.5 rounded-lg border text-[11px] font-bold outline-none cursor-pointer shrink-0"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          >
            <option value="newest">最新创建</option>
            <option value="enrollments">报名最多</option>
            <option value="rating">评分最高</option>
          </select>

          <div class="relative flex-1 lg:flex-none lg:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索课程标题或描述..."
              class="w-full pl-9 pr-3 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div class="text-[10px] font-bold text-right shrink-0" style="color: var(--text-muted)">
            匹配: <span class="text-indigo-600 font-extrabold">{{ filteredCourses.length }}</span> /
            {{ courses.length }}
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24">
        <div
          class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"
        ></div>
      </div>

      <div v-else class="max-w-5xl mx-auto space-y-6">
        <!-- Courses List -->
        <template v-if="activeTab === 'courses'">
          <div
            v-for="course in filteredCourses"
            :key="course.id"
            class="group rounded-3xl border overflow-hidden transition-all hover:shadow-lg animate-fade-in"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <div class="p-3.5 sm:p-6 flex items-center gap-3 sm:gap-6">
              <!-- Thumbnail -->
              <div
                class="w-16 sm:w-40 aspect-video rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden shrink-0 relative"
              >
                <img v-if="course.thumbnail" alt="" :src="course.thumbnail" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <BookOpen class="w-8 h-8 text-slate-300" />
                </div>
                <div
                  v-if="course.status === 'DRAFT'"
                  class="absolute inset-0 bg-black/50 flex items-center justify-center"
                >
                  <span class="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 text-slate-300"
                    >草稿</span
                  >
                </div>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0 cursor-pointer" @click="toggleCourseExpansion(course.id)">
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
                        {{ difficultyMap[course.difficulty]?.label || '入门' }}
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
                    <button type="button" class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer" :title="course.status === 'PUBLISHED' ? '转为草稿' : '发布课程'" @click="toggleCourseStatus(course)">
                      <Eye v-if="course.status === 'PUBLISHED'" class="w-4 h-4 text-emerald-500" />
                      <EyeOff v-else class="w-4 h-4 text-slate-400" />
                    </button>
                    <button type="button" class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 transition-colors cursor-pointer" @click="courseEditDialogRef?.open(course)">
                      <Edit2 class="w-4 h-4" />
                    </button>
                    <button type="button" class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer" @click="handleDeleteCourse(course.id)">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                  <span class="flex items-center gap-1.5"
                    ><Video class="w-3.5 h-3.5" /> {{ course.lessons?.length || 0 }} 课时</span
                  >
                  <span>•</span>
                  <span>{{ course._count?.enrollments || 0 }} 人已参加</span>
                  <span>•</span>
                  <span class="flex items-center gap-1"
                    ><Star class="w-3 h-3 text-amber-400" /> {{ course.avgRating || '-' }}</span
                  >
                  <span v-if="course._count?.reviews">•</span>
                  <span v-if="course._count?.reviews">{{ course._count.reviews }} 评价</span>
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
                    <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-accent cursor-pointer" @click="lessonEditDialogRef?.open(course, lesson)">
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer" @click="handleDeleteLesson(lesson.id)">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <button type="button" class="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/5 text-slate-400 hover:text-accent hover:border-accent/40 transition-all text-xs font-bold flex items-center justify-center gap-2 cursor-pointer" @click="lessonEditDialogRef?.open(course)">
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
                <button type="button" class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 transition-colors cursor-pointer" @click="categoryEditDialogRef?.open(cat)">
                  <Edit2 class="w-4 h-4" />
                </button>
                <button type="button" class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer" @click="handleDeleteCategory(cat.id)">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="categories.length === 0" class="py-24 text-center">
            <FolderTree class="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p class="text-slate-400 font-medium">暂无分类，点击右上方"新建分类"开始</p>
          </div>
        </template>
      </div>
    </div>

    <!-- Modals Subcomponents -->
    <CourseEditDialog
      ref="courseEditDialogRef"
      :categories="categories"
      @saved="fetchCourses"
    />

    <CategoryEditDialog
      ref="categoryEditDialogRef"
      :categories-count="categories.length"
      @saved="() => { fetchCategories(); fetchCourses() }"
    />

    <CourseImportDialog
      ref="courseImportDialogRef"
      :categories="categories"
      @saved="fetchCourses"
    />

    <LessonEditDialog
      ref="lessonEditDialogRef"
      @saved="fetchCourses"
    />
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

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Search,
  PlayCircle,
  Star,
  ChevronRight,
  GraduationCap,
  BookOpen,
  Filter,
  Users,
  Sparkles,
  X,
  Clock,
  Trophy,
  Flame,
  Target,
  TrendingUp,
  Play,
  Bookmark,
  Heart,
} from 'lucide-vue-next';
import api from '@/utils/api';

const router = useRouter();
const searchQuery = ref('');
const categories = ref<any[]>([]);
const activeCategoryId = ref<string | null>(null);
const courses = ref<any[]>([]);
const myEnrollments = ref<any[]>([]);
const isLoading = ref(false);
const sortBy = ref<'newest' | 'popular' | 'rating'>('newest');
const difficultyFilter = ref<string | null>(null);
const showFilters = ref(false);
const bookmarkedCourseIds = ref<Set<string>>(new Set());

const difficultyMap: Record<string, { label: string; color: string; bg: string }> = {
  BEGINNER: { label: '入门', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  INTERMEDIATE: { label: '进阶', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ADVANCED: { label: '高级', color: 'text-rose-500', bg: 'bg-rose-500/10' },
};

const learningStats = computed(() => {
  const enrolled = myEnrollments.value;
  const totalCourses = enrolled.length;
  const completedCourses = enrolled.filter((e) => e.progress >= 100).length;
  const inProgressCourses = enrolled.filter((e) => e.progress > 0 && e.progress < 100).length;
  const totalLessons = enrolled.reduce((sum, e) => {
    return sum + (e.course?._count?.lessons || 0);
  }, 0);
  const avgProgress =
    totalCourses > 0
      ? Math.round(enrolled.reduce((sum, e) => sum + (e.progress || 0), 0) / totalCourses)
      : 0;
  return { totalCourses, completedCourses, inProgressCourses, totalLessons, avgProgress };
});

const continueLearningCourses = computed(() => {
  return myEnrollments.value
    .filter((e) => e.progress > 0 && e.progress < 100)
    .sort(
      (a, b) =>
        (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) -
        (a.updatedAt ? new Date(a.updatedAt).getTime() : 0),
    )
    .slice(0, 3);
});

const recommendedCourses = computed(() => {
  const enrolledIds = new Set(myEnrollments.value.map((e) => e.courseId));
  const enrolledCategories = new Set(
    myEnrollments.value.map((e) => e.course?.categoryId).filter(Boolean),
  );
  return courses.value
    .filter((c) => !enrolledIds.has(c.id))
    .filter((c) => enrolledCategories.size === 0 || enrolledCategories.has(c.categoryId))
    .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
    .slice(0, 4);
});

const fetchData = async () => {
  isLoading.value = true;
  try {
    const { useAuthStore } = await import('@/stores/auth');
    const authStore = useAuthStore();

    const promises: Promise<any>[] = [
      api.get('/api/courses', {
        params: { sort: sortBy.value, difficulty: difficultyFilter.value || undefined },
      }),
      api.get('/api/courses/categories'),
    ];

    if (authStore.isAuthenticated) {
      promises.push(api.get('/api/courses/my-enrollments'));
    }

    const results = await Promise.all(promises);
    courses.value = results[0].data;
    categories.value = results[1].data;

    if (authStore.isAuthenticated && results[2]) {
      myEnrollments.value = results[2].data;
    } else {
      myEnrollments.value = [];
    }
  } catch (error) {
    console.error('Fetch data error:', error);
  } finally {
    isLoading.value = false;
  }
};

const isEnrolled = (courseId: string) => {
  return myEnrollments.value.some((e) => e.courseId === courseId);
};

const getEnrollmentProgress = (courseId: string) => {
  const enrollment = myEnrollments.value.find((e) => e.courseId === courseId);
  return enrollment?.progress || 0;
};

const handleCourseClick = (courseId: string) => {
  router.push(`/academy/course/${courseId}`);
};

const continueLearning = (courseId: string) => {
  router.push(`/academy/course/${courseId}`);
};

const toggleBookmark = async (courseId: string, event?: Event) => {
  if (event) event.stopPropagation();
  if (bookmarkedCourseIds.value.has(courseId)) {
    bookmarkedCourseIds.value.delete(courseId);
  } else {
    bookmarkedCourseIds.value.add(courseId);
  }
};

const isBookmarked = (courseId: string) => {
  return bookmarkedCourseIds.value.has(courseId);
};

const filteredCourses = computed(() => {
  let list = courses.value;

  if (activeCategoryId.value === 'mine') {
    list = myEnrollments.value.map((e) => e.course);
  } else if (activeCategoryId.value === 'bookmarked') {
    list = courses.value.filter((c) => bookmarkedCourseIds.value.has(c.id));
  } else if (activeCategoryId.value) {
    list = courses.value.filter((c) => c.categoryId === activeCategoryId.value);
  }

  if (searchQuery.value) {
    list = list.filter(
      (course) =>
        course.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchQuery.value.toLowerCase()),
    );
  }

  return list;
});

const featuredCourses = computed(() => {
  return courses.value.filter((c) => c.avgRating >= 4 && c._count?.enrollments >= 0).slice(0, 4);
});

const activeCategory = computed(() => {
  if (activeCategoryId.value === 'mine') return '我的课程';
  if (activeCategoryId.value === 'bookmarked') return '我的收藏';
  if (!activeCategoryId.value) return '全部课程';
  const cat = categories.value.find((c) => c.id === activeCategoryId.value);
  return cat?.name || '全部课程';
});

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Top Header -->
    <div
      class="flex flex-col lg:flex-row gap-4 py-3 lg:py-5 px-3 sm:px-5 lg:px-6 lg:items-center justify-between shrink-0 border-b transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-accent-subtle rounded-xl">
          <GraduationCap class="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 class="text-lg md:text-2xl lg:text-3xl font-bold" style="color: var(--text-primary)">学院课程</h1>
          <p class="text-[10px] font-medium" style="color: var(--text-muted)">
            探索 3D 设计的无限可能
          </p>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
        <div class="relative w-full sm:min-w-[240px] lg:min-w-[160px]">
          <Search
            class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
            style="color: var(--text-muted)"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索课程..."
            class="pl-10 pr-4 py-2 rounded-xl border text-sm w-full outline-none transition-all lg:focus:w-72"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
          <button
            v-if="searchQuery"
            class="absolute right-3 top-1/2 -translate-y-1/2"
            @click="searchQuery = ''"
          >
            <X class="w-3.5 h-3.5" style="color: var(--text-muted)" />
          </button>
        </div>

        <div class="flex items-center gap-3 w-full sm:w-auto">
          <button
            class="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all shrink-0"
            :class="showFilters || difficultyFilter ? 'border-accent/30 text-accent' : ''"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="showFilters = !showFilters"
          >
            <Filter class="w-4 h-4" />
            筛选
          </button>

          <div class="flex-1 sm:flex-initial flex items-center gap-1 p-1 rounded-xl shrink-0" style="background-color: var(--bg-app)">
            <button
              v-for="sort in [
                { key: 'newest', label: '最新' },
                { key: 'popular', label: '最热' },
                { key: 'rating', label: '好评' },
              ]"
              :key="sort.key"
              class="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
              :class="
                sortBy === sort.key
                  ? 'bg-white dark:bg-white/10 shadow-sm text-accent'
                  : 'text-slate-400 hover:text-slate-600'
              "
              @click="
                sortBy = sort.key as any;
                fetchData();
              "
            >
              {{ sort.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div
      v-if="showFilters"
      class="px-3 sm:px-5 lg:px-6 py-2 sm:py-3 border-b flex flex-wrap items-center gap-3 sm:gap-4 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <span class="text-xs font-bold" style="color: var(--text-muted)">难度：</span>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="d in [
            { key: '', label: '全部' },
            { key: 'BEGINNER', label: '入门' },
            { key: 'INTERMEDIATE', label: '进阶' },
            { key: 'ADVANCED', label: '高级' },
          ]"
          :key="d.key"
          class="px-3 py-1 rounded-lg text-xs font-bold transition-all"
          :class="difficultyFilter === (d.key || null) ? 'bg-accent text-white' : 'hover:bg-slate-100 dark:hover:bg-white/5'"
          :style="difficultyFilter !== (d.key || null) ? 'color: var(--text-secondary)' : ''"
          @click="
            difficultyFilter = d.key || null;
            fetchData();
          "
        >
          {{ d.label }}
        </button>
      </div>
    </div>

    <!-- Category Tabs -->
    <div
      class="px-3 sm:px-5 lg:px-6 py-2 sm:py-3 border-b flex items-center gap-2 overflow-x-auto scrollbar-hide transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
        :class="
          !activeCategoryId ? 'bg-accent text-white shadow-md shadow-accent/20' : 'hover:opacity-80'
        "
        :style="activeCategoryId ? 'color: var(--text-secondary)' : ''"
        @click="activeCategoryId = null"
      >
        全部课程
      </button>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5"
        :class="
          activeCategoryId === 'mine'
            ? 'bg-accent text-white shadow-md shadow-accent/20'
            : 'hover:opacity-80'
        "
        :style="activeCategoryId !== 'mine' ? 'color: var(--text-secondary)' : ''"
        @click="activeCategoryId = 'mine'"
      >
        <BookOpen class="w-3.5 h-3.5" /> 我的课程
      </button>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5"
        :class="
          activeCategoryId === 'bookmarked'
            ? 'bg-accent text-white shadow-md shadow-accent/20'
            : 'hover:opacity-80'
        "
        :style="activeCategoryId !== 'bookmarked' ? 'color: var(--text-secondary)' : ''"
        @click="activeCategoryId = 'bookmarked'"
      >
        <Bookmark class="w-3.5 h-3.5" /> 我的收藏
      </button>
      <div
        class="h-4 w-[1px] mx-1 transition-colors duration-300"
        style="background-color: var(--border-base)"
      ></div>
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
        :class="
          activeCategoryId === cat.id
            ? 'bg-accent text-white shadow-md shadow-accent/20'
            : 'hover:opacity-80'
        "
        :style="activeCategoryId !== cat.id ? 'color: var(--text-secondary)' : ''"
        @click="activeCategoryId = cat.id"
      >
        {{ cat.name }}
        <span class="ml-1 text-[10px] opacity-60">{{ cat._count?.courses || 0 }}</span>
      </button>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 scrollbar-hide">
      <div class="max-w-7xl mx-auto space-y-10">
        <!-- My Courses: Learning Stats & Continue Learning -->
        <template v-if="activeCategoryId === 'mine' && myEnrollments.length > 0">
          <!-- Learning Stats -->
          <section>
            <div class="flex items-center gap-2 mb-3 sm:mb-4">
              <TrendingUp class="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
              <h2 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">学习概览</h2>
            </div>
            <!-- Stats Container: Fixed 5 columns on mobile, Grid on desktop -->
            <div class="grid grid-cols-5 gap-1.5 sm:gap-4">
              <div
                class="p-2 sm:p-5 glass-card flex flex-col items-center text-center"
              >
                <div class="flex items-center justify-center sm:justify-between w-full mb-1 sm:mb-2">
                  <span class="text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase">在学</span>
                  <BookOpen class="hidden sm:block w-4 h-4 text-accent" />
                </div>
                <p class="text-sm sm:text-3xl font-black text-accent">{{ learningStats.inProgressCourses }}</p>
              </div>
              <div
                class="p-2 sm:p-5 glass-card flex flex-col items-center text-center"
              >
                <div class="flex items-center justify-center sm:justify-between w-full mb-1 sm:mb-2">
                  <span class="text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase">已完成</span>
                  <Trophy class="hidden sm:block w-4 h-4 text-amber-500" />
                </div>
                <p class="text-sm sm:text-3xl font-black text-amber-500">
                  {{ learningStats.completedCourses }}
                </p>
              </div>
              <div
                class="p-2 sm:p-5 glass-card flex flex-col items-center text-center"
              >
                <div class="flex items-center justify-center sm:justify-between w-full mb-1 sm:mb-2">
                  <span class="text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase">课时</span>
                  <Clock class="hidden sm:block w-4 h-4 text-indigo-500" />
                </div>
                <p class="text-sm sm:text-3xl font-black text-indigo-500">{{ learningStats.totalLessons }}</p>
              </div>
              <div
                class="p-2 sm:p-5 glass-card flex flex-col items-center text-center"
              >
                <div class="flex items-center justify-center sm:justify-between w-full mb-1 sm:mb-2">
                  <span class="text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase">平均</span>
                  <Target class="hidden sm:block w-4 h-4 text-emerald-500" />
                </div>
                <p class="text-sm sm:text-3xl font-black text-emerald-500">{{ learningStats.avgProgress }}<span class="text-[8px] sm:text-sm">%</span></p>
              </div>
              <div
                class="p-2 sm:p-5 glass-card flex flex-col items-center text-center"
              >
                <div class="flex items-center justify-center sm:justify-between w-full mb-1 sm:mb-2">
                  <span class="text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase">报名</span>
                  <Flame class="hidden sm:block w-4 h-4 text-rose-500" />
                </div>
                <p class="text-sm sm:text-3xl font-black text-rose-500">{{ learningStats.totalCourses }}</p>
              </div>
            </div>
          </section>

          <!-- Continue Learning -->
          <section v-if="continueLearningCourses.length > 0">
            <div class="flex items-center gap-2 mb-4">
              <Play class="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              <h2 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">继续学习</h2>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="enrollment in continueLearningCourses"
                :key="enrollment.id"
                class="group flex gap-4 p-3.5 sm:p-4 glass-card glass-card-hover overflow-hidden cursor-pointer"
                @click="continueLearning(enrollment.course.id)"
              >
                <div
                  class="w-24 sm:w-28 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 shrink-0"
                >
                  <img
                    :src="
                      enrollment.course.thumbnail ||
                      'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60'
                    "
                    referrerpolicy="no-referrer"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <h3
                      class="text-sm font-bold line-clamp-1 group-hover:text-accent transition-colors"
                      style="color: var(--text-primary)"
                    >
                      {{ enrollment.course.title }}
                    </h3>
                    <p class="text-[10px] mt-1" style="color: var(--text-muted)">
                      {{ enrollment.course._count?.lessons || 0 }} 课时 ·
                      {{ enrollment.course.category?.name || '' }}
                    </p>
                  </div>
                  <div class="mt-2">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-[10px] font-bold text-emerald-500"
                        >{{ enrollment.progress }}% 完成</span
                      >
                    </div>
                    <div class="h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-emerald-500 rounded-full transition-all"
                        :style="{ width: enrollment.progress + '%' }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- Featured Section (only on "all" tab) -->
        <section
          v-if="
            !activeCategoryId && !searchQuery && !difficultyFilter && featuredCourses.length > 0
          "
        >
          <div class="flex items-center gap-2 mb-4 sm:mb-5">
            <Sparkles class="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <h2 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">精选推荐</h2>
          </div>
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
            <div
              v-for="course in featuredCourses"
              :key="course.id"
              class="group flex flex-col sm:flex-row gap-4 sm:gap-5 p-4 sm:p-5 glass-card glass-card-hover overflow-hidden cursor-pointer"
              @click="handleCourseClick(course.id)"
            >
              <div
                class="w-full sm:w-48 lg:w-56 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 shrink-0"
              >
                <img
                  :src="
                    course.thumbnail ||
                    'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60'
                  "
                  referrerpolicy="no-referrer"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div class="flex-1 min-w-0 flex flex-col justify-between py-1">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <span
                      v-if="course.category"
                      class="px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-bold"
                      >{{ course.category.name }}</span
                    >
                    <span
                      :class="[
                        difficultyMap[course.difficulty]?.bg,
                        difficultyMap[course.difficulty]?.color,
                      ]"
                      class="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                    >
                      {{ difficultyMap[course.difficulty]?.label || '入门' }}
                    </span>
                  </div>
                  <h3
                    class="text-base font-bold mb-2 line-clamp-2 leading-snug group-hover:text-accent transition-colors"
                    style="color: var(--text-primary)"
                  >
                    {{ course.title }}
                  </h3>
                  <p class="text-xs line-clamp-2" style="color: var(--text-muted)">
                    {{ course.description }}
                  </p>
                </div>
                <div
                  class="flex items-center gap-4 text-[10px] font-bold mt-3"
                  style="color: var(--text-muted)"
                >
                  <span class="flex items-center gap-1"
                    ><Star class="w-3 h-3 text-amber-400 fill-amber-400" />
                    {{ course.avgRating || '-' }}</span
                  >
                  <span class="flex items-center gap-1"
                    ><Users class="w-3 h-3" /> {{ course._count?.enrollments || 0 }}</span
                  >
                  <span class="flex items-center gap-1"
                    ><BookOpen class="w-3 h-3" /> {{ course._count?.lessons || 0 }} 课时</span
                  >
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Recommended Courses (only on "all" tab, when user has enrollments) -->
        <section
          v-if="
            !activeCategoryId &&
            !searchQuery &&
            !difficultyFilter &&
            myEnrollments.length > 0 &&
            recommendedCourses.length > 0
          "
        >
          <div class="flex items-center gap-2 mb-4 sm:mb-5">
            <Heart class="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
            <h2 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">猜你想学</h2>
          </div>
          <div class="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              v-for="course in recommendedCourses"
              :key="course.id"
              class="group glass-card glass-card-hover overflow-hidden cursor-pointer"
              @click="handleCourseClick(course.id)"
            >
              <div class="aspect-video relative overflow-hidden bg-slate-100 dark:bg-white/5">
                <img
                  :src="
                    course.thumbnail ||
                    'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60'
                  "
                  referrerpolicy="no-referrer"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div
                  class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <PlayCircle class="w-12 h-12 text-white drop-shadow-lg" />
                </div>
                <div class="absolute top-3 left-3">
                  <span
                    :class="[
                      difficultyMap[course.difficulty]?.bg,
                      difficultyMap[course.difficulty]?.color,
                    ]"
                    class="px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm"
                  >
                    {{ difficultyMap[course.difficulty]?.label || '入门' }}
                  </span>
                </div>
              </div>
              <div class="p-4">
                <h3
                  class="text-sm font-bold mb-1 line-clamp-1 group-hover:text-accent transition-colors"
                  style="color: var(--text-primary)"
                >
                  {{ course.title }}
                </h3>
                <div
                  class="flex items-center gap-3 text-[10px] font-bold"
                  style="color: var(--text-muted)"
                >
                  <span class="flex items-center gap-1"
                    ><Star class="w-3 h-3 text-amber-400 fill-amber-400" />
                    {{ course.avgRating || '-' }}</span
                  >
                  <span class="flex items-center gap-1"
                    ><Users class="w-3 h-3" /> {{ course._count?.enrollments || 0 }}</span
                  >
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Course Grid -->
        <section>
          <div class="flex items-center justify-between mb-4 sm:mb-5 px-1">
            <h2 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">
              {{ activeCategory }}
            </h2>
            <span class="text-[10px] sm:text-xs font-bold" style="color: var(--text-muted)"
              >{{ filteredCourses.length }} 门课程</span
            >
          </div>

          <div
            v-if="filteredCourses.length > 0"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6"
          >
            <div
              v-for="course in filteredCourses"
              :key="course.id"
              class="group glass-card glass-card-hover overflow-hidden cursor-pointer"
              @click="handleCourseClick(course.id)"
            >
              <!-- Course Cover -->
              <div class="aspect-video relative overflow-hidden bg-slate-100 dark:bg-white/5">
                <img
                  :src="
                    course.thumbnail ||
                    'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60'
                  "
                  referrerpolicy="no-referrer"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div
                  class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <PlayCircle class="w-12 h-12 text-white drop-shadow-lg" />
                </div>
                <!-- Badges -->
                <div class="absolute top-3 left-3 flex items-center gap-1.5">
                  <span
                    :class="[
                      difficultyMap[course.difficulty]?.bg,
                      difficultyMap[course.difficulty]?.color,
                    ]"
                    class="px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm"
                  >
                    {{ difficultyMap[course.difficulty]?.label || '入门' }}
                  </span>
                </div>
                <div
                  v-if="isEnrolled(course.id)"
                  class="absolute top-3 right-3 flex items-center gap-1.5"
                >
                  <span
                    class="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500 text-white"
                  >
                    已加入
                  </span>
                </div>
                <!-- Bookmark button -->
                <button
                  v-if="!isEnrolled(course.id)"
                  class="absolute top-3 right-3 p-1.5 rounded-lg bg-black/30 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-black/50"
                  @click.stop="toggleBookmark(course.id, $event)"
                >
                  <Bookmark
                    class="w-3.5 h-3.5"
                    :class="
                      isBookmarked(course.id) ? 'text-amber-400 fill-amber-400' : 'text-white'
                    "
                  />
                </button>
                <!-- Progress bar for enrolled courses -->
                <div
                  v-if="isEnrolled(course.id) && getEnrollmentProgress(course.id) > 0"
                  class="absolute bottom-0 left-0 right-0 h-1 bg-black/20"
                >
                  <div
                    class="h-full bg-emerald-400 transition-all"
                    :style="{ width: getEnrollmentProgress(course.id) + '%' }"
                  ></div>
                </div>
              </div>

              <!-- Course Info -->
              <div class="p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-2">
                  <span
                    v-if="course.category"
                    class="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-bold"
                    >{{ course.category.name }}</span
                  >
                  <span
                    v-if="course.tags"
                    class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-400 text-[9px] font-bold"
                    >{{ course.tags.split(',')[0] }}</span
                  >
                </div>
                <h3
                  class="text-sm font-bold mb-2 line-clamp-2 min-h-[40px] leading-snug group-hover:text-accent transition-colors"
                  style="color: var(--text-primary)"
                >
                  {{ course.title }}
                </h3>

                <div class="flex items-center gap-3 mb-3">
                  <div class="flex items-center gap-0.5">
                    <Star
                      v-for="i in 5"
                      :key="i"
                      class="w-3 h-3"
                      :class="
                        i <= Math.round(course.avgRating || 0)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200 dark:text-slate-700'
                      "
                    />
                  </div>
                  <span class="text-[10px] font-bold" style="color: var(--text-muted)">{{
                    course.avgRating || '-'
                  }}</span>
                </div>

                <div
                  class="flex items-center justify-between pt-3 border-t transition-colors duration-300"
                  style="border-color: var(--border-base)"
                >
                  <div
                    class="flex items-center gap-3 text-[10px] font-bold"
                    style="color: var(--text-muted)"
                  >
                    <span class="flex items-center gap-1"
                      ><BookOpen class="w-3 h-3" /> {{ course._count?.lessons || 0 }} 课时</span
                    >
                    <span class="flex items-center gap-1"
                      ><Users class="w-3 h-3" /> {{ course._count?.enrollments || 0 }}</span
                    >
                  </div>
                  <ChevronRight
                    class="w-4 h-4 text-slate-300 group-hover:text-accent transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-else
            class="h-64 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed"
            style="
              background-color: var(--bg-card);
              border-color: var(--border-base);
              color: var(--text-muted);
            "
          >
            <GraduationCap class="w-12 h-12 mb-4 opacity-20" />
            <p class="text-sm">
              {{
                activeCategoryId === 'bookmarked'
                  ? '还没有收藏课程'
                  : activeCategoryId === 'mine'
                    ? '还没有加入课程'
                    : '没有找到相关的课程'
              }}
            </p>
            <button
              v-if="activeCategoryId === 'mine' || activeCategoryId === 'bookmarked'"
              class="mt-3 px-4 py-2 bg-accent text-white text-xs font-bold rounded-xl shadow-lg shadow-accent/20"
              @click="activeCategoryId = null"
            >
              浏览课程
            </button>
          </div>
        </section>
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
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

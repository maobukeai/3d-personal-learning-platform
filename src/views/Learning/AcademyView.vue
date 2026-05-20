<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Search,
  GraduationCap,
  Filter,
  Sparkles,
  X,
  Flame,
  Play,
  Heart,
  BookOpen,
  Bookmark,
  TrendingUp,
  Trophy,
  Clock,
  Target,
} from 'lucide-vue-next';
import api from '@/utils/api';
import PageHeader from '@/components/PageHeader.vue';
import CourseCard from '@/components/CourseCard.vue';

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
    <PageHeader
      title="学院课程"
      subtitle="探索 3D 设计的无限可能"
      :icon="GraduationCap"
    >
      <div class="relative flex-1 min-w-0 sm:min-w-[240px] lg:min-w-[160px]">
        <Search
          class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
          style="color: var(--text-muted)"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索课程..."
          class="pl-10 pr-4 py-2 rounded-xl border text-xs sm:text-sm w-full outline-none transition-all lg:focus:w-72"
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

      <div class="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <button
          class="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all shrink-0"
          :class="showFilters || difficultyFilter ? 'border-accent/30 text-accent' : ''"
          style="border-color: var(--border-base); color: var(--text-secondary)"
          @click="showFilters = !showFilters"
        >
          <Filter class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          筛选
        </button>

        <div class="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl shrink-0" style="background-color: var(--bg-app)">
          <button
            v-for="sort in [
              { key: 'newest', label: '最新' },
              { key: 'popular', label: '最热' },
              { key: 'rating', label: '好评' },
            ]"
            :key="sort.key"
            class="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap"
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
    </PageHeader>

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
              <CourseCard
                v-for="enrollment in continueLearningCourses"
                :key="enrollment.id"
                :course="enrollment.course"
                layout="row-simple"
                :progress="enrollment.progress"
                @click="continueLearning"
              />
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
            <CourseCard
              v-for="course in featuredCourses"
              :key="course.id"
              :course="course"
              layout="row-detailed"
              @click="handleCourseClick"
            />
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
            <CourseCard
              v-for="course in recommendedCourses"
              :key="course.id"
              :course="course"
              layout="card-simple"
              @click="handleCourseClick"
            />
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
            class="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 lg:gap-6"
          >
            <CourseCard
              v-for="course in filteredCourses"
              :key="course.id"
              :course="course"
              layout="card"
              :enrolled="isEnrolled(course.id)"
              :bookmarked="isBookmarked(course.id)"
              :progress="getEnrollmentProgress(course.id)"
              @click="handleCourseClick"
              @bookmark="toggleBookmark"
            />
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

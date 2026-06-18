<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Search,
  GraduationCap,
  Filter,
  Sparkles,
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
import { useAuthStore } from '@/stores/auth';
import Tabs from '@/components/ui/Tabs.vue';
import Input from '@/components/ui/Input.vue';

type CourseSortKey = 'newest' | 'popular' | 'rating';

interface AcademyCategory {
  id: string;
  name: string;
  _count?: {
    courses?: number;
  };
}

interface AcademyCourse {
  id: string;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  difficulty?: string;
  thumbnail?: string | null;
  tags?: string | null;
  avgRating?: number;
  _count?: {
    enrollments?: number;
    lessons?: number;
  };
}

interface AcademyEnrollment {
  id: string;
  courseId: string;
  progress: number;
  updatedAt?: string | null;
  course?: AcademyCourse;
}

interface ContinuingEnrollment extends AcademyEnrollment {
  course: AcademyCourse;
}

const { t } = useI18n();
const router = useRouter();
const searchQuery = ref('');
const categories = ref<AcademyCategory[]>([]);
const activeCategoryId = ref<string | null>(null);
const courses = ref<AcademyCourse[]>([]);
const myEnrollments = ref<AcademyEnrollment[]>([]);
const isLoading = ref(false);
const sortBy = ref<CourseSortKey>('newest');
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

const continueLearningCourses = computed<ContinuingEnrollment[]>(() => {
  return myEnrollments.value
    .filter((e): e is ContinuingEnrollment => !!e.course && e.progress > 0 && e.progress < 100)
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
    const authStore = useAuthStore();

    const promises = [
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

const setSortBy = (key: string | number | null) => {
  if (key === 'newest' || key === 'popular' || key === 'rating') {
    sortBy.value = key;
    fetchData();
  }
};

const filteredCourses = computed(() => {
  let list = courses.value;

  if (activeCategoryId.value === 'mine') {
    list = myEnrollments.value
      .map((e) => e.course)
      .filter((course): course is AcademyCourse => !!course);
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
  return courses.value
    .filter((course) => (course.avgRating || 0) >= 4 && (course._count?.enrollments || 0) >= 0)
    .slice(0, 4);
});

const activeCategory = computed(() => {
  if (activeCategoryId.value === 'mine') return t('academy.myCourses');
  if (activeCategoryId.value === 'bookmarked') return t('academy.myBookmarks');
  if (!activeCategoryId.value) return t('academy.allCourses');
  const cat = categories.value.find((c) => c.id === activeCategoryId.value);
  return cat?.name || t('academy.allCourses');
});

const categoryTabsOptions = computed(() => {
  const options: Array<{ label: string; value: string | null; icon?: any }> = [
    { label: t('academy.allCourses'), value: null },
    { label: t('academy.myCourses'), value: 'mine', icon: BookOpen },
    { label: t('academy.myBookmarks'), value: 'bookmarked', icon: Bookmark },
  ];
  categories.value.forEach((cat) => {
    options.push({
      label: `${cat.name} (${cat._count?.courses || 0})`,
      value: cat.id,
    });
  });
  return options;
});

const difficultyOptions = computed(() => [
  { label: t('academy.difficultyAll'), value: null },
  { label: t('academy.difficultyBeginner'), value: 'BEGINNER' },
  { label: t('academy.difficultyIntermediate'), value: 'INTERMEDIATE' },
  { label: t('academy.difficultyAdvanced'), value: 'ADVANCED' },
]);

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
    <PageHeader :title="t('academy.title')" :subtitle="t('academy.subtitle')" :icon="GraduationCap">
      <template #center>
        <Input
          v-model="searchQuery"
          type="text"
          :placeholder="t('academy.searchPlaceholder')"
          :icon="Search"
          clearable
          glass
          class="w-full flex-1"
          input-class="!py-2 !h-9.5 text-xs sm:text-sm"
        />
      </template>

      <div class="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all shrink-0"
          :class="showFilters || difficultyFilter ? 'border-accent/30 text-accent' : ''"
          style="border-color: var(--border-base); color: var(--text-secondary)"
          @click="showFilters = !showFilters"
        >
          <Filter class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {{ t('academy.filter') }}
        </button>

        <div
          class="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl shrink-0"
          style="background-color: var(--bg-app)"
        >
          <Tabs
            v-model="sortBy"
            :options="[
              { label: t('academy.sortByNewest'), value: 'newest' },
              { label: t('academy.sortByPopular'), value: 'popular' },
              { label: t('academy.sortByRating'), value: 'rating' },
            ]"
            size="sm"
            class="!bg-transparent border-none shrink-0"
            @change="setSortBy"
          />
        </div>
      </div>
    </PageHeader>

    <!-- Filters & Categories Bar -->
    <div
      class="px-3 sm:px-4.5 lg:px-5 py-1.5 sm:py-2 border-b flex flex-wrap items-center justify-between gap-3 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- Category Tabs -->
      <Tabs
        v-model="activeCategoryId"
        :options="categoryTabsOptions"
        size="sm"
        class="!bg-transparent border-none shrink-0"
      />

      <!-- Difficulty Filter -->
      <div v-if="showFilters" class="flex items-center gap-2 shrink-0">
        <span class="text-xs font-bold" style="color: var(--text-muted)">{{
          t('academy.difficultyLabel')
        }}</span>
        <Tabs
          v-model="difficultyFilter"
          :options="difficultyOptions"
          size="sm"
          class="!bg-transparent border-none"
          @change="fetchData"
        />
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-2.5 sm:p-4 lg:p-4.5 scrollbar-hide">
      <div class="max-w-none space-y-6 sm:space-y-7">
        <!-- My Courses: Learning Stats & Continue Learning -->
        <template v-if="activeCategoryId === 'mine' && myEnrollments.length > 0">
          <!-- Learning Stats -->
          <section>
            <div class="flex items-center gap-2 mb-2 sm:mb-2.5">
              <TrendingUp class="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
              <h2 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">
                {{ t('academy.learningStats') }}
              </h2>
            </div>
            <!-- Stats Container: Fixed 5 columns -->
            <div class="grid grid-cols-5 gap-1 sm:gap-2.5">
              <div class="p-1.5 sm:p-3.5 glass-card flex flex-col items-center text-center">
                <div
                  class="flex items-center justify-center sm:justify-between w-full mb-0.5 sm:mb-1"
                >
                  <span
                    class="text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase"
                    >{{ t('academy.statsLearning') }}</span
                  >
                  <BookOpen class="hidden sm:block w-4 h-4 text-accent" />
                </div>
                <p class="text-xs sm:text-2xl font-black text-accent">
                  {{ learningStats.inProgressCourses }}
                </p>
              </div>
              <div class="p-1.5 sm:p-3.5 glass-card flex flex-col items-center text-center">
                <div
                  class="flex items-center justify-center sm:justify-between w-full mb-0.5 sm:mb-1"
                >
                  <span
                    class="text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase"
                    >{{ t('academy.statsCompleted') }}</span
                  >
                  <Trophy class="hidden sm:block w-4 h-4 text-amber-500" />
                </div>
                <p class="text-xs sm:text-2xl font-black text-amber-500">
                  {{ learningStats.completedCourses }}
                </p>
              </div>
              <div class="p-1.5 sm:p-3.5 glass-card flex flex-col items-center text-center">
                <div
                  class="flex items-center justify-center sm:justify-between w-full mb-0.5 sm:mb-1"
                >
                  <span
                    class="text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase"
                    >{{ t('academy.statsLessons') }}</span
                  >
                  <Clock class="hidden sm:block w-4 h-4 text-indigo-500" />
                </div>
                <p class="text-xs sm:text-2xl font-black text-indigo-500">
                  {{ learningStats.totalLessons }}
                </p>
              </div>
              <div class="p-1.5 sm:p-3.5 glass-card flex flex-col items-center text-center">
                <div
                  class="flex items-center justify-center sm:justify-between w-full mb-0.5 sm:mb-1"
                >
                  <span
                    class="text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase"
                    >{{ t('academy.statsAverage') }}</span
                  >
                  <Target class="hidden sm:block w-4 h-4 text-emerald-500" />
                </div>
                <p class="text-xs sm:text-2xl font-black text-emerald-500">
                  {{ learningStats.avgProgress }}<span class="text-[8px] sm:text-sm">%</span>
                </p>
              </div>
              <div class="p-1.5 sm:p-3.5 glass-card flex flex-col items-center text-center">
                <div
                  class="flex items-center justify-center sm:justify-between w-full mb-0.5 sm:mb-1"
                >
                  <span
                    class="text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase"
                    >{{ t('academy.statsEnrollments') }}</span
                  >
                  <Flame class="hidden sm:block w-4 h-4 text-rose-500" />
                </div>
                <p class="text-xs sm:text-2xl font-black text-rose-500">
                  {{ learningStats.totalCourses }}
                </p>
              </div>
            </div>
          </section>

          <!-- Continue Learning -->
          <section v-if="continueLearningCourses.length > 0">
            <div class="flex items-center gap-2 mb-4">
              <Play class="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              <h2 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">
                {{ t('academy.continueLearning') }}
              </h2>
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
          <div class="flex items-center gap-2 mb-2.5 sm:mb-3">
            <Sparkles class="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <h2 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">
              {{ t('academy.featuredRecommend') }}
            </h2>
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
          <div class="flex items-center gap-2 mb-2.5 sm:mb-3">
            <Heart class="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
            <h2 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">
              {{ t('academy.guessYouLike') }}
            </h2>
          </div>
          <div
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-4"
          >
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
          <div class="flex items-center justify-between mb-2.5 sm:mb-3 px-1">
            <h2 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">
              {{ activeCategory }}
            </h2>
            <span class="text-[10px] sm:text-xs font-bold" style="color: var(--text-muted)">{{
              t('academy.coursesCount', { n: filteredCourses.length })
            }}</span>
          </div>

          <div
            v-if="filteredCourses.length > 0"
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-3.5 lg:gap-4.5"
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
                  ? t('academy.emptyBookmarks')
                  : activeCategoryId === 'mine'
                    ? t('academy.emptyMyCourses')
                    : t('academy.emptyNoResults')
              }}
            </p>
            <button
              v-if="activeCategoryId === 'mine' || activeCategoryId === 'bookmarked'"
              type="button"
              class="mt-3 px-4 py-2 bg-accent text-white text-xs font-bold rounded-xl shadow-lg shadow-accent/20"
              @click="activeCategoryId = null"
            >
              {{ t('academy.browseCourses') }}
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

<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ChevronLeft,
  PlayCircle,
  Clock,
  Star,
  Users,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  FileText,
  Box,
  Video,
  Send,
  GraduationCap,
  Timer,
  Signal,
  Bookmark,
  Tag,
  StickyNote,
  Share2,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';
import Tabs from '@/components/ui/Tabs.vue';
import type { Lesson, User } from '@/types';

interface CourseReview {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user?: User;
}

interface CourseInstructor extends User {
  _count?: {
    courses?: number;
  };
}

interface CourseDetail {
  id: string;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  difficulty: string;
  category?: {
    name: string;
  } | null;
  tags?: string | null;
  totalDuration?: number;
  lessons?: Lesson[];
  lessonProgressMap?: Record<string, boolean>;
  userEnrollment?: unknown;
  reviews?: CourseReview[];
  user?: CourseInstructor | null;
  avgRating?: number;
  _count?: {
    enrollments?: number;
    lessons?: number;
    reviews?: number;
  };
}

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const courseId = route.params.id as string;

const course = ref<CourseDetail | null>(null);
const isLoading = ref(true);
const activeSection = ref<'outline' | 'reviews'>('outline');
const reviewRating = ref(5);
const reviewComment = ref('');
const isSubmittingReview = ref(false);
const isEnrolling = ref(false);
const isBookmarked = ref(false);

const difficultyMap = computed<Record<string, { label: string; color: string }>>(() => ({
  BEGINNER: { label: t('academy.difficultyBeginner'), color: 'text-emerald-500 bg-emerald-500/10' },
  INTERMEDIATE: {
    label: t('academy.difficultyIntermediate'),
    color: 'text-amber-500 bg-amber-500/10',
  },
  ADVANCED: { label: t('academy.difficultyAdvanced'), color: 'text-rose-500 bg-rose-500/10' },
}));

const fetchCourse = async () => {
  isLoading.value = true;
  try {
    const { data } = await api.get(`/api/courses/${courseId}`);
    course.value = data;
  } catch {
    ElMessage.error(t('academy.loadCourseFailed'));
    router.push('/academy');
  } finally {
    isLoading.value = false;
  }
};

const isEnrolled = computed(() => !!course.value?.userEnrollment);

const completedLessonCount = computed(() => {
  if (!course.value?.lessonProgressMap) return 0;
  return Object.values(course.value.lessonProgressMap).filter(Boolean).length;
});

const courseProgress = computed(() => {
  if (!course.value?.lessons?.length) return 0;
  return Math.round((completedLessonCount.value / course.value.lessons.length) * 100);
});

const totalDurationFormatted = computed(() => {
  const mins = course.value?.totalDuration || 0;
  if (mins < 60) return t('academy.minuteUnitDetail', { n: mins });
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0
    ? `${h} ${t('academy.statsAverage')} ${t('academy.minuteUnitDetail', { n: m })}`
    : `${h} ${t('academy.statsAverage')}`;
});

const courseTags = computed(() => {
  if (!course.value?.tags) return [];
  return course.value.tags
    .split(',')
    .map((t: string) => t.trim())
    .filter(Boolean);
});

const instructorInfo = computed(() => {
  return course.value?.user || null;
});

const ratingDistribution = computed(() => {
  if (!course.value?.reviews?.length) return [];
  const dist = [0, 0, 0, 0, 0];
  course.value.reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++;
  });
  const total = course.value.reviews.length;
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: dist[stars - 1],
    percent: total > 0 ? Math.round((dist[stars - 1] / total) * 100) : 0,
  }));
});

const handleEnroll = async () => {
  const authStore = useAuthStore();

  if (!authStore.isAuthenticated) {
    ElMessage.warning(t('academy.enrollCourseNow'));
    router.push({
      path: '/login',
      query: { redirect: route.fullPath },
    });
    return;
  }

  isEnrolling.value = true;
  try {
    await api.post('/api/courses/enroll', { courseId });
    ElMessage.success(t('academy.joined'));
    fetchCourse();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('academy.loadCourseFailed')));
  } finally {
    isEnrolling.value = false;
  }
};

const handleStartLearning = (lessonIndex?: number) => {
  const query = lessonIndex !== undefined ? { lesson: String(lessonIndex) } : {};
  router.push({
    path: `/academy/player/${courseId}`,
    query,
  });
};

const toggleBookmark = () => {
  isBookmarked.value = !isBookmarked.value;
  ElMessage.success(isBookmarked.value ? t('academy.myBookmarks') : t('academy.emptyBookmarks'));
};

const handleShare = () => {
  const url = window.location.href;
  navigator.clipboard
    .writeText(url)
    .then(() => {
      ElMessage.success(t('layout.copiedLink'));
    })
    .catch(() => {
      ElMessage.error(t('layout.copyFailed'));
    });
};

const handleSubmitReview = async () => {
  if (!reviewComment.value.trim() && reviewRating.value === 0) return;

  const authStore = useAuthStore();

  if (!authStore.isAuthenticated) {
    ElMessage.warning(t('academy.enrollCourseNow'));
    router.push({
      path: '/login',
      query: { redirect: route.fullPath },
    });
    return;
  }

  isSubmittingReview.value = true;
  try {
    await api.post('/api/courses/reviews', {
      courseId,
      rating: reviewRating.value,
      comment: reviewComment.value,
    });
    ElMessage.success(t('academy.submitReview'));
    reviewComment.value = '';
    reviewRating.value = 5;
    fetchCourse();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('academy.loadCourseFailed')));
  } finally {
    isSubmittingReview.value = false;
  }
};

const getLessonTypeIcon = (lesson: Lesson) => {
  const url = lesson.videoUrl;
  if (!url) return FileText;
  if (url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf')) return Box;
  return Video;
};

const getLessonTypeLabel = (lesson: Lesson) => {
  const url = lesson.videoUrl;
  if (!url) return t('academy.lessonTypeRichText');
  if (url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf'))
    return t('academy.lessonType3D');
  return t('academy.lessonTypeVideo');
};

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return t('academy.timeToday');
  if (days < 7) return t('academy.timeDaysAgo', { n: days });
  if (days < 30) return t('academy.timeWeeksAgo', { n: Math.floor(days / 7) });
  if (days < 365) return t('academy.timeMonthsAgo', { n: Math.floor(days / 30) });
  return t('academy.timeYearsAgo', { n: Math.floor(days / 365) });
};

onMounted(fetchCourse);
</script>

<template>
  <div
    class="mobile-adaptive flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Top Nav -->
    <div
      class="mobile-row h-14 px-4 sm:px-6 md:px-8 flex items-center gap-4 shrink-0 border-b transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <button
        type="button"
        class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        @click="router.push('/academy')"
      >
        <ChevronLeft class="w-5 h-5" style="color: var(--text-secondary)" />
      </button>
      <div class="h-4 w-px" style="background-color: var(--border-base)"></div>
      <span class="text-sm font-bold" style="color: var(--text-primary)">{{
        t('academy.courseDetail')
      }}</span>
      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          @click="toggleBookmark"
        >
          <Bookmark
            class="w-4 h-4"
            :class="isBookmarked ? 'text-amber-400 fill-amber-400' : ''"
            style="color: var(--text-muted)"
          />
        </button>
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          @click="handleShare"
        >
          <Share2 class="w-4 h-4" style="color: var(--text-muted)" />
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-32">
        <div
          class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"
        ></div>
      </div>

      <template v-else-if="course">
        <!-- Hero Section -->
        <div class="max-w-none px-3 sm:px-4.5 md:px-6 pt-3 sm:pt-4">
          <div
            class="relative rounded-xl md:rounded-2xl overflow-hidden shadow-md border"
            style="border-color: var(--border-base)"
          >
            <div class="h-40 md:h-52 overflow-hidden">
              <img
                alt=""
                :src="
                  course.thumbnail ||
                  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=1200&auto=format&fit=crop&q=60'
                "
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover"
              />
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
              ></div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-3.5 sm:p-5 md:p-6">
              <div class="flex items-end justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-2">
                    <span
                      v-if="course.category"
                      class="px-2 py-0.5 rounded bg-accent/25 text-accent text-[10px] font-bold backdrop-blur-sm"
                    >
                      {{ course.category.name }}
                    </span>
                    <span
                      :class="
                        difficultyMap[course.difficulty]?.color || 'text-slate-400 bg-slate-400/10'
                      "
                      class="px-2 py-0.5 rounded text-[10px] font-bold backdrop-blur-sm"
                    >
                      {{
                        difficultyMap[course.difficulty]?.label || t('academy.difficultyBeginner')
                      }}
                    </span>
                  </div>
                  <h1
                    class="text-lg sm:text-xl md:text-2xl font-black text-white mb-2 leading-tight"
                  >
                    {{ course.title }}
                  </h1>
                  <p class="text-white/80 text-xs line-clamp-2 max-w-2xl font-medium">
                    {{ course.description }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Stats Bar Card -->
        <div class="max-w-none px-3 sm:px-4.5 md:px-6 mt-3">
          <div
            class="mobile-row px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border flex flex-row flex-nowrap items-center gap-2 sm:gap-5 justify-between sm:justify-start transition-colors duration-300 overflow-x-auto scrollbar-hide text-[10px] sm:text-xs"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <div class="flex items-center gap-1 shrink-0">
              <Star class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 fill-amber-400" />
              <span class="font-bold" style="color: var(--text-primary)">{{
                course.avgRating || t('common.noData')
              }}</span>
              <span class="text-[9px] sm:text-[10px]" style="color: var(--text-muted)"
                >({{ t('academy.reviewsCount', { n: course._count?.reviews || 0 }) }})</span
              >
            </div>
            <div
              class="h-3 w-px hidden sm:block shrink-0"
              style="background-color: var(--border-base)"
            ></div>
            <div class="flex items-center gap-1 shrink-0">
              <Users class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
              <span class="font-bold" style="color: var(--text-primary)">{{
                course._count?.enrollments || 0
              }}</span>
              <span class="text-[9px] sm:text-[10px]" style="color: var(--text-muted)">{{
                t('academy.joined')
              }}</span>
            </div>
            <div
              class="h-3 w-px hidden sm:block shrink-0"
              style="background-color: var(--border-base)"
            ></div>
            <div class="flex items-center gap-1 shrink-0">
              <BookOpen class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
              <span class="font-bold" style="color: var(--text-primary)">{{
                course.lessons?.length || 0
              }}</span>
              <span class="text-[9px] sm:text-[10px]" style="color: var(--text-muted)">{{
                t('academy.lessonHour')
              }}</span>
            </div>
            <div
              class="h-3 w-px hidden sm:block shrink-0"
              style="background-color: var(--border-base)"
            ></div>
            <div class="flex items-center gap-1 shrink-0">
              <Timer class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
              <span class="font-bold" style="color: var(--text-primary)">{{
                totalDurationFormatted
              }}</span>
            </div>
            <!-- Tags -->
            <template v-if="courseTags.length > 0">
              <div
                class="h-3 w-px hidden sm:block shrink-0"
                style="background-color: var(--border-base)"
              ></div>
              <div class="flex items-center gap-1 flex-nowrap shrink-0 overflow-x-visible">
                <Tag class="w-3 h-3 text-slate-400" />
                <span
                  v-for="tag in courseTags.slice(0, 2)"
                  :key="tag"
                  class="px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-accent/10 text-accent whitespace-nowrap"
                >
                  {{ tag }}
                </span>
              </div>
            </template>
          </div>

          <!-- Main Content + Sidebar -->
          <div class="flex flex-col lg:flex-row gap-5 p-3.5 sm:p-5 md:p-6">
            <!-- Left Content -->
            <div class="flex-1 min-w-0 space-y-5">
              <!-- Instructor Card -->
              <div
                v-if="instructorInfo"
                class="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-3"
                style="background-color: var(--bg-card); border-color: var(--border-base)"
              >
                <UserAvatar :user="instructorInfo" size="sm" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <h4 class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ instructorInfo.name || t('academy.instructor') }}
                    </h4>
                    <span
                      class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-500/10 text-indigo-500 leading-none"
                      >{{ t('academy.instructor') }}</span
                    >
                  </div>
                  <p class="text-[10px] mt-0.5 leading-normal" style="color: var(--text-muted)">
                    {{ instructorInfo.bio || instructorInfo.email }}
                  </p>
                </div>
                <div
                  class="flex items-center gap-3 text-[9px] font-bold shrink-0"
                  style="color: var(--text-muted)"
                >
                  <span class="flex items-center gap-1"
                    ><BookOpen class="w-3 h-3" />
                    {{
                      t('academy.coursesCountInstructor', {
                        n: instructorInfo._count?.courses || 1,
                      })
                    }}</span
                  >
                  <span class="flex items-center gap-1"
                    ><Users class="w-3 h-3" />
                    {{
                      t('academy.studentsCountInstructor', {
                        n: instructorInfo._count?.courses || 0,
                      })
                    }}</span
                  >
                </div>
              </div>

              <!-- Section Tabs -->
              <Tabs
                v-model="activeSection"
                :options="[
                  { label: t('academy.courseOutline'), value: 'outline' },
                  {
                    label: t('academy.studentReviews', { n: course?._count?.reviews || 0 }),
                    value: 'reviews',
                  },
                ]"
                size="sm"
                class="!bg-transparent border-none"
              />

              <!-- Outline Section -->
              <template v-if="activeSection === 'outline'">
                <div class="space-y-2">
                  <div
                    v-for="(lesson, index) in course.lessons"
                    :key="lesson.id"
                    class="group flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm"
                    :class="[
                      course.lessonProgressMap?.[lesson.id]
                        ? 'border-emerald-200 dark:border-emerald-800/30'
                        : '',
                      isEnrolled ? 'cursor-pointer' : '',
                    ]"
                    style="background-color: var(--bg-card); border-color: var(--border-base)"
                    @click="isEnrolled && handleStartLearning(index as number)"
                  >
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                      :class="
                        course.lessonProgressMap?.[lesson.id]
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-slate-50 dark:bg-white/5 border-[var(--border-base)]'
                      "
                      style="color: var(--text-muted)"
                    >
                      <CheckCircle2
                        v-if="course.lessonProgressMap?.[lesson.id]"
                        class="w-4 h-4 text-white"
                      />
                      <span v-else class="text-[11px] font-black">{{ (index as number) + 1 }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <h4 class="text-xs font-bold truncate" style="color: var(--text-primary)">
                        {{ lesson.title }}
                      </h4>
                      <div class="flex items-center gap-2.5 mt-0.5">
                        <span
                          class="flex items-center gap-1 text-[9px] font-bold"
                          style="color: var(--text-muted)"
                        >
                          <component
                            :is="getLessonTypeIcon(lesson)"
                            class="w-3 h-3 text-slate-400"
                          />
                          {{ getLessonTypeLabel(lesson) }}
                        </span>
                        <span
                          v-if="lesson.duration"
                          class="flex items-center gap-1 text-[9px] font-bold"
                          style="color: var(--text-muted)"
                        >
                          <Clock class="w-3 h-3 text-slate-400" />
                          {{ t('academy.minuteUnitDetail', { n: lesson.duration }) }}
                        </span>
                      </div>
                    </div>
                    <button
                      v-if="isEnrolled"
                      type="button"
                      class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-accent/10 cursor-pointer shrink-0"
                    >
                      <PlayCircle class="w-3.5 h-3.5 text-accent" />
                    </button>
                  </div>
                </div>

                <div
                  v-if="!course.lessons?.length"
                  class="py-12 text-center rounded-xl border border-dashed"
                  style="border-color: var(--border-base)"
                >
                  <BookOpen
                    class="w-10 h-10 mx-auto mb-3 opacity-20"
                    style="color: var(--text-muted)"
                  />
                  <p class="text-xs" style="color: var(--text-muted)">
                    {{ t('academy.coursePreparing') }}
                  </p>
                </div>
              </template>

              <!-- Reviews Section -->
              <template v-if="activeSection === 'reviews'">
                <!-- Rating Summary -->
                <div
                  class="p-4 rounded-xl border"
                  style="background-color: var(--bg-card); border-color: var(--border-base)"
                >
                  <div class="mobile-row flex gap-6 items-center">
                    <div class="text-center px-2">
                      <div class="text-4xl font-black" style="color: var(--text-primary)">
                        {{ course.avgRating || '-' }}
                      </div>
                      <div class="flex items-center gap-0.5 mt-1.5 justify-center">
                        <Star
                          v-for="i in 5"
                          :key="i"
                          class="w-3.5 h-3.5"
                          :class="
                            i <= Math.round(course.avgRating || 0)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-200 dark:text-slate-700'
                          "
                        />
                      </div>
                      <p class="text-[10px] mt-1.5" style="color: var(--text-muted)">
                        {{ t('academy.reviewsCount', { n: course._count?.reviews || 0 }) }}
                      </p>
                    </div>
                    <div class="flex-1 space-y-1">
                      <div
                        v-for="item in ratingDistribution"
                        :key="item.stars"
                        class="flex items-center gap-2"
                      >
                        <span
                          class="text-[10px] font-bold w-7 text-right"
                          style="color: var(--text-secondary)"
                          >{{ t('academy.starUnit', { n: item.stars }) }}</span
                        >
                        <div
                          class="flex-1 h-1.5 rounded-full overflow-hidden"
                          style="background-color: var(--bg-app)"
                        >
                          <div
                            class="h-full bg-amber-400 rounded-full transition-all"
                            :style="{ width: item.percent + '%' }"
                          ></div>
                        </div>
                        <span
                          class="text-[9px] font-bold w-7 text-left"
                          style="color: var(--text-muted)"
                          >{{ item.percent }}%</span
                        >
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Write Review (only if enrolled) -->
                <div
                  v-if="isEnrolled"
                  class="p-4 rounded-xl border"
                  style="background-color: var(--bg-card); border-color: var(--border-base)"
                >
                  <h4 class="text-xs font-bold mb-3" style="color: var(--text-primary)">
                    {{ t('academy.writeReview') }}
                  </h4>
                  <div class="flex items-center gap-2 mb-3">
                    <span class="text-[11px] font-bold" style="color: var(--text-muted)">{{
                      t('academy.scoreLabel')
                    }}</span>
                    <button
                      v-for="i in 5"
                      :key="i"
                      type="button"
                      class="p-0.5 transition-transform hover:scale-125 cursor-pointer"
                      @click="reviewRating = i"
                    >
                      <Star
                        class="w-4.5 h-4.5 transition-colors"
                        :class="
                          i <= reviewRating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-200 dark:text-slate-700'
                        "
                      />
                    </button>
                  </div>
                  <textarea
                    v-model="reviewComment"
                    rows="2"
                    :placeholder="t('academy.reviewPlaceholder')"
                    class="w-full px-3 py-2 rounded-xl border transition-all outline-none resize-none text-xs"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  ></textarea>
                  <div class="flex justify-end mt-2">
                    <button
                      type="button"
                      :disabled="isSubmittingReview"
                      class="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white font-bold text-xs rounded-lg shadow disabled:opacity-50 transition-all cursor-pointer"
                      @click="handleSubmitReview"
                    >
                      <Send class="w-3.5 h-3.5" />
                      {{ t('academy.submitReview') }}
                    </button>
                  </div>
                </div>

                <!-- Reviews List -->
                <div class="space-y-2.5">
                  <div
                    v-for="review in course.reviews"
                    :key="review.id"
                    class="p-3.5 rounded-xl border"
                    style="background-color: var(--bg-card); border-color: var(--border-base)"
                  >
                    <div class="flex items-center gap-2.5 mb-2">
                      <UserAvatar :user="review.user" size="sm" class="shrink-0" />
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold truncate" style="color: var(--text-primary)">
                          {{ review.user?.name || t('academy.anonymousUser') }}
                        </p>
                        <div class="flex items-center gap-2 leading-none mt-0.5">
                          <div class="flex items-center">
                            <Star
                              v-for="i in 5"
                              :key="i"
                              class="w-3 h-3"
                              :class="
                                i <= review.rating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-200 dark:text-slate-700'
                              "
                            />
                          </div>
                          <span class="text-[9px]" style="color: var(--text-muted)">{{
                            formatTimeAgo(review.createdAt)
                          }}</span>
                        </div>
                      </div>
                    </div>
                    <p
                      v-if="review.comment"
                      class="text-xs leading-relaxed"
                      style="color: var(--text-secondary)"
                    >
                      {{ review.comment }}
                    </p>
                  </div>

                  <div
                    v-if="!course.reviews?.length"
                    class="py-12 text-center rounded-xl border border-dashed"
                    style="border-color: var(--border-base)"
                  >
                    <MessageSquare
                      class="w-10 h-10 mx-auto mb-3 opacity-20"
                      style="color: var(--text-muted)"
                    />
                    <p class="text-xs" style="color: var(--text-muted)">
                      {{ t('academy.noReviewsYet') }}
                    </p>
                  </div>
                </div>
              </template>
            </div>

            <!-- Right Sidebar - Sticky CTA -->
            <div class="w-72 shrink-0 hidden lg:block">
              <div class="sticky top-20 space-y-3.5">
                <!-- Progress Card (if enrolled) -->
                <div
                  v-if="isEnrolled"
                  class="p-4 rounded-xl border"
                  style="background-color: var(--bg-card); border-color: var(--border-base)"
                >
                  <div class="flex items-center gap-2.5 mb-3.5">
                    <div class="p-1.5 bg-emerald-500/10 rounded-lg">
                      <CheckCircle2 class="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p
                        class="text-[10px] font-bold leading-none mb-1"
                        style="color: var(--text-muted)"
                      >
                        {{ t('academy.progressLabel') }}
                      </p>
                      <p
                        class="text-base font-black leading-none"
                        style="color: var(--text-primary)"
                      >
                        {{ courseProgress }}%
                      </p>
                    </div>
                  </div>
                  <div
                    class="w-full h-1.5 rounded-full overflow-hidden mb-3"
                    style="background-color: var(--bg-app)"
                  >
                    <div
                      class="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                      :style="{ width: courseProgress + '%' }"
                    ></div>
                  </div>
                  <p class="text-[10px] mb-3" style="color: var(--text-muted)">
                    {{
                      t('academy.completedProgressLessons', {
                        completed: completedLessonCount,
                        total: course.lessons?.length || 0,
                      })
                    }}
                  </p>
                  <button
                    type="button"
                    class="w-full py-2 bg-accent text-white font-bold rounded-lg text-xs shadow shadow-accent/15 transition-all hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    @click="handleStartLearning()"
                  >
                    <PlayCircle class="w-4 h-4" />
                    {{ t('academy.continueLearning') }}
                  </button>
                </div>

                <!-- Enroll Card (if not enrolled) -->
                <div
                  v-else
                  class="p-4 rounded-xl border"
                  style="background-color: var(--bg-card); border-color: var(--border-base)"
                >
                  <div class="space-y-3 mb-4.5">
                    <div class="flex items-center gap-2.5">
                      <BookOpen class="w-3.5 h-3.5" style="color: var(--text-muted)" />
                      <span class="text-xs" style="color: var(--text-secondary)">{{
                        t('academy.lessonsCountDetail', { n: course.lessons?.length || 0 })
                      }}</span>
                    </div>
                    <div class="flex items-center gap-2.5">
                      <Timer class="w-3.5 h-3.5" style="color: var(--text-muted)" />
                      <span class="text-xs" style="color: var(--text-secondary)">{{
                        t('academy.totalDuration', { time: totalDurationFormatted })
                      }}</span>
                    </div>
                    <div class="flex items-center gap-2.5">
                      <Signal class="w-3.5 h-3.5" style="color: var(--text-muted)" />
                      <span class="text-xs" style="color: var(--text-secondary)">{{
                        t('academy.difficultyLevel', {
                          level:
                            difficultyMap[course.difficulty]?.label ||
                            t('academy.difficultyBeginner'),
                        })
                      }}</span>
                    </div>
                    <div class="flex items-center gap-2.5">
                      <Users class="w-3.5 h-3.5" style="color: var(--text-muted)" />
                      <span class="text-xs" style="color: var(--text-secondary)">{{
                        t('academy.enrolledCount', { n: course._count?.enrollments || 0 })
                      }}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    :disabled="isEnrolling"
                    class="w-full py-2.5 bg-accent text-white font-bold rounded-lg text-xs shadow shadow-accent/15 transition-all hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    @click="handleEnroll"
                  >
                    <GraduationCap class="w-4 h-4" />
                    {{ isEnrolling ? t('academy.enrolling') : t('academy.enrollNow') }}
                  </button>
                </div>

                <!-- Course Description Card -->
                <div
                  class="p-4 rounded-xl border"
                  style="background-color: var(--bg-card); border-color: var(--border-base)"
                >
                  <h4 class="text-xs font-bold mb-2" style="color: var(--text-primary)">
                    {{ t('academy.courseSummary') }}
                  </h4>
                  <p class="text-[11px] leading-relaxed" style="color: var(--text-secondary)">
                    {{ course.description || t('academy.noSummary') }}
                  </p>
                </div>

                <!-- Tags Card -->
                <div
                  v-if="courseTags.length > 0"
                  class="p-4 rounded-xl border"
                  style="background-color: var(--bg-card); border-color: var(--border-base)"
                >
                  <h4
                    class="text-xs font-bold mb-2.5 flex items-center gap-1.5"
                    style="color: var(--text-primary)"
                  >
                    <Tag class="w-3.5 h-3.5 text-accent" /> {{ t('academy.courseTags') }}
                  </h4>
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="tag in courseTags"
                      :key="tag"
                      class="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/10 text-accent"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>

                <!-- Quick Notes Entry -->
                <div
                  v-if="isEnrolled"
                  class="p-4 rounded-xl border"
                  style="background-color: var(--bg-card); border-color: var(--border-base)"
                >
                  <h4
                    class="text-xs font-bold mb-2 flex items-center gap-1.5"
                    style="color: var(--text-primary)"
                  >
                    <StickyNote class="w-3.5 h-3.5 text-amber-500" /> {{ t('academy.studyNotes') }}
                  </h4>
                  <p class="text-[10px] mb-2.5" style="color: var(--text-muted)">
                    {{ t('academy.noteShortDesc') }}
                  </p>
                  <textarea
                    rows="3"
                    :placeholder="t('academy.quickNotePlaceholder')"
                    class="w-full px-2.5 py-1.5 rounded-lg border text-[11px] outline-none resize-none transition-all focus:ring-2 focus:ring-accent/20"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  ></textarea>
                  <button
                    type="button"
                    class="w-full mt-2 py-1.5 border border-slate-200 dark:border-white/10 text-[10px] font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    style="color: var(--text-secondary)"
                  >
                    <StickyNote class="w-3.5 h-3.5" /> {{ t('academy.saveNote') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Mobile CTA (sticky bottom on mobile) -->
          <div
            v-if="!isEnrolled"
            class="lg:hidden sticky bottom-0 p-4 border-t"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <button
              type="button"
              :disabled="isEnrolling"
              class="w-full py-3.5 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-2"
              @click="handleEnroll"
            >
              <GraduationCap class="w-5 h-5" />
              {{ isEnrolling ? t('academy.enrolling') : t('academy.enrollCourseNow') }}
            </button>
          </div>
          <div
            v-else
            class="lg:hidden sticky bottom-0 p-4 border-t"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <button
              type="button"
              class="w-full py-3.5 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
              @click="handleStartLearning()"
            >
              <PlayCircle class="w-5 h-5" />
              {{ t('academy.continueLearning') }} ({{ courseProgress }}%)
            </button>
          </div>
        </div>
      </template>
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

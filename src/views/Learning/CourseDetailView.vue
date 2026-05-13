<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  User as UserIcon,
  StickyNote,
  Share2
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const route = useRoute()
const router = useRouter()
const courseId = route.params.id as string

const course = ref<any>(null)
const isLoading = ref(true)
const activeSection = ref<'outline' | 'reviews'>('outline')
const reviewRating = ref(5)
const reviewComment = ref('')
const isSubmittingReview = ref(false)
const isEnrolling = ref(false)
const isBookmarked = ref(false)

const difficultyMap: Record<string, { label: string; color: string }> = {
  BEGINNER: { label: '入门', color: 'text-emerald-500 bg-emerald-500/10' },
  INTERMEDIATE: { label: '进阶', color: 'text-amber-500 bg-amber-500/10' },
  ADVANCED: { label: '高级', color: 'text-rose-500 bg-rose-500/10' }
}

const fetchCourse = async () => {
  isLoading.value = true
  try {
    const { data } = await api.get(`/api/courses/${courseId}`)
    course.value = data
  } catch (error) {
    ElMessage.error('加载课程失败')
    router.push('/academy')
  } finally {
    isLoading.value = false
  }
}

const isEnrolled = computed(() => !!course.value?.userEnrollment)

const completedLessonCount = computed(() => {
  if (!course.value?.lessonProgressMap) return 0
  return Object.values(course.value.lessonProgressMap).filter(Boolean).length
})

const courseProgress = computed(() => {
  if (!course.value?.lessons?.length) return 0
  return Math.round((completedLessonCount.value / course.value.lessons.length) * 100)
})

const totalDurationFormatted = computed(() => {
  const mins = course.value?.totalDuration || 0
  if (mins < 60) return `${mins} 分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
})

const courseTags = computed(() => {
  if (!course.value?.tags) return []
  return course.value.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
})

const instructorInfo = computed(() => {
  return course.value?.user || null
})

const ratingDistribution = computed(() => {
  if (!course.value?.reviews?.length) return []
  const dist = [0, 0, 0, 0, 0]
  course.value.reviews.forEach((r: any) => {
    if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++
  })
  const total = course.value.reviews.length
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: dist[stars - 1],
    percent: total > 0 ? Math.round((dist[stars - 1] / total) * 100) : 0
  }))
})

const handleEnroll = async () => {
  isEnrolling.value = true
  try {
    await api.post('/api/courses/enroll', { courseId })
    ElMessage.success('成功加入课程')
    fetchCourse()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '加入课程失败')
  } finally {
    isEnrolling.value = false
  }
}

const handleStartLearning = (lessonIndex?: number) => {
  const query = lessonIndex !== undefined ? { lesson: lessonIndex } : {}
  router.push({ 
    path: `/academy/player/${courseId}`,
    query
  })
}

const toggleBookmark = () => {
  isBookmarked.value = !isBookmarked.value
  ElMessage.success(isBookmarked.value ? '已收藏课程' : '已取消收藏')
}

const handleShare = () => {
  const url = window.location.href
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('链接已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

const handleSubmitReview = async () => {
  if (!reviewComment.value.trim() && reviewRating.value === 0) return
  isSubmittingReview.value = true
  try {
    await api.post('/api/courses/reviews', {
      courseId,
      rating: reviewRating.value,
      comment: reviewComment.value
    })
    ElMessage.success('评价提交成功')
    reviewComment.value = ''
    reviewRating.value = 5
    fetchCourse()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '提交评价失败')
  } finally {
    isSubmittingReview.value = false
  }
}

const getLessonTypeIcon = (lesson: any) => {
  const url = lesson.videoUrl
  if (!url) return FileText
  if (url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf')) return Box
  return Video
}

const getLessonTypeLabel = (lesson: any) => {
  const url = lesson.videoUrl
  if (!url) return '图文'
  if (url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf')) return '3D 交互'
  return '视频'
}

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return '今天'
  if (days < 7) return `${days} 天前`
  if (days < 30) return `${Math.floor(days / 7)} 周前`
  if (days < 365) return `${Math.floor(days / 30)} 月前`
  return `${Math.floor(days / 365)} 年前`
}

onMounted(fetchCourse)
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Top Nav -->
    <div class="h-14 px-8 flex items-center gap-4 shrink-0 border-b transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <button @click="router.push('/academy')" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
        <ChevronLeft class="w-5 h-5" style="color: var(--text-secondary)" />
      </button>
      <div class="h-4 w-px" style="background-color: var(--border-base)"></div>
      <span class="text-sm font-bold" style="color: var(--text-primary)">课程详情</span>
      <div class="ml-auto flex items-center gap-2">
        <button @click="toggleBookmark" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
          <Bookmark class="w-4 h-4" :class="isBookmarked ? 'text-amber-400 fill-amber-400' : ''" style="color: var(--text-muted)" />
        </button>
        <button @click="handleShare" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
          <Share2 class="w-4 h-4" style="color: var(--text-muted)" />
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-32">
        <div class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>

      <template v-else-if="course">
        <div class="max-w-6xl mx-auto">
          <!-- Hero Section -->
          <div class="relative">
            <div class="h-64 md:h-80 overflow-hidden">
              <img :src="course.thumbnail || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=1200&auto=format&fit=crop&q=60'"
                   referrerpolicy="no-referrer"
                   class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-8">
              <div class="flex items-end justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 mb-3">
                    <span v-if="course.category" class="px-3 py-1 rounded-lg bg-accent/20 text-accent text-xs font-bold backdrop-blur-sm">
                      {{ course.category.name }}
                    </span>
                    <span :class="difficultyMap[course.difficulty]?.color || 'text-slate-400 bg-slate-400/10'" class="px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-sm">
                      {{ difficultyMap[course.difficulty]?.label || '入门' }}
                    </span>
                  </div>
                  <h1 class="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">{{ course.title }}</h1>
                  <p class="text-white/70 text-sm line-clamp-2 max-w-2xl">{{ course.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Stats Bar -->
          <div class="px-8 py-6 border-b flex flex-wrap items-center gap-6 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="flex items-center gap-2">
              <Star class="w-4 h-4 text-amber-400 fill-amber-400" />
              <span class="text-sm font-bold" style="color: var(--text-primary)">{{ course.avgRating || '暂无' }}</span>
              <span class="text-xs" style="color: var(--text-muted)">({{ course._count?.reviews || 0 }} 评价)</span>
            </div>
            <div class="h-4 w-px" style="background-color: var(--border-base)"></div>
            <div class="flex items-center gap-2">
              <Users class="w-4 h-4" style="color: var(--text-muted)" />
              <span class="text-sm font-bold" style="color: var(--text-primary)">{{ course._count?.enrollments || 0 }}</span>
              <span class="text-xs" style="color: var(--text-muted)">人已参加</span>
            </div>
            <div class="h-4 w-px" style="background-color: var(--border-base)"></div>
            <div class="flex items-center gap-2">
              <BookOpen class="w-4 h-4" style="color: var(--text-muted)" />
              <span class="text-sm font-bold" style="color: var(--text-primary)">{{ course.lessons?.length || 0 }}</span>
              <span class="text-xs" style="color: var(--text-muted)">课时</span>
            </div>
            <div class="h-4 w-px" style="background-color: var(--border-base)"></div>
            <div class="flex items-center gap-2">
              <Timer class="w-4 h-4" style="color: var(--text-muted)" />
              <span class="text-sm font-bold" style="color: var(--text-primary)">{{ totalDurationFormatted }}</span>
            </div>
            <!-- Tags -->
            <template v-if="courseTags.length > 0">
              <div class="h-4 w-px" style="background-color: var(--border-base)"></div>
              <div class="flex items-center gap-2">
                <Tag class="w-3.5 h-3.5" style="color: var(--text-muted)" />
                <span v-for="tag in courseTags.slice(0, 4)" :key="tag" class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent/10 text-accent">
                  {{ tag }}
                </span>
              </div>
            </template>
          </div>

          <!-- Main Content + Sidebar -->
          <div class="flex gap-8 p-8">
            <!-- Left Content -->
            <div class="flex-1 min-w-0 space-y-8">
              <!-- Instructor Card -->
              <div v-if="instructorInfo" class="p-5 rounded-2xl border flex items-center gap-4" style="background-color: var(--bg-card); border-color: var(--border-base)">
                <div class="w-14 h-14 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                  <img v-if="instructorInfo.avatarUrl" :src="instructorInfo.avatarUrl" class="w-full h-full object-cover" />
                  <UserIcon v-else class="w-8 h-8 text-slate-400 m-3" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h4 class="text-sm font-bold" style="color: var(--text-primary)">{{ instructorInfo.name || '讲师' }}</h4>
                    <span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-indigo-500/10 text-indigo-500">讲师</span>
                  </div>
                  <p class="text-xs mt-0.5" style="color: var(--text-muted)">{{ instructorInfo.bio || instructorInfo.email }}</p>
                </div>
                <div class="flex items-center gap-4 text-[10px] font-bold" style="color: var(--text-muted)">
                  <span class="flex items-center gap-1"><BookOpen class="w-3 h-3" /> {{ instructorInfo._count?.courses || 1 }} 门课程</span>
                  <span class="flex items-center gap-1"><Users class="w-3 h-3" /> {{ instructorInfo._count?.courses || 0 }} 学员</span>
                </div>
              </div>

              <!-- Section Tabs -->
              <div class="flex items-center gap-1 p-1 rounded-xl w-fit transition-colors duration-300" style="background-color: var(--bg-card)">
                <button @click="activeSection = 'outline'"
                        class="px-5 py-2.5 rounded-lg text-sm font-bold transition-all"
                        :class="activeSection === 'outline' ? 'bg-accent text-white shadow-md shadow-accent/20' : ''"
                        :style="activeSection !== 'outline' ? 'color: var(--text-secondary)' : ''">
                  课程大纲
                </button>
                <button @click="activeSection = 'reviews'"
                        class="px-5 py-2.5 rounded-lg text-sm font-bold transition-all"
                        :class="activeSection === 'reviews' ? 'bg-accent text-white shadow-md shadow-accent/20' : ''"
                        :style="activeSection !== 'reviews' ? 'color: var(--text-secondary)' : ''">
                  学员评价 ({{ course._count?.reviews || 0 }})
                </button>
              </div>

              <!-- Outline Section -->
              <template v-if="activeSection === 'outline'">
                <div class="space-y-3">
                  <div v-for="(lesson, index) in course.lessons" :key="lesson.id"
                       @click="isEnrolled && handleStartLearning(index as number)"
                       class="group flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md"
                       :class="[
                         course.lessonProgressMap?.[lesson.id] ? 'border-emerald-200 dark:border-emerald-800/30' : '',
                         isEnrolled ? 'cursor-pointer' : ''
                       ]"
                       style="background-color: var(--bg-card); border-color: var(--border-base)">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                         :class="course.lessonProgressMap?.[lesson.id] ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-white/5'"
                         style="color: var(--text-muted)">
                      <CheckCircle2 v-if="course.lessonProgressMap?.[lesson.id]" class="w-5 h-5 text-white" />
                      <span v-else class="text-xs font-black">{{ (index as number) + 1 }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <h4 class="text-sm font-bold truncate" style="color: var(--text-primary)">{{ lesson.title }}</h4>
                      <div class="flex items-center gap-3 mt-1">
                        <span class="flex items-center gap-1 text-[10px] font-medium" style="color: var(--text-muted)">
                          <component :is="getLessonTypeIcon(lesson)" class="w-3 h-3" />
                          {{ getLessonTypeLabel(lesson) }}
                        </span>
                        <span v-if="lesson.duration" class="flex items-center gap-1 text-[10px] font-medium" style="color: var(--text-muted)">
                          <Clock class="w-3 h-3" /> {{ lesson.duration }} 分钟
                        </span>
                      </div>
                    </div>
                    <button v-if="isEnrolled"
                            class="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-accent/10">
                      <PlayCircle class="w-4 h-4 text-accent" />
                    </button>
                  </div>
                </div>

                <div v-if="!course.lessons?.length" class="py-16 text-center rounded-3xl border-2 border-dashed" style="border-color: var(--border-base)">
                  <BookOpen class="w-12 h-12 mx-auto mb-4 opacity-20" style="color: var(--text-muted)" />
                  <p class="text-sm" style="color: var(--text-muted)">课程内容正在准备中</p>
                </div>
              </template>

              <!-- Reviews Section -->
              <template v-if="activeSection === 'reviews'">
                <!-- Rating Summary -->
                <div class="p-6 rounded-2xl border" style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <div class="flex gap-8">
                    <div class="text-center">
                      <div class="text-5xl font-black" style="color: var(--text-primary)">{{ course.avgRating || '-' }}</div>
                      <div class="flex items-center gap-0.5 mt-2 justify-center">
                        <Star v-for="i in 5" :key="i" class="w-4 h-4" :class="i <= Math.round(course.avgRating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700'" />
                      </div>
                      <p class="text-xs mt-2" style="color: var(--text-muted)">{{ course._count?.reviews || 0 }} 条评价</p>
                    </div>
                    <div class="flex-1 space-y-1.5">
                      <div v-for="item in ratingDistribution" :key="item.stars" class="flex items-center gap-3">
                        <span class="text-xs font-bold w-8 text-right" style="color: var(--text-secondary)">{{ item.stars }} 星</span>
                        <div class="flex-1 h-2 rounded-full overflow-hidden" style="background-color: var(--bg-app)">
                          <div class="h-full bg-amber-400 rounded-full transition-all" :style="{ width: item.percent + '%' }"></div>
                        </div>
                        <span class="text-[10px] font-bold w-8" style="color: var(--text-muted)">{{ item.percent }}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Write Review (only if enrolled) -->
                <div v-if="isEnrolled" class="p-6 rounded-2xl border" style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <h4 class="text-sm font-bold mb-4" style="color: var(--text-primary)">写下你的评价</h4>
                  <div class="flex items-center gap-2 mb-4">
                    <span class="text-xs font-bold" style="color: var(--text-muted)">评分：</span>
                    <button v-for="i in 5" :key="i" @click="reviewRating = i" class="p-0.5 transition-transform hover:scale-125">
                      <Star class="w-5 h-5 transition-colors" :class="i <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700'" />
                    </button>
                  </div>
                  <textarea v-model="reviewComment" rows="3" placeholder="分享你的学习体验..."
                            class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none text-sm"
                            style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"></textarea>
                  <div class="flex justify-end mt-3">
                    <button @click="handleSubmitReview" :disabled="isSubmittingReview"
                            class="flex items-center gap-2 px-6 py-2.5 bg-accent text-white font-bold text-sm rounded-xl shadow-lg shadow-accent/20 disabled:opacity-50 transition-all">
                      <Send class="w-4 h-4" />
                      提交评价
                    </button>
                  </div>
                </div>

                <!-- Reviews List -->
                <div class="space-y-4">
                  <div v-for="review in course.reviews" :key="review.id"
                       class="p-5 rounded-2xl border" style="background-color: var(--bg-card); border-color: var(--border-base)">
                    <div class="flex items-center gap-3 mb-3">
                      <div class="w-9 h-9 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                        <img v-if="review.user?.avatarUrl" :src="review.user.avatarUrl" class="w-full h-full object-cover" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate" style="color: var(--text-primary)">{{ review.user?.name || '匿名用户' }}</p>
                        <div class="flex items-center gap-2">
                          <div class="flex items-center gap-0.5">
                            <Star v-for="i in 5" :key="i" class="w-3 h-3" :class="i <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700'" />
                          </div>
                          <span class="text-[10px]" style="color: var(--text-muted)">{{ formatTimeAgo(review.createdAt) }}</span>
                        </div>
                      </div>
                    </div>
                    <p v-if="review.comment" class="text-sm leading-relaxed" style="color: var(--text-secondary)">{{ review.comment }}</p>
                  </div>

                  <div v-if="!course.reviews?.length" class="py-16 text-center rounded-3xl border-2 border-dashed" style="border-color: var(--border-base)">
                    <MessageSquare class="w-12 h-12 mx-auto mb-4 opacity-20" style="color: var(--text-muted)" />
                    <p class="text-sm" style="color: var(--text-muted)">暂无评价，成为第一个评价的人吧</p>
                  </div>
                </div>
              </template>
            </div>

            <!-- Right Sidebar - Sticky CTA -->
            <div class="w-80 shrink-0 hidden lg:block">
              <div class="sticky top-8 space-y-4">
                <!-- Progress Card (if enrolled) -->
                <div v-if="isEnrolled" class="p-6 rounded-2xl border" style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 bg-emerald-500/10 rounded-lg">
                      <CheckCircle2 class="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p class="text-xs font-bold" style="color: var(--text-muted)">学习进度</p>
                      <p class="text-lg font-black" style="color: var(--text-primary)">{{ courseProgress }}%</p>
                    </div>
                  </div>
                  <div class="w-full h-2 rounded-full overflow-hidden mb-4" style="background-color: var(--bg-app)">
                    <div class="h-full bg-emerald-500 rounded-full transition-all duration-1000" :style="{ width: courseProgress + '%' }"></div>
                  </div>
                  <p class="text-xs mb-4" style="color: var(--text-muted)">已完成 {{ completedLessonCount }} / {{ course.lessons?.length || 0 }} 课时</p>
                  <button @click="handleStartLearning"
                          class="w-full py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 transition-all hover:shadow-xl flex items-center justify-center gap-2">
                    <PlayCircle class="w-5 h-5" />
                    继续学习
                  </button>
                </div>

                <!-- Enroll Card (if not enrolled) -->
                <div v-else class="p-6 rounded-2xl border" style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <div class="space-y-4 mb-6">
                    <div class="flex items-center gap-3">
                      <BookOpen class="w-4 h-4" style="color: var(--text-muted)" />
                      <span class="text-sm" style="color: var(--text-secondary)">{{ course.lessons?.length || 0 }} 节课时</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <Timer class="w-4 h-4" style="color: var(--text-muted)" />
                      <span class="text-sm" style="color: var(--text-secondary)">总时长 {{ totalDurationFormatted }}</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <Signal class="w-4 h-4" style="color: var(--text-muted)" />
                      <span class="text-sm" style="color: var(--text-secondary)">{{ difficultyMap[course.difficulty]?.label || '入门' }}难度</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <Users class="w-4 h-4" style="color: var(--text-muted)" />
                      <span class="text-sm" style="color: var(--text-secondary)">{{ course._count?.enrollments || 0 }} 人已参加</span>
                    </div>
                  </div>
                  <button @click="handleEnroll" :disabled="isEnrolling"
                          class="w-full py-3.5 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 transition-all hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
                    <GraduationCap class="w-5 h-5" />
                    {{ isEnrolling ? '加入中...' : '立即参加' }}
                  </button>
                </div>

                <!-- Course Description Card -->
                <div class="p-6 rounded-2xl border" style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <h4 class="text-sm font-bold mb-3" style="color: var(--text-primary)">课程简介</h4>
                  <p class="text-xs leading-relaxed" style="color: var(--text-secondary)">{{ course.description || '暂无简介' }}</p>
                </div>

                <!-- Tags Card -->
                <div v-if="courseTags.length > 0" class="p-6 rounded-2xl border" style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <h4 class="text-sm font-bold mb-3 flex items-center gap-2" style="color: var(--text-primary)">
                    <Tag class="w-4 h-4 text-accent" /> 课程标签
                  </h4>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="tag in courseTags" :key="tag" 
                          class="px-3 py-1 rounded-lg text-xs font-bold bg-accent/10 text-accent">
                      {{ tag }}
                    </span>
                  </div>
                </div>

                <!-- Quick Notes Entry -->
                <div v-if="isEnrolled" class="p-6 rounded-2xl border" style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <h4 class="text-sm font-bold mb-3 flex items-center gap-2" style="color: var(--text-primary)">
                    <StickyNote class="w-4 h-4 text-amber-500" /> 学习笔记
                  </h4>
                  <p class="text-xs mb-3" style="color: var(--text-muted)">记录你的学习心得和笔记</p>
                  <textarea rows="5" placeholder="在这里快速记录笔记..."
                            class="w-full px-3 py-2 rounded-xl border text-xs outline-none resize-none transition-all focus:ring-2 focus:ring-accent/20"
                            style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"></textarea>
                  <button class="w-full mt-2 py-2 border border-slate-200 dark:border-white/10 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5" style="color: var(--text-secondary)">
                    <StickyNote class="w-3.5 h-3.5" /> 保存笔记
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Mobile CTA (sticky bottom on mobile) -->
          <div v-if="!isEnrolled" class="lg:hidden sticky bottom-0 p-4 border-t" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <button @click="handleEnroll" :disabled="isEnrolling"
                    class="w-full py-3.5 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-2">
              <GraduationCap class="w-5 h-5" />
              {{ isEnrolling ? '加入中...' : '立即参加课程' }}
            </button>
          </div>
          <div v-else class="lg:hidden sticky bottom-0 p-4 border-t" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <button @click="handleStartLearning"
                    class="w-full py-3.5 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 flex items-center justify-center gap-2">
              <PlayCircle class="w-5 h-5" />
              继续学习 ({{ courseProgress }}%)
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

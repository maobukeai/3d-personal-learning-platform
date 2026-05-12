<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
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
  Loader2,
  CheckCircle2,
  FolderTree,
  X,
  Star,
  Eye,
  EyeOff,
  Clock,
  Users,
  BarChart3,
  GraduationCap
} from 'lucide-vue-next'
import api from '@/utils/api'
import { ElMessage } from 'element-plus'

const courses = ref<any[]>([])
const isLoading = ref(true)
const showCourseModal = ref(false)
const showLessonModal = ref(false)
const showImportModal = ref(false)
const currentCourse = ref<any>(null)
const currentLesson = ref<any>(null)

const externalUrl = ref('')
const isParsing = ref(false)
const parsedMetadata = ref<any>(null)

const categories = ref<any[]>([])
const activeTab = ref<'courses' | 'categories'>('courses')
const searchQuery = ref('')
const sortBy = ref<'newest' | 'enrollments' | 'rating'>('newest')

const courseStats = computed(() => {
  const total = courses.value.length
  const published = courses.value.filter(c => c.status === 'PUBLISHED').length
  const draft = courses.value.filter(c => c.status === 'DRAFT').length
  const totalEnrollments = courses.value.reduce((sum, c) => sum + (c._count?.enrollments || 0), 0)
  const totalLessons = courses.value.reduce((sum, c) => sum + (c.lessons?.length || 0), 0)
  return { total, published, draft, totalEnrollments, totalLessons }
})

const courseForm = ref({
  title: '',
  description: '',
  thumbnail: '',
  categoryId: '',
  difficulty: 'BEGINNER',
  status: 'PUBLISHED'
})

const lessonForm = ref({
  title: '',
  content: '',
  videoUrl: '',
  order: 0,
  courseId: '',
  duration: 0
})

const categoryForm = ref({
  name: '',
  order: 0
})

const showCategoryModal = ref(false)
const currentCategory = ref<any>(null)
const expandedCourseIds = ref<Set<string>>(new Set())

const difficultyMap: Record<string, { label: string; color: string }> = {
  BEGINNER: { label: '入门', color: 'text-emerald-500 bg-emerald-500/10' },
  INTERMEDIATE: { label: '进阶', color: 'text-amber-500 bg-amber-500/10' },
  ADVANCED: { label: '高级', color: 'text-rose-500 bg-rose-500/10' }
}

const toggleCourseExpansion = (courseId: string) => {
  if (expandedCourseIds.value.has(courseId)) {
    expandedCourseIds.value.delete(courseId)
  } else {
    expandedCourseIds.value.add(courseId)
  }
}

const fetchCourses = async () => {
  try {
    isLoading.value = true
    const { data } = await api.get('/api/admin/courses')
    courses.value = data
  } catch (error) {
    console.error('Fetch courses error:', error)
  } finally {
    isLoading.value = false
  }
}

const fetchCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/course-categories')
    categories.value = data
  } catch (error) {
    console.error('Fetch categories error:', error)
  }
}

const filteredCourses = computed(() => {
  let list = courses.value
  if (searchQuery.value) {
    list = list.filter(c =>
      c.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
  switch (sortBy.value) {
    case 'newest': return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    case 'enrollments': return list.sort((a, b) => (b._count?.enrollments || 0) - (a._count?.enrollments || 0))
    case 'rating': return list.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
    default: return list
  }
})

const handleParseExternal = async () => {
  if (!externalUrl.value) return
  try {
    isParsing.value = true
    const { data } = await api.post('/api/admin/courses/parse-external', { url: externalUrl.value })
    parsedMetadata.value = data
  } catch (error: any) {
    alert(error.response?.data?.error || '解析失败，请检查链接是否正确')
  } finally {
    isParsing.value = false
  }
}

const handleImportExternal = async () => {
  if (!parsedMetadata.value) return
  try {
    isParsing.value = true
    await api.post('/api/admin/courses/batch', {
      title: parsedMetadata.value.title,
      description: parsedMetadata.value.description,
      thumbnail: parsedMetadata.value.thumbnail,
      lessons: parsedMetadata.value.lessons
    })
    showImportModal.value = false
    externalUrl.value = ''
    parsedMetadata.value = null
    fetchCourses()
  } catch (error: any) {
    alert(error.response?.data?.error || '导入失败')
  } finally {
    isParsing.value = false
  }
}

const handleSaveCourse = async () => {
  try {
    if (currentCourse.value) {
      await api.put(`/api/admin/courses/${currentCourse.value.id}`, courseForm.value)
      ElMessage.success('课程更新成功')
    } else {
      await api.post('/api/admin/courses', courseForm.value)
      ElMessage.success('课程创建成功')
    }
    showCourseModal.value = false
    fetchCourses()
  } catch (error) {
    ElMessage.error('保存课程失败')
  }
}

const handleSaveCategory = async () => {
  try {
    if (currentCategory.value) {
      await api.put(`/api/admin/course-categories/${currentCategory.value.id}`, categoryForm.value)
      ElMessage.success('分类更新成功')
    } else {
      await api.post('/api/admin/course-categories', categoryForm.value)
      ElMessage.success('分类创建成功')
    }
    showCategoryModal.value = false
    fetchCategories()
  } catch (error) {
    ElMessage.error('保存分类失败')
  }
}

const handleDeleteCategory = async (id: string) => {
  if (!confirm('确定要删除这个分类吗？')) return
  try {
    await api.delete(`/api/admin/course-categories/${id}`)
    ElMessage.success('分类已删除')
    fetchCategories()
    fetchCourses()
  } catch (error) {
    ElMessage.error('删除分类失败')
  }
}

const handleDeleteCourse = async (id: string) => {
  if (!confirm('确定要删除这个课程吗？所有关联的课时也将被删除。')) return
  try {
    await api.delete(`/api/admin/courses/${id}`)
    fetchCourses()
  } catch (error) {
    console.error('Delete course error:', error)
  }
}

const toggleCourseStatus = async (course: any) => {
  const newStatus = course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
  try {
    await api.put(`/api/admin/courses/${course.id}`, { ...course, status: newStatus })
    fetchCourses()
    ElMessage.success(newStatus === 'PUBLISHED' ? '课程已发布' : '课程已转为草稿')
  } catch (error) {
    ElMessage.error('更新状态失败')
  }
}

const openCourseModal = (course: any = null) => {
  currentCourse.value = course
  if (course) {
    courseForm.value = {
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      categoryId: course.categoryId || '',
      difficulty: course.difficulty || 'BEGINNER',
      status: course.status || 'PUBLISHED'
    }
  } else {
    courseForm.value = { title: '', description: '', thumbnail: '', categoryId: '', difficulty: 'BEGINNER', status: 'PUBLISHED' }
  }
  showCourseModal.value = true
}

const openCategoryModal = (category: any = null) => {
  currentCategory.value = category
  if (category) {
    categoryForm.value = {
      name: category.name,
      order: category.order
    }
  } else {
    categoryForm.value = { name: '', order: categories.value.length + 1 }
  }
  showCategoryModal.value = true
}

const openLessonModal = (course: any, lesson: any = null) => {
  currentCourse.value = course
  currentLesson.value = lesson
  if (lesson) {
    lessonForm.value = {
      title: lesson.title,
      content: lesson.content,
      videoUrl: lesson.videoUrl,
      order: lesson.order,
      courseId: course.id,
      duration: lesson.duration || 0
    }
  } else {
    lessonForm.value = {
      title: '',
      content: '',
      videoUrl: '',
      order: (course.lessons?.length || 0) + 1,
      courseId: course.id,
      duration: 0
    }
  }
  showLessonModal.value = true
}

const handleSaveLesson = async () => {
  try {
    if (currentLesson.value) {
      await api.put(`/api/admin/courses/lessons/${currentLesson.value.id}`, lessonForm.value)
    } else {
      await api.post('/api/admin/courses/lessons', lessonForm.value)
    }
    showLessonModal.value = false
    fetchCourses()
  } catch (error) {
    console.error('Save lesson error:', error)
  }
}

const handleDeleteLesson = async (id: string) => {
  if (!confirm('确定要删除这个课时吗？')) return
  try {
    await api.delete(`/api/admin/courses/lessons/${id}`)
    fetchCourses()
  } catch (error) {
    console.error('Delete lesson error:', error)
  }
}

onMounted(() => {
  fetchCourses()
  fetchCategories()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div>
        <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">学院课程管理</h1>
        <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">发布和编辑学院教学课程</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1 p-1 rounded-xl transition-colors duration-300" style="background-color: var(--bg-app)">
          <button @click="activeTab = 'courses'"
                  class="px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  :class="activeTab === 'courses' ? 'bg-white dark:bg-white/10 shadow-sm text-accent' : 'text-slate-400 hover:text-slate-600'">
            课程列表
          </button>
          <button @click="activeTab = 'categories'"
                  class="px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  :class="activeTab === 'categories' ? 'bg-white dark:bg-white/10 shadow-sm text-accent' : 'text-slate-400 hover:text-slate-600'">
            分类管理
          </button>
        </div>

        <div class="h-8 w-[1px] mx-2 transition-colors duration-300" style="background-color: var(--border-base)"></div>

        <button @click="showImportModal = true" class="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm transition-all shadow-sm">
          <LinkIcon class="w-4 h-4" />
          外部导入
        </button>
        <button v-if="activeTab === 'courses'" @click="openCourseModal()" class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm transition-all shadow-lg shadow-accent/20">
          <Plus class="w-4 h-4" />
          新建课程
        </button>
        <button v-if="activeTab === 'categories'" @click="openCategoryModal()" class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm transition-all shadow-lg shadow-accent/20">
          <Plus class="w-4 h-4" />
          新建分类
        </button>
      </div>
    </div>

    <!-- Search Bar -->
    <div v-if="activeTab === 'courses'" class="px-8 py-4 border-b transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-4 max-w-5xl">
        <div class="relative flex-1">
          <Search class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="searchQuery" type="text" placeholder="搜索课程标题或描述..."
                 class="w-full pl-12 pr-4 py-2.5 rounded-2xl border transition-all outline-none text-sm"
                 style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
          <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>
        <select v-model="sortBy" class="px-4 py-2.5 rounded-2xl border text-sm outline-none"
                style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
          <option value="newest">最新创建</option>
          <option value="enrollments">报名最多</option>
          <option value="rating">评分最高</option>
        </select>
      </div>
    </div>

    <!-- Stats Panel -->
    <div v-if="activeTab === 'courses'" class="px-8 py-4 border-b transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="grid grid-cols-5 gap-4 max-w-5xl">
        <div class="p-3 rounded-xl border transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-bold text-slate-400 uppercase">总课程</span>
            <BarChart3 class="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p class="text-xl font-black" style="color: var(--text-primary)">{{ courseStats.total }}</p>
        </div>
        <div class="p-3 rounded-xl border transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-bold text-emerald-500 uppercase">已发布</span>
            <Eye class="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p class="text-xl font-black text-emerald-500">{{ courseStats.published }}</p>
        </div>
        <div class="p-3 rounded-xl border transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-bold text-amber-500 uppercase">草稿</span>
            <EyeOff class="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p class="text-xl font-black text-amber-500">{{ courseStats.draft }}</p>
        </div>
        <div class="p-3 rounded-xl border transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-bold text-indigo-500 uppercase">总报名</span>
            <Users class="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p class="text-xl font-black text-indigo-500">{{ courseStats.totalEnrollments }}</p>
        </div>
        <div class="p-3 rounded-xl border transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-bold text-accent uppercase">总课时</span>
            <GraduationCap class="w-3.5 h-3.5 text-accent" />
          </div>
          <p class="text-xl font-black text-accent">{{ courseStats.totalLessons }}</p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24">
        <div class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else class="max-w-5xl mx-auto space-y-6">
        <!-- Courses List -->
        <template v-if="activeTab === 'courses'">
          <div v-for="course in filteredCourses" :key="course.id"
               class="group rounded-3xl border overflow-hidden transition-all hover:shadow-lg"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="p-6 flex items-start gap-6">
              <!-- Thumbnail -->
              <div class="w-40 aspect-video rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden flex-shrink-0 relative">
                <img v-if="course.thumbnail" :src="course.thumbnail"
                     referrerpolicy="no-referrer"
                     class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <BookOpen class="w-8 h-8 text-slate-300" />
                </div>
                <div v-if="course.status === 'DRAFT'" class="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span class="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 text-slate-300">草稿</span>
                </div>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0 cursor-pointer" @click="toggleCourseExpansion(course.id)">
                <div class="flex items-start justify-between gap-4 mb-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-1 min-w-0 flex-wrap">
                      <span v-if="course.category" class="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-bold shrink-0">{{ course.category.name }}</span>
                      <span :class="difficultyMap[course.difficulty]?.color || 'text-slate-400 bg-slate-400/10'" class="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0">
                        {{ difficultyMap[course.difficulty]?.label || '入门' }}
                      </span>
                      <h3 class="font-bold text-xl truncate" style="color: var(--text-primary)">{{ course.title }}</h3>
                      <ChevronRight class="w-4 h-4 text-slate-300 transition-transform duration-300 shrink-0" :class="{ 'rotate-90': expandedCourseIds.has(course.id) }" />
                    </div>
                    <p class="text-xs text-slate-400 line-clamp-2">{{ course.description }}</p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0" @click.stop>
                    <button @click="toggleCourseStatus(course)" class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            :title="course.status === 'PUBLISHED' ? '转为草稿' : '发布课程'">
                      <Eye v-if="course.status === 'PUBLISHED'" class="w-4 h-4 text-emerald-500" />
                      <EyeOff v-else class="w-4 h-4 text-slate-400" />
                    </button>
                    <button @click="openCourseModal(course)" class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 transition-colors">
                      <Edit2 class="w-4 h-4" />
                    </button>
                    <button @click="handleDeleteCourse(course.id)" class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                  <span class="flex items-center gap-1.5"><Video class="w-3.5 h-3.5" /> {{ course.lessons?.length || 0 }} 课时</span>
                  <span>•</span>
                  <span>{{ course._count?.enrollments || 0 }} 人已参加</span>
                  <span>•</span>
                  <span class="flex items-center gap-1"><Star class="w-3 h-3 text-amber-400" /> {{ course.avgRating || '-' }}</span>
                  <span v-if="course._count?.reviews">•</span>
                  <span v-if="course._count?.reviews">{{ course._count.reviews }} 评价</span>
                </div>
              </div>
            </div>

            <!-- Lessons List -->
            <div v-if="expandedCourseIds.has(course.id)" class="border-t p-4 transition-all duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
              <div class="space-y-2">
                <div v-for="lesson in course.lessons" :key="lesson.id"
                     class="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-transparent hover:border-accent/20 transition-all group/lesson shadow-sm">
                  <div class="flex items-center gap-3">
                    <GripVertical class="w-4 h-4 text-slate-300" />
                    <span class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-400">{{ lesson.order }}</span>
                    <span class="text-sm font-bold truncate max-w-md" style="color: var(--text-primary)">{{ lesson.title }}</span>
                    <span v-if="lesson.duration" class="flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock class="w-3 h-3" /> {{ lesson.duration }}分钟
                    </span>
                  </div>
                  <div class="flex items-center gap-1 opacity-0 group-hover/lesson:opacity-100 transition-opacity">
                    <button @click="openLessonModal(course, lesson)" class="p-1.5 rounded-lg text-slate-400 hover:text-accent">
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button @click="handleDeleteLesson(lesson.id)" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <button @click="openLessonModal(course)" class="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/5 text-slate-400 hover:text-accent hover:border-accent/40 transition-all text-xs font-bold flex items-center justify-center gap-2">
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
            <div v-for="cat in categories" :key="cat.id"
                 class="p-6 rounded-3xl border flex items-center justify-between transition-all hover:shadow-md"
                 style="background-color: var(--bg-card); border-color: var(--border-base)">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <FolderTree class="w-5 h-5" />
                </div>
                <div>
                  <h4 class="font-bold text-lg" style="color: var(--text-primary)">{{ cat.name }}</h4>
                  <p class="text-xs text-slate-400">排序: {{ cat.order }} · {{ cat._count?.courses || 0 }} 门课程</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button @click="openCategoryModal(cat)" class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 transition-colors">
                  <Edit2 class="w-4 h-4" />
                </button>
                <button @click="handleDeleteCategory(cat.id)" class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors">
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

    <!-- Course Modal -->
    <div v-if="showCourseModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-xl rounded-3xl p-8 shadow-2xl transition-colors duration-300 max-h-[90vh] overflow-y-auto" style="background-color: var(--bg-card)">
        <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">{{ currentCourse ? '编辑课程' : '新建课程' }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">课程标题</label>
            <input v-model="courseForm.title" type="text" placeholder="输入课程标题..."
                   class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                   style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">课程分类</label>
              <select v-model="courseForm.categoryId"
                      class="w-full px-4 py-3 rounded-2xl border transition-all outline-none appearance-none"
                      style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
                <option value="">请选择分类</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">难度等级</label>
              <select v-model="courseForm.difficulty"
                      class="w-full px-4 py-3 rounded-2xl border transition-all outline-none appearance-none"
                      style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
                <option value="BEGINNER">入门</option>
                <option value="INTERMEDIATE">进阶</option>
                <option value="ADVANCED">高级</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">发布状态</label>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="courseForm.status" value="PUBLISHED" class="accent-accent" />
                <span class="text-sm font-medium" style="color: var(--text-primary)">发布</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="courseForm.status" value="DRAFT" class="accent-accent" />
                <span class="text-sm font-medium" style="color: var(--text-primary)">草稿</span>
              </label>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">课程描述</label>
            <textarea v-model="courseForm.description" rows="3" placeholder="输入课程简介..."
                      class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
                      style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"></textarea>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">封面图链接</label>
            <input v-model="courseForm.thumbnail" type="text" placeholder="https://..."
                   class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                   style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
          </div>
        </div>
        <div class="flex items-center gap-4 mt-8">
          <button @click="showCourseModal = false" class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">取消</button>
          <button @click="handleSaveCourse" class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20">保存课程</button>
        </div>
      </div>
    </div>

    <!-- Category Modal -->
    <div v-if="showCategoryModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-3xl p-8 shadow-2xl transition-colors duration-300" style="background-color: var(--bg-card)">
        <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">{{ currentCategory ? '编辑分类' : '新建分类' }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">分类名称</label>
            <input v-model="categoryForm.name" type="text" placeholder="输入分类名称..."
                   class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                   style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">排序</label>
            <input v-model="categoryForm.order" type="number"
                   class="w-full px-4 py-3 rounded-2xl border transition-all outline-none font-bold"
                   style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
          </div>
        </div>
        <div class="flex items-center gap-4 mt-8">
          <button @click="showCategoryModal = false" class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">取消</button>
          <button @click="handleSaveCategory" class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20">保存分类</button>
        </div>
      </div>
    </div>

    <!-- Lesson Modal -->
    <div v-if="showLessonModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-2xl rounded-3xl p-8 shadow-2xl transition-colors duration-300" style="background-color: var(--bg-card)">
        <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">{{ currentLesson ? '编辑课时' : '新建课时' }}</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-4 gap-4">
            <div class="col-span-2">
              <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">课时标题</label>
              <input v-model="lessonForm.title" type="text" placeholder="输入课时标题..."
                     class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">排序</label>
              <input v-model="lessonForm.order" type="number"
                     class="w-full px-4 py-3 rounded-2xl border transition-all outline-none text-center font-bold"
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">时长(分钟)</label>
              <input v-model="lessonForm.duration" type="number"
                     class="w-full px-4 py-3 rounded-2xl border transition-all outline-none text-center font-bold"
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">视频链接</label>
            <input v-model="lessonForm.videoUrl" type="text" placeholder="https://..."
                   class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                   style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">课时内容 (Markdown)</label>
            <textarea v-model="lessonForm.content" rows="6" placeholder="输入课时详细内容..."
                      class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
                      style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"></textarea>
          </div>
        </div>
        <div class="flex items-center gap-4 mt-8">
          <button @click="showLessonModal = false" class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">取消</button>
          <button @click="handleSaveLesson" class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20">保存课时</button>
        </div>
      </div>
    </div>

    <!-- External Import Modal -->
    <div v-if="showImportModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-2xl rounded-3xl p-8 shadow-2xl transition-colors duration-300" style="background-color: var(--bg-card)">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold" style="color: var(--text-primary)">从 外部平台 导入课程</h3>
          <button @click="showImportModal = false" class="text-slate-400 hover:text-slate-600">
            <Plus class="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">课程或项目链接 (支持 B站 / YouTube / GitHub)</label>
            <div class="flex gap-2">
              <input v-model="externalUrl" type="text" placeholder="粘贴 B站、YouTube 或 GitHub 链接..."
                     class="flex-1 px-4 py-3 rounded-2xl border transition-all outline-none"
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
                     @keyup.enter="handleParseExternal" />
              <button @click="handleParseExternal" :disabled="isParsing || !externalUrl"
                      class="px-6 py-3 rounded-2xl bg-accent text-white font-bold disabled:opacity-50 flex items-center gap-2">
                <Loader2 v-if="isParsing && !parsedMetadata" class="w-4 h-4 animate-spin" />
                解析
              </button>
            </div>
          </div>

          <!-- Preview -->
          <div v-if="parsedMetadata" class="rounded-2xl border p-4 space-y-4 transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
            <div class="flex gap-4">
              <img :src="parsedMetadata.thumbnail"
                   referrerpolicy="no-referrer"
                   class="w-32 aspect-video rounded-lg object-cover shadow-sm" />
              <div class="flex-1 min-w-0">
                <h4 class="font-bold text-sm mb-1 truncate" style="color: var(--text-primary)">{{ parsedMetadata.title }}</h4>
                <p class="text-[10px] text-slate-400 line-clamp-2">{{ parsedMetadata.description }}</p>
              </div>
            </div>

            <div class="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              <div v-for="lesson in parsedMetadata.lessons" :key="lesson.order"
                   class="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-white/5 border border-transparent">
                <span class="text-[10px] font-black text-slate-300 w-4">{{ lesson.order }}</span>
                <span class="text-xs font-medium truncate flex-1" style="color: var(--text-primary)">{{ lesson.title }}</span>
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
              </div>
            </div>

            <p class="text-[10px] text-center font-bold text-slate-400">共解析出 {{ parsedMetadata.lessons.length }} 个课时</p>
          </div>
        </div>

        <div class="flex items-center gap-4 mt-8">
          <button @click="showImportModal = false" class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">取消</button>
          <button @click="handleImportExternal" :disabled="!parsedMetadata || isParsing"
                  class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-2">
            <Loader2 v-if="isParsing && parsedMetadata" class="w-4 h-4 animate-spin" />
            确认导入
          </button>
        </div>
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

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
</style>

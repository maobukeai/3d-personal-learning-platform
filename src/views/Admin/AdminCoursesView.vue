<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { 
  Plus, 
  Search, 
  MoreVertical, 
  BookOpen, 
  Video, 
  Trash2, 
  Edit2,
  ChevronRight,
  GripVertical
} from 'lucide-vue-next'
import api from '@/utils/api'

const courses = ref<any[]>([])
const isLoading = ref(true)
const showCourseModal = ref(false)
const showLessonModal = ref(false)
const currentCourse = ref<any>(null)
const currentLesson = ref<any>(null)

const courseForm = ref({
  title: '',
  description: '',
  thumbnail: ''
})

const lessonForm = ref({
  title: '',
  content: '',
  videoUrl: '',
  order: 0,
  courseId: ''
})

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

const handleSaveCourse = async () => {
  try {
    if (currentCourse.value) {
      await api.put(`/api/admin/courses/${currentCourse.value.id}`, courseForm.value)
    } else {
      await api.post('/api/admin/courses', courseForm.value)
    }
    showCourseModal.value = false
    fetchCourses()
  } catch (error) {
    console.error('Save course error:', error)
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

const openCourseModal = (course: any = null) => {
  currentCourse.value = course
  if (course) {
    courseForm.value = {
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail
    }
  } else {
    courseForm.value = { title: '', description: '', thumbnail: '' }
  }
  showCourseModal.value = true
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
      courseId: course.id
    }
  } else {
    lessonForm.value = {
      title: '',
      content: '',
      videoUrl: '',
      order: (course.lessons?.length || 0) + 1,
      courseId: course.id
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
      
      <button @click="openCourseModal()" class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm transition-all shadow-lg shadow-accent/20">
        <Plus class="w-4 h-4" />
        新建课程
      </button>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24">
        <div class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else class="max-w-5xl mx-auto space-y-6">
        <div v-for="course in courses" :key="course.id" 
             class="group rounded-3xl border overflow-hidden transition-all hover:shadow-lg"
             style="background-color: var(--bg-card); border-color: var(--border-base)">
          <div class="p-6 flex items-start gap-6">
            <!-- Thumbnail -->
            <div class="w-40 aspect-video rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden flex-shrink-0">
              <img v-if="course.thumbnail" :src="course.thumbnail" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <BookOpen class="w-8 h-8 text-slate-300" />
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <h3 class="font-bold text-xl mb-1 truncate" style="color: var(--text-primary)">{{ course.title }}</h3>
                  <p class="text-xs text-slate-400 line-clamp-2">{{ course.description }}</p>
                </div>
                <div class="flex items-center gap-2">
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
                <span>{{ course._count.enrollments }} 人已参加</span>
              </div>
            </div>
          </div>

          <!-- Lessons List -->
          <div class="border-t p-4 transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
            <div class="space-y-2">
              <div v-for="lesson in course.lessons" :key="lesson.id" 
                   class="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-transparent hover:border-accent/20 transition-all group/lesson shadow-sm">
                <div class="flex items-center gap-3">
                  <GripVertical class="w-4 h-4 text-slate-300" />
                  <span class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-400">{{ lesson.order }}</span>
                  <span class="text-sm font-bold truncate max-w-md" style="color: var(--text-primary)">{{ lesson.title }}</span>
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
      </div>
    </div>

    <!-- Course Modal -->
    <div v-if="showCourseModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-xl rounded-3xl p-8 shadow-2xl transition-colors duration-300" style="background-color: var(--bg-card)">
        <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">{{ currentCourse ? '编辑课程' : '新建课程' }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">课程标题</label>
            <input v-model="courseForm.title" type="text" placeholder="输入课程标题..." 
                   class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                   style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
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

    <!-- Lesson Modal -->
    <div v-if="showLessonModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-2xl rounded-3xl p-8 shadow-2xl transition-colors duration-300" style="background-color: var(--bg-card)">
        <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">{{ currentLesson ? '编辑课时' : '新建课时' }}</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-4 gap-4">
            <div class="col-span-3">
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
</style>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Search, 
  PlayCircle, 
  Clock, 
  Star, 
  ChevronRight, 
  GraduationCap, 
  BookOpen,
  Filter,
  Users
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const router = useRouter()
const searchQuery = ref('')
const activeCategory = ref('全部课程')
const courses = ref<any[]>([])
const myEnrollments = ref<any[]>([])
const isLoading = ref(false)

const categories = ['全部课程', '我的课程']

const fetchData = async () => {
  isLoading.value = true
  try {
    const [coursesRes, enrollmentsRes] = await Promise.all([
      api.get('/api/courses'),
      api.get('/api/courses/my-enrollments')
    ])
    courses.value = coursesRes.data
    myEnrollments.value = enrollmentsRes.data
  } catch (error) {
    console.error('Fetch data error:', error)
  } finally {
    isLoading.value = false
  }
}

const isEnrolled = (courseId: string) => {
  return myEnrollments.value.some(e => e.courseId === courseId)
}

const handleCourseClick = async (courseId: string) => {
  if (isEnrolled(courseId)) {
    router.push(`/academy/player/${courseId}`)
  } else {
    try {
      await api.post('/api/courses/enroll', { courseId })
      ElMessage.success('成功加入课程')
      fetchData()
      router.push(`/academy/player/${courseId}`)
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || '加入课程失败')
    }
  }
}

const filteredCourses = computed(() => {
  let list = courses.value
  if (activeCategory.value === '我的课程') {
    list = myEnrollments.value.map(e => e.course)
  }
  return list.filter(course => {
    return course.title.toLowerCase().includes(searchQuery.value.toLowerCase())
  })
})

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Top Header -->
    <div class="h-16 px-8 flex items-center justify-between shrink-0 border-b transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-accent-subtle rounded-lg">
          <GraduationCap class="w-5 h-5 text-accent" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">学习学院</h1>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-muted)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索课程名称..." 
            class="pl-10 pr-4 py-2 bg-slate-100 dark:bg-white/5 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 w-72 transition-all"
            style="color: var(--text-primary)"
          />
        </div>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="px-8 py-2 shrink-0 overflow-x-auto scrollbar-hide border-b transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-2">
        <button 
          v-for="cat in categories" 
          :key="cat"
          @click="activeCategory = cat"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
          :class="activeCategory === cat ? 'bg-accent text-white shadow-md shadow-accent/20' : 'hover:opacity-80'"
          :style="activeCategory !== cat ? 'color: var(--text-secondary)' : ''"
        >
          {{ cat }}
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-7xl mx-auto space-y-8">
        <!-- Course Grid -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold" style="color: var(--text-primary)">{{ activeCategory === '全部课程' ? '推荐课程' : activeCategory }}</h2>
          </div>

          <div v-if="filteredCourses.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div v-for="course in filteredCourses" :key="course.id" 
                 @click="handleCourseClick(course.id)"
                 class="group rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                 style="background-color: var(--bg-card); border-color: var(--border-base)">
              <!-- Course Cover -->
              <div class="aspect-video relative overflow-hidden bg-slate-100 dark:bg-white/5">
                <img :src="course.thumbnail || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <PlayCircle class="w-12 h-12 text-white drop-shadow-lg" />
                </div>
                <!-- Enrollment Badge -->
                <div v-if="isEnrolled(course.id)" class="absolute top-3 right-3 px-2 py-1 rounded text-[10px] font-bold shadow-sm bg-emerald-500 text-white">
                  已加入
                </div>
              </div>

              <!-- Course Info -->
              <div class="p-5">
                <h3 class="text-sm font-bold mb-3 line-clamp-2 min-h-[40px] leading-snug group-hover:text-accent transition-colors" style="color: var(--text-primary)">
                  {{ course.title }}
                </h3>
                
                <div class="flex items-center justify-between pt-4 border-t transition-colors duration-300" style="border-color: var(--border-base)">
                  <div class="flex items-center gap-3 text-[10px] font-bold" style="color: var(--text-muted)">
                    <span class="flex items-center gap-1"><BookOpen class="w-3 h-3" /> {{ course._count?.lessons || 0 }} 课时</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="h-64 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed" style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-muted)">
            <GraduationCap class="w-12 h-12 mb-4 opacity-20" />
            <p class="text-sm">没有找到相关的课程</p>
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue'
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

const router = useRouter()
const searchQuery = ref('')
const activeCategory = ref('全部课程')

const categories = ['全部课程', 'Blender 基础', '材质与渲染', '几何节点', '动画进阶', '行业实战']

const courses = [
  {
    id: 1,
    title: 'Blender 3.0 完全入门指南',
    instructor: '王老师',
    level: '入门',
    duration: '12 小时',
    rating: 4.8,
    students: 1240,
    image: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60',
    progress: 100,
    category: 'Blender 基础'
  },
  {
    id: 2,
    title: 'Cycles 渲染器高级布光技巧',
    instructor: '李设计师',
    level: '进阶',
    duration: '5 小时',
    rating: 4.9,
    students: 850,
    image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop&q=60',
    progress: 35,
    category: '材质与渲染'
  },
  {
    id: 3,
    title: '几何节点：从零开始构建程序化城市',
    instructor: 'Sarah J.',
    level: '专家',
    duration: '15 小时',
    rating: 5.0,
    students: 420,
    image: 'https://images.unsplash.com/photo-1633167606207-d840b5070fc2?w=800&auto=format&fit=crop&q=60',
    progress: 0,
    category: '几何节点'
  },
  {
    id: 4,
    title: '影视级场景合成与后期调色',
    instructor: '张导',
    level: '进阶',
    duration: '8 小时',
    rating: 4.7,
    students: 630,
    image: 'https://images.unsplash.com/photo-1550684848-86a5d8727436?w=800&auto=format&fit=crop&q=60',
    progress: 10,
    category: '行业实战'
  }
]

const filteredCourses = computed(() => {
  return courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          course.instructor.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategory = activeCategory.value === '全部课程' || course.category === activeCategory.value
    return matchesSearch && matchesCategory
  })
})

const handleCourseClick = (course: any) => {
  router.push('/academy-player')
}
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
            placeholder="搜索课程名称或讲师..." 
            class="pl-10 pr-4 py-2 bg-slate-100 dark:bg-white/5 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 w-72 transition-all"
            style="color: var(--text-primary)"
          />
        </div>
        <button class="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium hover:opacity-80 transition-all" style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)">
          <Filter class="w-4 h-4" /> 筛选器
        </button>
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
        
        <!-- Continue Learning Section -->
        <section v-if="activeCategory === '全部课程' && !searchQuery">
          <h2 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: var(--text-primary)">
            最近在学 <span class="text-xs font-normal" style="color: var(--text-muted)">最近活跃课程</span>
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div v-for="course in courses.filter(c => c.progress > 0 && c.progress < 100)" :key="course.id" 
                 class="p-5 rounded-2xl border shadow-sm flex gap-5 hover:shadow-md transition-shadow cursor-pointer"
                 style="background-color: var(--bg-card); border-color: var(--border-base)">
              <div class="w-32 h-20 rounded-xl overflow-hidden shrink-0">
                <img :src="course.image" class="w-full h-full object-cover" />
              </div>
              <div class="flex-1 flex flex-col justify-between py-1">
                <div>
                  <h3 class="text-sm font-bold mb-1" style="color: var(--text-primary)">{{ course.title }}</h3>
                  <div class="flex items-center gap-3 text-[11px]" style="color: var(--text-secondary)">
                    <span class="flex items-center gap-1"><Clock class="w-3 h-3" /> 剩余 {{ Math.round(15 * (1 - course.progress/100)) }} 小时</span>
                    <span class="flex items-center gap-1"><BookOpen class="w-3 h-3" /> {{ Math.round(24 * (course.progress/100)) }}/24 课时</span>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-[10px] font-bold text-accent">
                    <span>学习进度 {{ course.progress }}%</span>
                  </div>
                  <div class="h-1.5 bg-accent-subtle rounded-full overflow-hidden">
                    <div class="h-full bg-accent rounded-full transition-all duration-1000" :style="{ width: course.progress + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Course Grid -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold" style="color: var(--text-primary)">{{ activeCategory === '全部课程' ? '推荐课程' : activeCategory }}</h2>
            <div class="flex items-center gap-2">
              <span class="text-xs" style="color: var(--text-muted)">排序方式:</span>
              <select class="text-xs font-bold bg-transparent border-none focus:ring-0 cursor-pointer" style="color: var(--text-secondary)">
                <option>最新发布</option>
                <option>最高评分</option>
                <option>最多学习</option>
              </select>
            </div>
          </div>

          <div v-if="filteredCourses.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div v-for="course in filteredCourses" :key="course.id" 
                 class="group rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                 style="background-color: var(--bg-card); border-color: var(--border-base)">
              <!-- Course Cover -->
              <div class="aspect-video relative overflow-hidden bg-slate-100 dark:bg-white/5">
                <img :src="course.image" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <PlayCircle class="w-12 h-12 text-white drop-shadow-lg" />
                </div>
                <div class="absolute top-3 left-3 px-2 py-1 rounded text-[10px] font-bold shadow-sm" style="background-color: var(--bg-card); color: var(--text-primary)">
                  {{ course.level }}
                </div>
              </div>

              <!-- Course Info -->
              <div class="p-5">
                <p class="text-[10px] font-bold text-accent uppercase mb-2 tracking-wider">{{ course.category }}</p>
                <h3 class="text-sm font-bold mb-3 line-clamp-2 min-h-[40px] leading-snug group-hover:text-accent transition-colors" style="color: var(--text-primary)">
                  {{ course.title }}
                </h3>
                
                <div class="flex items-center gap-2 mb-4">
                  <img :src="`https://i.pravatar.cc/150?u=${course.instructor}`" class="w-5 h-5 rounded-full" />
                  <span class="text-[11px] font-medium" style="color: var(--text-secondary)">{{ course.instructor }}</span>
                </div>

                <div class="flex items-center justify-between pt-4 border-t transition-colors duration-300" style="border-color: var(--border-base)">
                  <div class="flex items-center gap-3 text-[10px] font-bold" style="color: var(--text-muted)">
                    <span class="flex items-center gap-1"><Clock class="w-3 h-3" /> {{ course.duration }}</span>
                    <span class="flex items-center gap-1"><Star class="w-3 h-3 text-amber-400 fill-amber-400" /> {{ course.rating }}</span>
                  </div>
                  <div class="flex items-center gap-1 text-[10px] font-bold" style="color: var(--text-muted)">
                    <Users class="w-3 h-3" /> {{ course.students }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="h-64 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed" style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-muted)">
            <GraduationCap class="w-12 h-12 mb-4 opacity-20" />
            <p class="text-sm">没有找到相关的课程</p>
            <button @click="searchQuery = ''; activeCategory = '全部课程'" class="mt-4 text-xs text-accent font-bold hover:underline">
              查看所有课程
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

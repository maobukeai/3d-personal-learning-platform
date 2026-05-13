<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  FolderTree,
  X,
  Layers,
  GraduationCap,
  GripVertical,
  Type,
  Hash,
  Smile,
  Sparkles,
  Settings,
  Box
} from 'lucide-vue-next'
import api from '@/utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'

interface Category {
  id: string
  name: string
  icon?: string
  order: number
  _count?: {
    assets?: number
    courses?: number
  }
}

const activeTab = ref<'assets' | 'courses' | 'materials' | 'showcases'>('assets')
const isLoading = ref(false)
const searchQuery = ref('')

const assetCategories = ref<Category[]>([])
const courseCategories = ref<Category[]>([])
const materialCategories = ref<string[]>([])
const showcaseCategories = ref<string[]>([])

const showModal = ref(false)
const currentCategory = ref<Category | string | null>(null)
const categoryForm = ref({
  name: '',
  icon: '',
  order: 0
})

const fetchAssetCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/asset-categories')
    assetCategories.value = data
  } catch (error) {
    console.error('Fetch asset categories error:', error)
  }
}

const fetchCourseCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/course-categories')
    courseCategories.value = data
  } catch (error) {
    console.error('Fetch course categories error:', error)
  }
}

const fetchSettingsCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/settings')
    
    // Handle both array and object responses from different versions of the API
    const getVal = (key: string) => {
      if (Array.isArray(data)) {
        const s = data.find((item: any) => item.key === key)
        return s ? s.value : '[]'
      }
      return data[key] || '[]'
    }

    try {
      const matVal = getVal('MATERIAL_CATEGORIES')
      materialCategories.value = typeof matVal === 'string' ? JSON.parse(matVal) : matVal
    } catch { materialCategories.value = [] }

    try {
      const showVal = getVal('SHOWCASE_CATEGORIES')
      showcaseCategories.value = typeof showVal === 'string' ? JSON.parse(showVal) : showVal
    } catch { showcaseCategories.value = [] }
    
  } catch (error) {
    console.error('Fetch settings categories error:', error)
  }
}

const fetchData = async () => {
  isLoading.value = true
  await Promise.all([fetchAssetCategories(), fetchCourseCategories(), fetchSettingsCategories()])
  isLoading.value = false
}

const filteredCategories = computed(() => {
  if (activeTab.value === 'assets') {
    return searchQuery.value 
      ? assetCategories.value.filter(c => c.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
      : assetCategories.value
  } else if (activeTab.value === 'courses') {
    return searchQuery.value
      ? courseCategories.value.filter(c => c.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
      : courseCategories.value
  } else if (activeTab.value === 'materials') {
    return searchQuery.value
      ? materialCategories.value.filter(c => c.toLowerCase().includes(searchQuery.value.toLowerCase()))
      : materialCategories.value
  } else {
    return searchQuery.value
      ? showcaseCategories.value.filter(c => c.toLowerCase().includes(searchQuery.value.toLowerCase()))
      : showcaseCategories.value
  }
})

const openModal = (category: any = null) => {
  currentCategory.value = category
  if (activeTab.value === 'assets' || activeTab.value === 'courses') {
    if (category) {
      categoryForm.value = {
        name: category.name,
        icon: category.icon || '',
        order: category.order
      }
    } else {
      const list = activeTab.value === 'assets' ? assetCategories.value : courseCategories.value
      categoryForm.value = {
        name: '',
        icon: '',
        order: list.length > 0 ? Math.max(...list.map(c => c.order)) + 1 : 1
      }
    }
  } else {
    // For materials and showcases (string array)
    categoryForm.value = {
      name: category || '',
      icon: '',
      order: 0
    }
  }
  showModal.value = true
}

const handleSaveCategory = async () => {
  if (!categoryForm.value.name) {
    return ElMessage.warning('请输入分类名称')
  }

  if (activeTab.value === 'assets' || activeTab.value === 'courses') {
    const endpoint = activeTab.value === 'assets' ? '/api/admin/asset-categories' : '/api/admin/course-categories'
    try {
      if (currentCategory.value) {
        await api.put(`${endpoint}/` + (currentCategory.value as Category).id, categoryForm.value)
        ElMessage.success('分类更新成功')
      } else {
        await api.post(endpoint, categoryForm.value)
        ElMessage.success('分类创建成功')
      }
      activeTab.value === 'assets' ? fetchAssetCategories() : fetchCourseCategories()
      showModal.value = false
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || '保存失败')
    }
  } else {
    // Update System Settings
    const key = activeTab.value === 'materials' ? 'MATERIAL_CATEGORIES' : 'SHOWCASE_CATEGORIES'
    const list = activeTab.value === 'materials' ? [...materialCategories.value] : [...showcaseCategories.value]
    
    if (currentCategory.value) {
      const idx = list.indexOf(currentCategory.value as string)
      if (idx > -1) list[idx] = categoryForm.value.name
    } else {
      if (list.includes(categoryForm.value.name)) {
        return ElMessage.warning('分类已存在')
      }
      list.push(categoryForm.value.name)
    }

    try {
      await api.post('/api/admin/settings', {
        settings: [{ key, value: JSON.stringify(list) }]
      })
      ElMessage.success('系统设置更新成功')
      fetchSettingsCategories()
      showModal.value = false
    } catch (error: any) {
      ElMessage.error('保存失败')
    }
  }
}

const handleDeleteCategory = async (category: any) => {
  if (activeTab.value === 'assets' || activeTab.value === 'courses') {
    const count = activeTab.value === 'assets' ? category._count?.assets : category._count?.courses
    if (count && count > 0) {
      return ElMessage.error(`该分类下仍有 ${count} 个${activeTab.value === 'assets' ? '资产' : '课程'}，无法删除`)
    }

    try {
      await ElMessageBox.confirm(
        `确定要删除分类 "${category.name}" 吗？`,
        '警告',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )

      const endpoint = activeTab.value === 'assets' ? '/api/admin/asset-categories' : '/api/admin/course-categories'
      await api.delete(`${endpoint}/${category.id}`)
      ElMessage.success('分类已删除')
      activeTab.value === 'assets' ? fetchAssetCategories() : fetchCourseCategories()
    } catch (error) { /* cancel */ }
  } else {
    // Delete from System Settings
    try {
      await ElMessageBox.confirm(
        `确定要从系统中移除分类 "${category}" 吗？`,
        '警告',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )

      const key = activeTab.value === 'materials' ? 'MATERIAL_CATEGORIES' : 'SHOWCASE_CATEGORIES'
      const list = activeTab.value === 'materials' ? materialCategories.value : showcaseCategories.value
      const newList = list.filter(c => c !== category)

      await api.post('/api/admin/settings', {
        settings: [{ key, value: JSON.stringify(newList) }]
      })
      ElMessage.success('分类已移除')
      fetchSettingsCategories()
    } catch (error) { /* cancel */ }
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div>
        <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">平台分类管理</h1>
        <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">集中管理系统中的资产、课程、材质及作品分类</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1 p-1 rounded-xl transition-colors duration-300" style="background-color: var(--bg-app)">
          <button @click="activeTab = 'assets'"
                  class="px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2"
                  :class="activeTab === 'assets' ? 'bg-white dark:bg-white/10 shadow-sm text-accent' : 'text-slate-400 hover:text-slate-600'">
            <Box class="w-3.5 h-3.5" />
            资产库
          </button>
          <button @click="activeTab = 'courses'"
                  class="px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2"
                  :class="activeTab === 'courses' ? 'bg-white dark:bg-white/10 shadow-sm text-accent' : 'text-slate-400 hover:text-slate-600'">
            <GraduationCap class="w-3.5 h-3.5" />
            课程
          </button>
          <button @click="activeTab = 'materials'"
                  class="px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2"
                  :class="activeTab === 'materials' ? 'bg-white dark:bg-white/10 shadow-sm text-accent' : 'text-slate-400 hover:text-slate-600'">
            <Layers class="w-3.5 h-3.5" />
            材质
          </button>
          <button @click="activeTab = 'showcases'"
                  class="px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2"
                  :class="activeTab === 'showcases' ? 'bg-white dark:bg-white/10 shadow-sm text-accent' : 'text-slate-400 hover:text-slate-600'">
            <Sparkles class="w-3.5 h-3.5" />
            作品展示
          </button>
        </div>

        <div class="h-8 w-[1px] mx-2 transition-colors duration-300" style="background-color: var(--border-base)"></div>

        <button @click="openModal()" class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm transition-all shadow-lg shadow-accent/20">
          <Plus class="w-4 h-4" />
          新建分类
        </button>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="px-8 py-4 border-b transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-4 max-w-5xl">
        <div class="relative flex-1">
          <Search class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="searchQuery" type="text" :placeholder="`搜索分类...`"
                 class="w-full pl-12 pr-4 py-2.5 rounded-2xl border transition-all outline-none text-sm"
                 style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
          <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24">
        <div class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else class="max-w-5xl mx-auto">
        <div v-if="filteredCategories.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="(cat, index) in filteredCategories" :key="typeof cat === 'string' ? cat : cat.id"
               class="group rounded-3xl border p-6 transition-all hover:shadow-lg hover:border-accent/30"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="flex items-start justify-between mb-4">
              <div class="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                <span v-if="typeof cat !== 'string' && cat.icon" class="text-xl">{{ cat.icon }}</span>
                <FolderTree v-else class="w-6 h-6" />
              </div>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click="openModal(cat)" class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-accent transition-colors">
                  <Edit2 class="w-4 h-4" />
                </button>
                <button @click="handleDeleteCategory(cat)" class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div class="space-y-1">
              <h3 class="text-lg font-black tracking-tight" style="color: var(--text-primary)">{{ typeof cat === 'string' ? cat : cat.name }}</h3>
              <div class="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <template v-if="typeof cat !== 'string'">
                  <span class="flex items-center gap-1"><GripVertical class="w-3 h-3" /> 排序: {{ cat.order }}</span>
                  <span>•</span>
                  <span>{{ activeTab === 'assets' ? (cat._count?.assets || 0) + ' 个资产' : (cat._count?.courses || 0) + ' 门课程' }}</span>
                </template>
                <template v-else>
                  <span>系统预设分类</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="py-24 text-center">
          <div class="w-20 h-20 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mx-auto mb-6">
            <FolderTree class="w-10 h-10 text-slate-200" />
          </div>
          <h3 class="text-lg font-bold mb-2" style="color: var(--text-primary)">未找到分类</h3>
          <p class="text-sm text-slate-400">试试其他关键词，或者点击右上角新建一个分类</p>
        </div>
      </div>
    </div>

    <!-- Category Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-3xl p-8 shadow-2xl transition-colors duration-300" style="background-color: var(--bg-card)">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">{{ currentCategory ? '编辑分类' : '新建分类' }}</h3>
            <p class="text-xs text-slate-400 mt-1">管理系统全局分类映射</p>
          </div>
          <button @click="showModal = false" class="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400">
            <X class="w-6 h-6" />
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">分类名称</label>
            <div class="relative">
              <Type class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input v-model="categoryForm.name" type="text" placeholder="输入分类名称..."
                     class="w-full pl-12 pr-4 py-3 rounded-2xl border transition-all outline-none"
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
            </div>
          </div>

          <div v-if="activeTab === 'assets'">
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">图标 (Emoji)</label>
            <div class="relative">
              <Smile class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input v-model="categoryForm.icon" type="text" placeholder="输入一个 Emoji 图标..."
                     class="w-full pl-12 pr-4 py-3 rounded-2xl border transition-all outline-none"
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
            </div>
          </div>

          <div v-if="activeTab === 'assets' || activeTab === 'courses'">
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">显示权重 (越小越靠前)</label>
            <div class="relative">
              <Hash class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input v-model="categoryForm.order" type="number"
                     class="w-full pl-12 pr-4 py-3 rounded-2xl border transition-all outline-none font-bold"
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4 mt-10">
          <button @click="showModal = false" class="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">取消</button>
          <button @click="handleSaveCategory" class="flex-1 py-4 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98]">
            {{ currentCategory ? '保存修改' : '立即创建' }}
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
</style>

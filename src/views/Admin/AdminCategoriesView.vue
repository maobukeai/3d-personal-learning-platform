<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, onMounted, computed } from 'vue';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  FolderTree,
  X,
  Layers,
  GraduationCap,
  Type,
  Hash,
  Smile,
  Sparkles,
  Box,
  Users,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import AdminOpsPanel from './components/AdminOpsPanel.vue';
import { fetchManagementInsights } from './adminManagementInsights';

interface Category {
  id: string;
  name: string;
  icon?: string;
  order: number;
  _count?: {
    assets?: number;
    courses?: number;
  };
}

interface SettingItem {
  key: string;
  value: string | string[];
}

const activeTab = ref<'assets' | 'courses' | 'materials' | 'plugins' | 'showcases' | 'teams'>(
  'assets',
);
const isLoading = ref(false);
const searchQuery = ref('');

const assetCategories = ref<Category[]>([]);
const courseCategories = ref<Category[]>([]);
const materialCategories = ref<string[]>([]);
const pluginCategories = ref<string[]>([]);
const showcaseCategories = ref<string[]>([]);
const teamCategories = ref<string[]>([]);

const showModal = ref(false);
const currentCategory = ref<Category | string | null>(null);
const categoryForm = ref({
  name: '',
  icon: '',
  order: 0,
});

const fetchAssetCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/asset-categories');
    assetCategories.value = data;
  } catch (error) {
    console.error('Fetch asset categories error:', error);
  }
};

const fetchCourseCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/course-categories');
    courseCategories.value = data;
  } catch (error) {
    console.error('Fetch course categories error:', error);
  }
};

const fetchSettingsCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/settings');

    // Handle both array and object responses from different versions of the API
    const getVal = (key: string): string | string[] => {
      if (Array.isArray(data)) {
        const settings = data as SettingItem[];
        const s = settings.find((item) => item.key === key);
        return s ? s.value : '[]';
      }
      const settings = data as Record<string, string | string[] | undefined>;
      return settings[key] || '[]';
    };

    try {
      const matVal = getVal('MATERIAL_CATEGORIES');
      materialCategories.value = typeof matVal === 'string' ? JSON.parse(matVal) : matVal;
    } catch {
      materialCategories.value = [];
    }

    try {
      const showVal = getVal('SHOWCASE_CATEGORIES');
      showcaseCategories.value = typeof showVal === 'string' ? JSON.parse(showVal) : showVal;
    } catch {
      showcaseCategories.value = [];
    }

    try {
      const teamVal = getVal('TEAM_CATEGORIES');
      teamCategories.value = typeof teamVal === 'string' ? JSON.parse(teamVal) : teamVal;
    } catch {
      teamCategories.value = [];
    }

    try {
      const pluginVal = getVal('PLUGIN_CATEGORIES');
      pluginCategories.value = typeof pluginVal === 'string' ? JSON.parse(pluginVal) : pluginVal;
    } catch {
      pluginCategories.value = [];
    }
  } catch (error) {
    console.error('Fetch settings categories error:', error);
  }
};

const fetchData = async () => {
  isLoading.value = true;
  await Promise.all([fetchAssetCategories(), fetchCourseCategories(), fetchSettingsCategories()]);
  fetchManagementInsights(true);
  isLoading.value = false;
};

const filteredCategories = computed(() => {
  if (activeTab.value === 'assets') {
    return searchQuery.value
      ? assetCategories.value.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
        )
      : assetCategories.value;
  } else if (activeTab.value === 'courses') {
    return searchQuery.value
      ? courseCategories.value.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
        )
      : courseCategories.value;
  } else if (activeTab.value === 'materials') {
    return searchQuery.value
      ? materialCategories.value.filter((c) =>
          c.toLowerCase().includes(searchQuery.value.toLowerCase()),
        )
      : materialCategories.value;
  } else if (activeTab.value === 'showcases') {
    return searchQuery.value
      ? showcaseCategories.value.filter((c) =>
          c.toLowerCase().includes(searchQuery.value.toLowerCase()),
        )
      : showcaseCategories.value;
  } else if (activeTab.value === 'plugins') {
    return searchQuery.value
      ? pluginCategories.value.filter((c) =>
          c.toLowerCase().includes(searchQuery.value.toLowerCase()),
        )
      : pluginCategories.value;
  } else {
    return searchQuery.value
      ? teamCategories.value.filter((c) =>
          c.toLowerCase().includes(searchQuery.value.toLowerCase()),
        )
      : teamCategories.value;
  }
});

const openModal = (category: Category | string | null = null) => {
  currentCategory.value = category;
  if (activeTab.value === 'assets' || activeTab.value === 'courses') {
    if (category) {
      const typedCategory = category as Category;
      categoryForm.value = {
        name: typedCategory.name,
        icon: typedCategory.icon || '',
        order: typedCategory.order,
      };
    } else {
      const list = activeTab.value === 'assets' ? assetCategories.value : courseCategories.value;
      categoryForm.value = {
        name: '',
        icon: '',
        order: list.length > 0 ? Math.max(...list.map((c) => c.order)) + 1 : 1,
      };
    }
  } else {
    // For materials and showcases (string array)
    categoryForm.value = {
      name: typeof category === 'string' ? category : '',
      icon: '',
      order: 0,
    };
  }
  showModal.value = true;
};

const handleSaveCategory = async () => {
  if (!categoryForm.value.name) {
    return ElMessage.warning('请输入分类名称');
  }

  if (activeTab.value === 'assets' || activeTab.value === 'courses') {
    const endpoint =
      activeTab.value === 'assets' ? '/api/admin/asset-categories' : '/api/admin/course-categories';
    try {
      if (currentCategory.value) {
        await api.put(`${endpoint}/` + (currentCategory.value as Category).id, categoryForm.value);
        ElMessage.success('分类更新成功');
      } else {
        await api.post(endpoint, categoryForm.value);
        ElMessage.success('分类创建成功');
      }
      if (activeTab.value === 'assets') {
        fetchAssetCategories();
      } else {
        fetchCourseCategories();
      }
      showModal.value = false;
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, '保存失败'));
    }
  } else {
    // Update System Settings
    const key =
      activeTab.value === 'materials'
        ? 'MATERIAL_CATEGORIES'
        : activeTab.value === 'plugins'
          ? 'PLUGIN_CATEGORIES'
          : activeTab.value === 'showcases'
            ? 'SHOWCASE_CATEGORIES'
            : 'TEAM_CATEGORIES';
    const list =
      activeTab.value === 'materials'
        ? [...materialCategories.value]
        : activeTab.value === 'plugins'
          ? [...pluginCategories.value]
          : activeTab.value === 'showcases'
            ? [...showcaseCategories.value]
            : [...teamCategories.value];

    if (currentCategory.value) {
      const idx = list.indexOf(currentCategory.value as string);
      if (idx > -1) list[idx] = categoryForm.value.name;
    } else {
      if (list.includes(categoryForm.value.name)) {
        return ElMessage.warning('分类已存在');
      }
      list.push(categoryForm.value.name);
    }

    try {
      await api.post('/api/admin/settings', {
        settings: [{ key, value: JSON.stringify(list) }],
      });
      ElMessage.success('系统设置更新成功');
      fetchSettingsCategories();
      showModal.value = false;
    } catch (_error) {
      ElMessage.error('保存失败');
    }
  }
};

const handleDeleteCategory = async (category: Category | string) => {
  if (activeTab.value === 'assets' || activeTab.value === 'courses') {
    const typedCategory = category as Category;
    const count =
      activeTab.value === 'assets' ? typedCategory._count?.assets : typedCategory._count?.courses;
    if (count && count > 0) {
      return ElMessage.error(
        `该分类下仍有 ${count} 个${activeTab.value === 'assets' ? '资产' : '课程'}，无法删除`,
      );
    }

    try {
      await ElMessageBox.confirm(`确定要删除分类 "${typedCategory.name}" 吗？`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      });

      const endpoint =
        activeTab.value === 'assets'
          ? '/api/admin/asset-categories'
          : '/api/admin/course-categories';
      await api.delete(`${endpoint}/${typedCategory.id}`);
      ElMessage.success('分类已删除');
      if (activeTab.value === 'assets') {
        fetchAssetCategories();
      } else {
        fetchCourseCategories();
      }
    } catch (_error) {
      /* cancel */
    }
  } else {
    // Delete from System Settings
    try {
      await ElMessageBox.confirm(`确定要从系统中移除分类 "${category}" 吗？`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      });

      const key =
        activeTab.value === 'materials'
          ? 'MATERIAL_CATEGORIES'
          : activeTab.value === 'plugins'
            ? 'PLUGIN_CATEGORIES'
            : activeTab.value === 'showcases'
              ? 'SHOWCASE_CATEGORIES'
              : 'TEAM_CATEGORIES';
      const list =
        activeTab.value === 'materials'
          ? materialCategories.value
          : activeTab.value === 'plugins'
            ? pluginCategories.value
            : activeTab.value === 'showcases'
              ? showcaseCategories.value
              : teamCategories.value;
      const newList = list.filter((c) => c !== category);

      await api.post('/api/admin/settings', {
        settings: [{ key, value: JSON.stringify(newList) }],
      });
      ElMessage.success('分类已移除');
      fetchSettingsCategories();
    } catch (_error) {
      /* cancel */
    }
  }
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Header (超紧凑双行版) -->
    <div
      class="relative shrink-0 border-b overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- 极光背景装饰 -->
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1 rounded-xl bg-indigo-500/10 text-indigo-500 shadow-sm border border-indigo-500/20"
          >
            <FolderTree class="w-4 h-4" />
          </span>
          <h1 class="text-sm font-black tracking-tight" style="color: var(--text-primary)">
            平台分类管理
          </h1>
        </div>

        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-[11px] transition-all shadow-sm cursor-pointer whitespace-nowrap"
          @click="openModal()"
        >
          <Plus class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">新建分类</span>
        </button>
      </div>

      <!-- Row 2: 条件筛选与快速搜索 -->
      <div
        class="px-4 sm:px-8 py-2 flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
      >
        <!-- 分类选项卡 & 统计 Pills -->
        <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
          <!-- 极品分段选项卡 -->
          <div
            class="flex flex-nowrap items-center bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg gap-0.5 shadow-inner shrink-0"
          >
            <button
              type="button"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[8px] xs:text-[9px] sm:text-[11px] font-bold transition-all flex items-center gap-0.5 sm:gap-1.5 cursor-pointer shrink-0"
              :class="
                activeTab === 'assets'
                  ? 'bg-white dark:bg-white/10 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              "
              @click="activeTab = 'assets'"
            >
              <Box class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              <span>资产库</span>
              <span class="opacity-60 text-[8px] xs:text-[9px]"
                >({{ assetCategories.length }})</span
              >
            </button>
            <button
              type="button"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[8px] xs:text-[9px] sm:text-[11px] font-bold transition-all flex items-center gap-0.5 sm:gap-1.5 cursor-pointer shrink-0"
              :class="
                activeTab === 'courses'
                  ? 'bg-white dark:bg-white/10 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              "
              @click="activeTab = 'courses'"
            >
              <GraduationCap class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              <span>课程</span>
              <span class="opacity-60 text-[8px] xs:text-[9px]"
                >({{ courseCategories.length }})</span
              >
            </button>
            <button
              type="button"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[8px] xs:text-[9px] sm:text-[11px] font-bold transition-all flex items-center gap-0.5 sm:gap-1.5 cursor-pointer shrink-0"
              :class="
                activeTab === 'materials'
                  ? 'bg-white dark:bg-white/10 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              "
              @click="activeTab = 'materials'"
            >
              <Layers class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              <span>材质</span>
              <span class="opacity-60 text-[8px] xs:text-[9px]"
                >({{ materialCategories.length }})</span
              >
            </button>
            <button
              type="button"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[8px] xs:text-[9px] sm:text-[11px] font-bold transition-all flex items-center gap-0.5 sm:gap-1.5 cursor-pointer shrink-0"
              :class="
                activeTab === 'plugins'
                  ? 'bg-white dark:bg-white/10 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              "
              @click="activeTab = 'plugins'"
            >
              <Puzzle class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              <span>插件</span>
              <span class="opacity-60 text-[8px] xs:text-[9px]"
                >({{ pluginCategories.length }})</span
              >
            </button>
            <button
              type="button"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[8px] xs:text-[9px] sm:text-[11px] font-bold transition-all flex items-center gap-0.5 sm:gap-1.5 cursor-pointer shrink-0"
              :class="
                activeTab === 'showcases'
                  ? 'bg-white dark:bg-white/10 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              "
              @click="activeTab = 'showcases'"
            >
              <Sparkles class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              <span>作品展示</span>
              <span class="opacity-60 text-[8px] xs:text-[9px]"
                >({{ showcaseCategories.length }})</span
              >
            </button>
            <button
              type="button"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[8px] xs:text-[9px] sm:text-[11px] font-bold transition-all flex items-center gap-0.5 sm:gap-1.5 cursor-pointer shrink-0"
              :class="
                activeTab === 'teams'
                  ? 'bg-white dark:bg-white/10 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              "
              @click="activeTab = 'teams'"
            >
              <Users class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              <span>团队分类</span>
              <span class="opacity-60 text-[8px] xs:text-[9px]">({{ teamCategories.length }})</span>
            </button>
          </div>

          <div class="w-[1px] h-3 bg-slate-200 dark:bg-slate-800 shrink-0 mx-1 sm:mx-3"></div>

          <!-- 统计 Pills -->
          <span
            class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-500 text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 shrink-0"
          >
            <FolderTree class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            <span>当前类目数</span>
            <span class="opacity-60">({{ filteredCategories.length }})</span>
          </span>
        </div>

        <!-- 检索工具 -->
        <div
          class="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0"
        >
          <div class="relative flex-1 md:flex-none md:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索当前分类..."
              class="w-full pl-9 pr-7 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              @click="searchQuery = ''"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <AdminOpsPanel scope="categories" />

      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24">
        <div
          class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"
        ></div>
      </div>

      <div v-else class="max-w-none">
        <template v-if="filteredCategories.length > 0">
          <!-- Desktop Table View -->
          <div
            class="hidden md:block rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] overflow-hidden overflow-x-auto scrollbar-hide"
          >
            <table class="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr
                  class="border-b bg-slate-50/50 dark:bg-slate-800/50"
                  style="border-color: var(--border-base)"
                >
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    图标
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    分类名称
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    排序权重
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    关联统计
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right"
                  >
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="cat in filteredCategories"
                  :key="typeof cat === 'string' ? cat : cat.id"
                  class="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group"
                  style="border-color: var(--border-base)"
                >
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4">
                    <div
                      class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent"
                    >
                      <span v-if="typeof cat !== 'string' && cat.icon" class="text-lg">{{
                        cat.icon
                      }}</span>
                      <FolderTree v-else class="w-5 h-5" />
                    </div>
                  </td>
                  <td
                    class="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-sm"
                    style="color: var(--text-primary)"
                  >
                    {{ typeof cat === 'string' ? cat : cat.name }}
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs font-medium text-slate-500">
                    <template v-if="typeof cat !== 'string'">
                      {{ cat.order }}
                    </template>
                    <template v-else> - </template>
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs font-semibold text-slate-400">
                    <template v-if="typeof cat !== 'string'">
                      {{
                        activeTab === 'assets'
                          ? (cat._count?.assets || 0) + ' 个资产'
                          : (cat._count?.courses || 0) + ' 门课程'
                      }}
                    </template>
                    <template v-else> 系统预设分类 </template>
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-right">
                    <div
                      class="flex items-center justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    >
                      <button
                        type="button"
                        class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-accent transition-colors"
                        @click="openModal(cat)"
                      >
                        <Edit2 class="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors"
                        @click="handleDeleteCategory(cat)"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Card View -->
          <div class="md:hidden space-y-3">
            <div
              v-for="cat in filteredCategories"
              :key="typeof cat === 'string' ? cat : cat.id"
              class="p-4 rounded-2xl border bg-[var(--bg-card)] transition-all flex items-center justify-between shadow-sm"
              style="border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0"
                >
                  <span v-if="typeof cat !== 'string' && cat.icon" class="text-lg">{{
                    cat.icon
                  }}</span>
                  <FolderTree v-else class="w-5 h-5" />
                </div>
                <div class="min-w-0">
                  <h4 class="font-bold text-sm text-[var(--text-primary)] truncate">
                    {{ typeof cat === 'string' ? cat : cat.name }}
                  </h4>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-[10px] text-slate-400 shrink-0">
                      权重: {{ typeof cat !== 'string' ? cat.order : '-' }}
                    </span>
                    <span class="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                    <span class="text-[10px] text-slate-400 truncate">
                      {{
                        typeof cat !== 'string'
                          ? activeTab === 'assets'
                            ? (cat._count?.assets || 0) + ' 个资产'
                            : (cat._count?.courses || 0) + ' 门课程'
                          : '系统预设'
                      }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  class="p-2 rounded-lg text-slate-400 hover:text-accent transition-colors"
                  @click="openModal(cat)"
                >
                  <Edit2 class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  class="p-2 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                  @click="handleDeleteCategory(cat)"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Empty State -->
        <div v-else class="py-24 text-center">
          <div
            class="w-20 h-20 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mx-auto mb-6"
          >
            <FolderTree class="w-10 h-10 text-slate-200" />
          </div>
          <h3 class="text-lg font-bold mb-2" style="color: var(--text-primary)">未找到分类</h3>
          <p class="text-sm text-slate-400">试试其他关键词，或者点击右上角新建一个分类</p>
        </div>
      </div>
    </div>

    <!-- Category Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-md rounded-3xl p-5 sm:p-8 shadow-2xl transition-colors duration-300"
        style="background-color: var(--bg-card)"
      >
        <div class="flex items-center justify-between mb-8">
          <div>
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">
              {{ currentCategory ? '编辑分类' : '新建分类' }}
            </h3>
            <p class="text-xs text-slate-400 mt-1">管理系统全局分类映射</p>
          </div>
          <button
            type="button"
            class="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400"
            @click="showModal = false"
          >
            <X class="w-6 h-6" />
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >分类名称</label
            >
            <div class="relative">
              <Type class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="categoryForm.name"
                type="text"
                placeholder="输入分类名称..."
                class="w-full pl-12 pr-4 py-3 rounded-2xl border transition-all outline-none"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
          </div>

          <div v-if="activeTab === 'assets'">
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >图标 (Emoji)</label
            >
            <div class="relative">
              <Smile class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="categoryForm.icon"
                type="text"
                placeholder="输入一个 Emoji 图标..."
                class="w-full pl-12 pr-4 py-3 rounded-2xl border transition-all outline-none"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
          </div>

          <div v-if="activeTab === 'assets' || activeTab === 'courses'">
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
              >显示权重 (越小越靠前)</label
            >
            <div class="relative">
              <Hash class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="categoryForm.order"
                type="number"
                class="w-full pl-12 pr-4 py-3 rounded-2xl border transition-all outline-none font-bold"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4 mt-10">
          <button
            type="button"
            class="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            @click="showModal = false"
          >
            取消
          </button>
          <button
            type="button"
            class="flex-1 py-4 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98]"
            @click="handleSaveCategory"
          >
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

<script setup lang="ts">
import { getApiErrorMessage, logError } from '@/utils/error';
import { ref, onMounted, computed } from 'vue';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  FolderTree,
  Layers,
  GraduationCap,
  Type,
  Hash,
  Smile,
  Sparkles,
  Box,
  Users,
  RefreshCw,
  Puzzle,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchManagementInsights } from './adminManagementInsights';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import { useSystemStore } from '@/stores/system';

const systemStore = useSystemStore();

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
    logError(error, { operation: 'admin.fetchAssetCategories', component: 'AdminCategoriesView' });
  }
};

const fetchCourseCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/course-categories');
    courseCategories.value = data;
  } catch (error) {
    logError(error, { operation: 'admin.fetchCourseCategories', component: 'AdminCategoriesView' });
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
    logError(error, {
      operation: 'admin.fetchSettingsCategories',
      component: 'AdminCategoriesView',
    });
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

const getBadgeVariant = (label: string) => {
  if (label === '正常' || label === '稳定') return 'success';
  if (label === '关注') return 'warning';
  if (label === '高压') return 'danger';
  return 'primary';
};

const categoryTabOptions = computed(() => [
  { label: `资产库 (${assetCategories.value.length})`, value: 'assets', icon: Box },
  { label: `课程 (${courseCategories.value.length})`, value: 'courses', icon: GraduationCap },
  { label: `材质 (${materialCategories.value.length})`, value: 'materials', icon: Layers },
  { label: `插件 (${pluginCategories.value.length})`, value: 'plugins', icon: Puzzle },
  { label: `作品展示 (${showcaseCategories.value.length})`, value: 'showcases', icon: Sparkles },
  { label: `团队分类 (${teamCategories.value.length})`, value: 'teams', icon: Users },
]);

const consolidatedCards = computed(() => {
  const assets = assetCategories.value.length;
  const courses = courseCategories.value.length;
  const others =
    materialCategories.value.length +
    pluginCategories.value.length +
    showcaseCategories.value.length +
    teamCategories.value.length;
  const total = assets + courses + others;

  return [
    {
      label: '资产分类',
      value: assets,
      hint: '资产模型分类图谱',
      icon: Box,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      health: { label: '正常' },
    },
    {
      label: '课程分类',
      value: courses,
      hint: '课程教学分体系',
      icon: GraduationCap,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: '稳定' },
    },
    {
      label: '后台侧属',
      value: others,
      hint: '材质、插件、作品等分类',
      icon: Layers,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health: { label: '正常' },
    },
    {
      label: '分类总量',
      value: total,
      hint: '全站业务分类总和',
      icon: FolderTree,
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      health: { label: '稳定' },
    },
  ];
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
      await systemStore.fetchSettings();
      fetchSettingsCategories();
      showModal.value = false;
    } catch {
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
    } catch {
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
      await systemStore.fetchSettings();
      fetchSettingsCategories();
    } catch {
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
    class="admin-categories-page flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)] mobile-adaptive"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide">
      <!-- 平台分类管理 (PageHeader card variant) -->
      <PageHeader
        title="平台分类管理"
        subtitle="全局业务分类、显示权重与 Emoji 标识设计"
        variant="card"
      >
        <template #title-badge>
          <Badge variant="info" class="ml-1.5"> 当前类目数: {{ filteredCategories.length }} </Badge>
        </template>

        <template #center>
          <!-- Compact Search Box (Centered) -->
          <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
            <Search />
            <input v-model="searchQuery" type="search" placeholder="搜索当前分类..." />
          </label>
        </template>

        <!-- Action Buttons -->
        <Button variant="primary" size="sm" :icon="Plus" @click="openModal()"> 新建分类 </Button>
        <Button
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchData"
        >
          刷新
        </Button>
      </PageHeader>

      <!-- KPI Metrics Grid -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mobile-grid">
        <Card
          v-for="card in consolidatedCards"
          :key="card.label"
          hoverable
          glow
          class="group !p-2 px-2.5"
        >
          <div class="flex items-center justify-between w-full gap-3">
            <!-- Left: Icon & Info -->
            <div class="flex items-center gap-2.5 min-w-0">
              <span
                class="panel-icon border border-base rounded-lg p-1.5 transition-transform group-hover:scale-105 shrink-0"
                :class="card.color"
              >
                <component :is="card.icon" class="h-3.5 w-3.5" />
              </span>
              <div class="min-w-0">
                <p
                  class="text-[11px] font-bold text-[var(--text-secondary)] truncate leading-tight"
                >
                  {{ card.label }}
                </p>
                <p
                  class="text-[9px] text-[var(--text-secondary)] opacity-80 truncate mt-0.5 leading-none"
                  :title="card.hint"
                >
                  {{ card.hint }}
                </p>
              </div>
            </div>

            <!-- Right: Metric & Health Badge -->
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-base font-black text-[var(--text-primary)] leading-none">
                {{ card.value }}
              </span>
              <Badge :variant="getBadgeVariant(card.health.label)">
                {{ card.health.label }}
              </Badge>
            </div>
          </div>
        </Card>
      </section>

      <!-- Workspace layout: Single Column Workspace -->
      <div class="mt-3 w-full min-w-0">
        <div class="space-y-3 min-w-0">
          <!-- Workbench Toolbar / Batch Operations Card -->
          <Card padding="sm" class="workbench-toolbar-card">
            <div class="toolbar-top mobile-row">
              <div class="overflow-x-auto scrollbar-hide shrink-0 max-w-full mobile-row">
                <!-- Preset Type Tabs -->
                <Tabs v-model="activeTab" :options="categoryTabOptions" size="sm" />
              </div>
            </div>
          </Card>

          <div v-if="isLoading" class="flex flex-col items-center justify-center py-24">
            <div
              class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"
            ></div>
          </div>

          <div v-else class="max-w-none">
            <template v-if="filteredCategories.length > 0">
              <!-- Desktop Table View -->
              <Card
                padding="none"
                class="hidden md:block table-shell-card overflow-hidden overflow-x-auto scrollbar-hide"
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
                        <div class="flex items-center justify-end gap-1.5 transition-opacity">
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
              </Card>

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
      </div>
    </main>

    <!-- Category Modal -->
    <Modal :show="showModal" size="md" glass-card @close="showModal = false">
      <template #header>
        <div>
          <h3 class="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
            {{ currentCategory ? '编辑分类' : '新建分类' }}
          </h3>
          <p class="text-xs text-slate-400 mt-1">管理系统全局分类映射</p>
        </div>
      </template>

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

      <template #footer>
        <div class="flex items-center gap-3">
          <Button variant="secondary" size="md" @click="showModal = false"> 取消 </Button>
          <Button variant="primary" size="md" @click="handleSaveCategory">
            {{ currentCategory ? '保存修改' : '立即创建' }}
          </Button>
        </div>
      </template>
    </Modal>
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

.admin-categories-page {
  background: transparent !important;
}
</style>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  Plus,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Link as LinkIcon,
  RefreshCw,
} from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { ElMessage, ElMessageBox } from 'element-plus';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  route: string;
  tag: string | null;
  tagColor: string | null;
  buttonText: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const banners = ref<Banner[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const isUploading = ref(false);
const isDialogOpen = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const fileInputRef = ref<HTMLInputElement | null>(null);

// Form state
const form = ref({
  id: '',
  title: '',
  subtitle: '',
  imageUrl: '',
  route: '/discussions',
  tag: '本周挑战',
  tagColor: 'bg-accent/15 text-accent border-accent/30',
  buttonText: '立即参与',
  order: 0,
  isActive: true,
});

const defaultForm = {
  id: '',
  title: '',
  subtitle: '',
  imageUrl: '',
  route: '/discussions',
  tag: '本周挑战',
  tagColor: 'bg-accent/15 text-accent border-accent/30',
  buttonText: '立即参与',
  order: 0,
  isActive: true,
};

const fetchBanners = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/admin/banners');
    banners.value = data;
  } catch (error) {
    console.error('Failed to fetch banners:', error);
    ElMessage.error('获取轮播图列表失败');
  } finally {
    isLoading.value = false;
  }
};

const openCreateDialog = () => {
  dialogMode.value = 'create';
  form.value = { ...defaultForm };
  isDialogOpen.value = true;
};

const openEditDialog = (banner: Banner) => {
  dialogMode.value = 'edit';
  form.value = {
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle || '',
    imageUrl: banner.imageUrl,
    route: banner.route,
    tag: banner.tag || '',
    tagColor: banner.tagColor || 'bg-accent/15 text-accent border-accent/30',
    buttonText: banner.buttonText,
    order: banner.order,
    isActive: banner.isActive,
  };
  isDialogOpen.value = true;
};

const triggerFileUpload = () => {
  fileInputRef.value?.click();
};

const handleImageUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    return ElMessage.warning('图片大小不能超过 5MB');
  }

  try {
    isUploading.value = true;
    const formData = new FormData();
    formData.append('banner_image', file);
    const { data } = await api.post('/api/admin/banners/upload', formData);
    form.value.imageUrl = data.url;
    ElMessage.success('图片上传成功');
  } catch (error) {
    console.error('Upload image error:', error);
    ElMessage.error('图片上传失败');
  } finally {
    isUploading.value = false;
    target.value = '';
  }
};

const handleToggleStatus = async (banner: Banner) => {
  const nextStatus = !banner.isActive;
  try {
    await api.put(`/api/admin/banners/${banner.id}`, { isActive: nextStatus });
    banner.isActive = nextStatus;
    ElMessage.success(nextStatus ? '轮播图已启用' : '轮播图已禁用');
  } catch (error) {
    console.error('Toggle status error:', error);
    ElMessage.error('更新状态失败');
  }
};

const saveBanner = async () => {
  if (!form.value.title.trim()) {
    return ElMessage.warning('请输入轮播图标题');
  }
  if (!form.value.imageUrl.trim()) {
    return ElMessage.warning('请上传轮播背景图');
  }

  try {
    isSaving.value = true;
    if (dialogMode.value === 'create') {
      await api.post('/api/admin/banners', form.value);
      ElMessage.success('创建轮播图成功');
    } else {
      await api.put(`/api/admin/banners/${form.value.id}`, form.value);
      ElMessage.success('更新轮播图成功');
    }
    isDialogOpen.value = false;
    fetchBanners();
  } catch (error) {
    console.error('Save banner error:', error);
    ElMessage.error(dialogMode.value === 'create' ? '创建轮播图失败' : '更新轮播图失败');
  } finally {
    isSaving.value = false;
  }
};

const handleDeleteBanner = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这张轮播图吗？物理文件也将会一并删除。', '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }

  try {
    await api.delete(`/api/admin/banners/${id}`);
    ElMessage.success('删除成功');
    fetchBanners();
  } catch (error) {
    console.error('Delete banner error:', error);
    ElMessage.error('删除轮播图失败');
  }
};

onMounted(() => {
  fetchBanners();
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Header -->
    <div
      class="relative shrink-0 border-b overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-orange-500/10 via-purple-500/5 to-transparent pointer-events-none"
      ></div>

      <div
        class="px-4 sm:px-8 py-3 flex flex-row items-center justify-between gap-3 relative z-10"
      >
        <div class="flex items-center gap-3">
          <span class="p-1.5 rounded-xl bg-orange-500/10 text-orange-500 shadow-sm border border-orange-500/20">
            <ImageIcon class="w-4.5 h-4.5" />
          </span>
          <div>
            <h1 class="text-sm sm:text-base font-black tracking-tight" style="color: var(--text-primary)">
              工作台轮播管理
            </h1>
            <p class="text-[10px] text-slate-400 hidden sm:block">配置主页首屏的精美广告宣传以及社区挑战活动位</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
            @click="openCreateDialog"
          >
            <Plus class="w-4 h-4" />
            <span>新建轮播图</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-xs font-bold shadow-sm cursor-pointer"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="fetchBanners"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span>刷新</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main List content -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24">
        <div class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else class="max-w-none">
        <div class="blender-card p-4">
          <el-table
            :data="banners"
            style="width: 100%; --el-table-bg-color: transparent; --el-table-tr-bg-color: transparent; --el-table-header-bg-color: transparent;"
            class="custom-el-table"
          >
            <el-table-column label="预览" width="160">
              <template #default="{ row }">
                <div class="w-28 aspect-video rounded-lg overflow-hidden border border-white/10 bg-slate-800 flex items-center justify-center relative">
                  <img
                    v-if="row.imageUrl"
                    :src="getAssetUrl(row.imageUrl)"
                    class="w-full h-full object-cover"
                    alt="Banner preview"
                  />
                  <ImageIcon v-else class="w-5 h-5 text-slate-500" />
                  
                  <span
                    v-if="row.tag"
                    class="absolute top-1 left-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full scale-90 origin-top-left"
                    :class="row.tagColor || 'bg-accent/15 text-accent border border-accent/30'"
                  >
                    {{ row.tag }}
                  </span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="标题信息" min-width="200">
              <template #default="{ row }">
                <div class="space-y-1">
                  <h4 class="font-bold text-xs sm:text-sm text-slate-100">{{ row.title }}</h4>
                  <p v-if="row.subtitle" class="text-[10px] text-slate-400 line-clamp-1">{{ row.subtitle }}</p>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="链接路由" width="160">
              <template #default="{ row }">
                <div class="flex items-center gap-1.5 text-xs text-slate-300">
                  <LinkIcon class="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span class="truncate font-mono text-[10px] bg-slate-900/40 px-1.5 py-0.5 rounded">{{ row.route }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="按钮文本" width="100">
              <template #default="{ row }">
                <span class="text-xs font-semibold text-slate-300">{{ row.buttonText }}</span>
              </template>
            </el-table-column>

            <el-table-column label="排序值" width="90" align="center">
              <template #default="{ row }">
                <span class="text-xs font-mono font-bold bg-slate-100 dark:bg-white/5 border dark:border-white/5 px-2 py-0.5 rounded-md">{{ row.order }}</span>
              </template>
            </el-table-column>

            <el-table-column label="启用状态" width="100" align="center">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.isActive"
                  active-color="var(--accent)"
                  inactive-color="rgba(255,255,255,0.15)"
                  @change="handleToggleStatus(row)"
                />
              </template>
            </el-table-column>

            <el-table-column label="操作" width="120" align="right">
              <template #default="{ row }">
                <div class="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    class="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    @click="openEditDialog(row)"
                  >
                    <Edit2 class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    @click="handleDeleteBanner(row.id)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="banners.length === 0" class="py-16 text-center">
            <ImageIcon class="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-30" />
            <p class="text-xs text-slate-500 font-bold">暂无轮播图配置，前台将自动加载系统预设的静态广告位</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Dialog -->
    <el-drawer
      v-model="isDialogOpen"
      :title="dialogMode === 'create' ? '新建轮播广告图' : '编辑轮播广告图'"
      size="480px"
      destroy-on-close
      class="custom-el-drawer"
    >
      <div class="space-y-5 p-2">
        <!-- Title -->
        <div class="space-y-1.5">
          <label class="text-xs font-black text-slate-300">轮播图标题 *</label>
          <input
            v-model="form.title"
            type="text"
            placeholder="如：未来之门：赛博朋克城市挑战赛"
            class="w-full px-3 py-2 rounded-xl border dark:border-white/10 dark:bg-white/5 text-xs outline-none focus:ring-1 focus:ring-accent transition-all text-slate-100"
          />
        </div>

        <!-- Subtitle -->
        <div class="space-y-1.5">
          <label class="text-xs font-black text-slate-300">描述副标题</label>
          <textarea
            v-model="form.subtitle"
            rows="3"
            placeholder="简要介绍活动或课程详情，控制在80字以内"
            class="w-full px-3 py-2 rounded-xl border dark:border-white/10 dark:bg-white/5 text-xs outline-none focus:ring-1 focus:ring-accent transition-all text-slate-100 resize-none"
          ></textarea>
        </div>

        <!-- Image Upload -->
        <div class="space-y-1.5">
          <label class="text-xs font-black text-slate-300">轮播背景图 * (推荐 21:9，最大 5MB)</label>
          <div class="flex items-start gap-4">
            <!-- Thumbnail preview -->
            <div class="w-36 aspect-video rounded-xl overflow-hidden border dark:border-white/10 bg-slate-800 flex items-center justify-center relative group shrink-0">
              <img
                v-if="form.imageUrl"
                :src="getAssetUrl(form.imageUrl)"
                class="w-full h-full object-cover"
                alt="Banner uploading preview"
              />
              <ImageIcon v-else class="w-6 h-6 text-slate-600" />
              <div v-if="isUploading" class="absolute inset-0 bg-black/60 flex items-center justify-center">
                <RefreshCw class="w-5 h-5 text-white animate-spin" />
              </div>
            </div>
            
            <div class="space-y-2">
              <button
                type="button"
                class="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg border dark:border-white/10 text-xs font-bold cursor-pointer transition-colors"
                @click="triggerFileUpload"
              >
                选择图片并上传
              </button>
              <input
                ref="fileInputRef"
                type="file"
                class="hidden"
                accept="image/*"
                @change="handleImageUpload"
              />
              <p class="text-[10px] text-slate-500 leading-relaxed">
                上传的背景图片将被渲染在首屏大卡片中。建议使用横向宽屏背景以获得最佳显示效果。
              </p>
            </div>
          </div>
        </div>

        <!-- Link Route -->
        <div class="space-y-1.5">
          <label class="text-xs font-black text-slate-300 font-mono">跳转路由 (内链) *</label>
          <input
            v-model="form.route"
            type="text"
            placeholder="例如：/discussions 或 /academy/course/1"
            class="w-full px-3 py-2 rounded-xl border dark:border-white/10 dark:bg-white/5 text-xs outline-none focus:ring-1 focus:ring-accent transition-all text-slate-100 font-mono"
          />
        </div>

        <!-- Tags & colors -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-xs font-black text-slate-300">角标标签</label>
            <input
              v-model="form.tag"
              type="text"
              placeholder="如：本周挑战、进阶必学"
              class="w-full px-3 py-2 rounded-xl border dark:border-white/10 dark:bg-white/5 text-xs outline-none focus:ring-1 focus:ring-accent transition-all text-slate-100"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-black text-slate-300">标签颜色样式 (CSS 类)</label>
            <input
              v-model="form.tagColor"
              type="text"
              placeholder="如: bg-accent/15 text-accent border-accent/30"
              class="w-full px-3 py-2 rounded-xl border dark:border-white/10 dark:bg-white/5 text-xs outline-none focus:ring-1 focus:ring-accent transition-all text-slate-100"
            />
          </div>
        </div>

        <!-- Button text and order -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-xs font-black text-slate-300">按钮文字</label>
            <input
              v-model="form.buttonText"
              type="text"
              placeholder="默认：立即参与"
              class="w-full px-3 py-2 rounded-xl border dark:border-white/10 dark:bg-white/5 text-xs outline-none focus:ring-1 focus:ring-accent transition-all text-slate-100"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-black text-slate-300">排序值 (从小到大排列)</label>
            <input
              v-model.number="form.order"
              type="number"
              placeholder="数字越小越靠前"
              class="w-full px-3 py-2 rounded-xl border dark:border-white/10 dark:bg-white/5 text-xs outline-none focus:ring-1 focus:ring-accent transition-all text-slate-100"
            />
          </div>
        </div>

        <!-- Is Active Toggle -->
        <div class="flex items-center justify-between py-2 border-t dark:border-white/5 mt-4">
          <div>
            <span class="text-xs font-bold text-slate-200">启用该轮播</span>
            <p class="text-[10px] text-slate-500">禁用后，创作者工作台将不会显示此轮播卡片</p>
          </div>
          <el-switch v-model="form.isActive" active-color="var(--accent)" />
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2 px-2 py-3 border-t dark:border-white/5">
          <button
            type="button"
            class="px-4 py-2 border dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            style="color: var(--text-secondary)"
            @click="isDialogOpen = false"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
            :disabled="isSaving"
            @click="saveBanner"
          >
            <RefreshCw v-if="isSaving" class="w-3.5 h-3.5 animate-spin" />
            <span>保存</span>
          </button>
        </div>
      </template>
    </el-drawer>
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

:deep(.custom-el-table) {
  --el-table-border-color: rgba(255, 255, 255, 0.05);
  --el-table-header-text-color: var(--text-secondary);
  font-size: 12px;
}
:deep(.custom-el-table .el-table__row:hover td) {
  background-color: rgba(255, 255, 255, 0.02) !important;
}
:deep(.custom-el-table th.el-table__cell) {
  font-weight: 700 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}
:deep(.custom-el-table td.el-table__cell) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
}

:deep(.custom-el-drawer) {
  background-color: #121921 !important; /* side panel matching sidebar background */
  border-left: 1px solid rgba(255, 255, 255, 0.08) !important;
}
:deep(.custom-el-drawer .el-drawer__title) {
  font-weight: 800 !important;
  color: var(--text-primary) !important;
  font-size: 14px !important;
}
:deep(.custom-el-drawer .el-drawer__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding: 14px 20px !important;
  margin-bottom: 0 !important;
}
:deep(.custom-el-drawer .el-drawer__body) {
  padding: 16px 20px !important;
}
:deep(.custom-el-drawer .el-drawer__close-btn) {
  color: var(--text-muted) !important;
}
:deep(.custom-el-drawer .el-drawer__close-btn:hover) {
  color: var(--text-primary) !important;
}
</style>

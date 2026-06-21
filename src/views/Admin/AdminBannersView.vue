<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import {
  Plus,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Link as LinkIcon,
  RefreshCw,
  Sparkles,
} from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchManagementInsights } from './adminManagementInsights';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import AiImageGeneratorDialog from '@/components/AiImageGeneratorDialog.vue';

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

// AI Image Generation Dialog state
const aiGeneratorShow = ref(false);
const aiGeneratorType = ref<'avatar' | 'cover'>('cover');
const aiGeneratorTitle = ref('AI 生成轮播背景图');

const openAiGenerator = () => {
  aiGeneratorType.value = 'cover';
  aiGeneratorTitle.value = 'AI 生成轮播背景图';
  aiGeneratorShow.value = true;
};

const handleAiImageSave = async (file: File) => {
  try {
    isUploading.value = true;
    const formData = new FormData();
    formData.append('banner_image', file);
    const { data } = await api.post('/api/admin/banners/upload', formData);
    form.value.imageUrl = data.url;
    ElMessage.success('背景图片生成并上传成功');
  } catch (error) {
    ElMessage.error('背景图片上传失败');
  } finally {
    isUploading.value = false;
  }
};

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
    fetchManagementInsights(true);
  } catch (error) {
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
    ElMessage.error('删除轮播图失败');
  }
};
const consolidatedCards = computed(() => {
  const activeCount = banners.value.filter((b) => b.isActive).length;
  const inactiveCount = banners.value.filter((b) => !b.isActive).length;
  const missingImageCount = banners.value.filter((b) => !b.imageUrl).length;
  const totalCount = banners.value.length;

  return [
    {
      label: '启用轮播',
      value: activeCount,
      hint: '前台大图轮播展示数',
      icon: ImageIcon,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: '活动中' },
    },
    {
      label: '停用轮播',
      value: inactiveCount,
      hint: '已下架或暂停推广',
      icon: Trash2,
      color: 'text-slate-600 bg-slate-500/10 border-slate-500/20',
      health: { label: '未展示' },
    },
    {
      label: '缺图素材',
      value: missingImageCount,
      hint: '检查无图片素材配置',
      icon: ImageIcon,
      color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      health: { label: missingImageCount > 0 ? '需修复' : '无异常' },
    },
    {
      label: '投放位',
      value: totalCount,
      hint: '配置的推广图层总量',
      icon: LinkIcon,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      health: { label: '按序预览' },
    },
  ];
});

const getBadgeVariant = (label: string) => {
  if (label === '活动中' || label === '无异常' || label === '正常') return 'success';
  if (label === '需修复') return 'danger';
  if (label === '未展示') return 'warning';
  return 'primary';
};

onMounted(() => {
  fetchBanners();
});
</script>

<template>
  <div
    class="admin-banners-page flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)]"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide">
      <!-- Page Header -->
      <PageHeader
        title="工作台轮播管理"
        subtitle="配置主页首屏的精美广告宣传以及社区挑战活动位"
        variant="card"
      >
        <template #center>
          <div class="flex flex-wrap items-center gap-1.5 ml-2">
            <Badge variant="info"> 轮播图数: {{ banners.length }} </Badge>
          </div>
        </template>

        <!-- Actions -->
        <Button variant="primary" size="sm" :icon="Plus" @click="openCreateDialog">
          新建轮播图
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchBanners"
        >
          刷新
        </Button>
      </PageHeader>

      <!-- KPI Metrics Grid -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
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
          <div v-if="isLoading" class="flex flex-col items-center justify-center py-24">
            <div
              class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"
            ></div>
          </div>

          <div v-else class="max-w-none">
            <Card padding="none" class="table-shell-card overflow-hidden">
              <el-table
                :data="banners"
                style="
                  width: 100%;
                  --el-table-bg-color: transparent;
                  --el-table-tr-bg-color: transparent;
                  --el-table-header-bg-color: transparent;
                "
                class="custom-el-table"
              >
                <el-table-column label="预览" width="160">
                  <template #default="{ row }">
                    <div
                      class="w-28 aspect-video rounded-lg overflow-hidden border border-white/10 bg-slate-800 flex items-center justify-center relative"
                    >
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
                      <p v-if="row.subtitle" class="text-[10px] text-slate-400 line-clamp-1">
                        {{ row.subtitle }}
                      </p>
                    </div>
                  </template>
                </el-table-column>

                <el-table-column label="链接路由" width="160">
                  <template #default="{ row }">
                    <div class="flex items-center gap-1.5 text-xs text-slate-300">
                      <LinkIcon class="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span
                        class="truncate font-mono text-[10px] bg-slate-900/40 px-1.5 py-0.5 rounded"
                        >{{ row.route }}</span
                      >
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
                    <span
                      class="text-xs font-mono font-bold bg-slate-100 dark:bg-white/5 border dark:border-white/5 px-2 py-0.5 rounded-md"
                      >{{ row.order }}</span
                    >
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
                <p class="text-xs text-slate-500 font-bold">
                  暂无轮播图配置，前台将自动加载系统预设的静态广告位
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>

    <!-- Edit Dialog -->
    <Modal
      :show="isDialogOpen"
      :title="dialogMode === 'create' ? '新建轮播广告图' : '编辑轮播广告图'"
      size="md"
      glass-card
      @close="isDialogOpen = false"
    >
      <div class="space-y-4">
        <!-- Title -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-[var(--text-secondary)]">轮播图标题 *</label>
          <input
            v-model="form.title"
            type="text"
            placeholder="如：未来之门：赛博朋克城市挑战赛"
            class="w-full px-3 py-2 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)]/50 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]/60"
          />
        </div>

        <!-- Subtitle -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-[var(--text-secondary)]">描述副标题</label>
          <textarea
            v-model="form.subtitle"
            rows="3"
            placeholder="简要介绍活动或课程详情，控制在80字以内"
            class="w-full px-3 py-2 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)]/50 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]/60 resize-none"
          ></textarea>
        </div>

        <!-- Image Upload -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-[var(--text-secondary)]"
            >轮播背景图 * (推荐 21:9，最大 5MB)</label
          >
          <div class="flex items-start gap-4">
            <!-- Thumbnail preview -->
            <div
              class="w-36 aspect-video rounded-xl overflow-hidden border border-[var(--border-base)] bg-[var(--bg-app)]/80 flex items-center justify-center relative group shrink-0"
            >
              <img
                v-if="form.imageUrl"
                :src="getAssetUrl(form.imageUrl)"
                class="w-full h-full object-cover"
                alt="Banner uploading preview"
              />
              <ImageIcon v-else class="w-6 h-6 text-[var(--text-muted)] opacity-60" />
              <div
                v-if="isUploading"
                class="absolute inset-0 bg-black/60 flex items-center justify-center"
              >
                <RefreshCw class="w-5 h-5 text-white animate-spin" />
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" @click="triggerFileUpload">
                  选择图片并上传
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  class="bg-gradient-to-r from-violet-600/90 to-indigo-600/90 hover:from-violet-500/95 hover:to-indigo-500/95 text-white font-semibold flex items-center gap-1 shadow-sm transition-all"
                  @click="openAiGenerator"
                >
                  <Sparkles class="w-3.5 h-3.5" />
                  AI 生成
                </Button>
              </div>
              <input
                ref="fileInputRef"
                type="file"
                class="hidden"
                accept="image/*"
                @change="handleImageUpload"
              />
              <p class="text-[10px] text-[var(--text-muted)] leading-relaxed">
                上传的背景图片将被渲染在首屏大卡片中。建议使用横向宽屏背景以获得最佳显示效果。
              </p>
            </div>
          </div>
        </div>

        <!-- Link Route -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-[var(--text-secondary)] font-mono"
            >跳转路由 (内链) *</label
          >
          <input
            v-model="form.route"
            type="text"
            placeholder="例如：/discussions 或 /academy/course/1"
            class="w-full px-3 py-2 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)]/50 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]/60 font-mono"
          />
        </div>

        <!-- Tags & colors -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-[var(--text-secondary)]">角标标签</label>
            <input
              v-model="form.tag"
              type="text"
              placeholder="如：本周挑战、进阶必学"
              class="w-full px-3 py-2 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)]/50 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]/60"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-[var(--text-secondary)]"
              >标签颜色样式 (CSS 类)</label
            >
            <input
              v-model="form.tagColor"
              type="text"
              placeholder="如: bg-accent/15 text-accent border-accent/30"
              class="w-full px-3 py-2 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)]/50 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]/60"
            />
          </div>
        </div>

        <!-- Button text and order -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-[var(--text-secondary)]">按钮文字</label>
            <input
              v-model="form.buttonText"
              type="text"
              placeholder="默认：立即参与"
              class="w-full px-3 py-2 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)]/50 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]/60"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-[var(--text-secondary)]"
              >排序值 (从小到大排列)</label
            >
            <input
              v-model.number="form.order"
              type="number"
              placeholder="数字越小越靠前"
              class="w-full px-3 py-2 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)]/50 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]/60"
            />
          </div>
        </div>

        <!-- Is Active Toggle -->
        <div
          class="flex items-center justify-between py-2 border-t border-[var(--border-base)] mt-4"
        >
          <div>
            <span class="text-xs font-bold text-[var(--text-primary)]">启用该轮播</span>
            <p class="text-[10px] text-[var(--text-muted)]">
              禁用后，创作者工作台将不会显示此轮播卡片
            </p>
          </div>
          <el-switch v-model="form.isActive" active-color="var(--accent)" />
        </div>
      </div>

      <template #footer>
        <div class="flex items-center gap-3">
          <Button variant="secondary" size="md" @click="isDialogOpen = false"> 取消 </Button>
          <Button variant="primary" size="md" :loading="isSaving" @click="saveBanner">
            保存
          </Button>
        </div>
      </template>
    </Modal>

    <!-- AI Image Generation Dialog -->
    <AiImageGeneratorDialog
      :show="aiGeneratorShow"
      :title="aiGeneratorTitle"
      :type="aiGeneratorType"
      @close="aiGeneratorShow = false"
      @save="handleAiImageSave"
    />
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

.admin-banners-page {
  background: transparent !important;
}
</style>

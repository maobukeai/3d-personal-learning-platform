<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { ElMessage } from 'element-plus';
import {
  ArrowLeft,
  Edit3,
  Layout,
  Eye,
  PanelRightOpen,
  PanelRightClose,
  X,
  Settings,
  Upload,
  Loader2,
  Check,
  Keyboard,
  Database,
} from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

interface ManualResource {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  contentUrl: string | null;
  contentHtml: string | null;
  tags: string | null;
  resourceType: string;
  viewCount: number;
  categoryId: string | null;
  category: { name: string } | null;
  createdAt: string;
}

interface ManualCategory {
  id: string;
  name: string;
  slug?: string | null;
  order?: number;
  parentId?: string | null;
}

const props = defineProps<{
  stationId: string;
  categories: ManualCategory[];
  formattedCategories: ManualCategory[];
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const showDialog = ref(false);
const isEdit = ref(false);
const editingResource = ref<ManualResource | null>(null);
const previewMode = ref<'edit' | 'live' | 'preview'>('edit');
const isSaving = ref(false);
const showSettingsSidebar = ref(true);

const resourceForm = ref({
  title: '',
  description: '',
  thumbnailUrl: '',
  contentUrl: '',
  tags: '',
  contentHtml: '',
  resourceType: 'COURSE',
  categoryId: '',
});

const isUploadingThumbnail = ref(false);

const handleThumbnailUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    return ElMessage.warning('预览图大小不能超过 5MB');
  }

  try {
    isUploadingThumbnail.value = true;
    const formDataObj = new FormData();
    formDataObj.append('manual_image', file);
    const { data } = await api.post('/api/admin/manual/upload', formDataObj);
    resourceForm.value.thumbnailUrl = data.url;
    ElMessage.success('预览图上传成功');
  } catch (error) {
    console.error('Thumbnail upload error:', error);
    ElMessage.error(getApiErrorMessage(error, '预览图上传失败'));
  } finally {
    isUploadingThumbnail.value = false;
    target.value = '';
  }
};

const openCreate = () => {
  previewMode.value = 'edit';
  isEdit.value = false;
  editingResource.value = null;
  resourceForm.value = {
    title: '',
    description: '',
    thumbnailUrl: '',
    contentUrl: '',
    tags: '',
    contentHtml: '',
    resourceType: 'COURSE',
    categoryId: props.categories[0]?.id || '',
  };
  showDialog.value = true;
};

const openEdit = (resource: ManualResource) => {
  previewMode.value = 'edit';
  isEdit.value = true;
  editingResource.value = resource;
  resourceForm.value = {
    title: resource.title,
    description: resource.description || '',
    thumbnailUrl: resource.thumbnailUrl || '',
    contentUrl: resource.contentUrl || '',
    tags: resource.tags || '',
    contentHtml: resource.contentHtml || '',
    resourceType: resource.resourceType || 'COURSE',
    categoryId: resource.categoryId || '',
  };
  showDialog.value = true;
};

const charCount = computed(() => resourceForm.value.contentHtml?.length || 0);
const lineCount = computed(() => {
  const content = resourceForm.value.contentHtml || '';
  return content ? content.split('\n').length : 0;
});

const parsedNetdisk = computed(() => {
  const url = resourceForm.value.contentUrl || '';
  if (!url) return null;
  
  if (url.includes('quark.cn')) {
    return { name: '夸克网盘', color: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-800/30' };
  } else if (url.includes('baidu.com')) {
    return { name: '百度网盘', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800/30' };
  } else if (url.includes('alipan.com') || url.includes('aliyundrive.com')) {
    return { name: '阿里云盘', color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-800/30' };
  } else if (url.includes('123pan.com')) {
    return { name: '123云盘', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-800/30' };
  }
  return { name: '通用链接', color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-800/30' };
});

const saveResource = async () => {
  if (!props.stationId) return;
  
  if (!resourceForm.value.title.trim()) {
    ElMessage.warning('请输入资源标题');
    return;
  }

  if (isSaving.value) return;
  isSaving.value = true;

  try {
    if (isEdit.value && editingResource.value) {
      await api.put(`/api/admin/manual/resources/${editingResource.value.id}`, resourceForm.value);
      ElMessage.success('更新资源成功');
    } else {
      await api.post(`/api/admin/manual/stations/${props.stationId}/resources`, resourceForm.value);
      ElMessage.success('创建资源成功');
    }
    showDialog.value = false;
    emit('refresh');
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, '操作资源失败'));
  } finally {
    isSaving.value = false;
  }
};

function handleEditorKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (showDialog.value) {
      saveResource();
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEditorKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleEditorKeydown);
});

defineExpose({
  openCreate,
  openEdit,
});
</script>

<template>
  <!-- DIALOG: MANAGE RESOURCE (Immersive Fullscreen Editor) -->
  <el-dialog
    v-model="showDialog"
    fullscreen
    :show-close="false"
    class="immersive-editor-dialog"
    destroy-on-close
  >
    <div class="fixed inset-0 bg-[var(--bg-app)] flex flex-col h-screen">
      <!-- ① HEADER TOOLBAR -->
      <header
        class="sticky top-0 z-50 h-14 flex items-center justify-between px-4 md:px-6 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-[var(--border-base)] shrink-0"
      >
        <!-- Left: Back + Context -->
        <div class="flex items-center gap-3 min-w-0">
          <button type="button" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all shrink-0 cursor-pointer bg-transparent border-none" @click="showDialog = false">
            <ArrowLeft class="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <div class="min-w-0">
            <div class="text-sm font-bold text-[var(--text-primary)] truncate">
              {{ isEdit ? '编辑精品资源' : '发布精品资源' }}
            </div>
          </div>
        </div>

        <!-- Center: Preview Mode Toggle -->
        <div class="absolute left-1/2 -translate-x-1/2 hidden sm:block">
          <el-radio-group v-model="previewMode" size="small" class="preview-mode-toggle">
            <el-radio-button value="edit">
              <div class="flex items-center gap-1.5 px-2">
                <Edit3 class="w-3.5 h-3.5" /> <span>编辑</span>
              </div>
            </el-radio-button>
            <el-radio-button value="live">
              <div class="flex items-center gap-1.5 px-2">
                <Layout class="w-3.5 h-3.5" /> <span>实时</span>
              </div>
            </el-radio-button>
            <el-radio-button value="preview">
              <div class="flex items-center gap-1.5 px-2">
                <Eye class="w-3.5 h-3.5" /> <span>预览</span>
              </div>
            </el-radio-button>
          </el-radio-group>
        </div>

        <!-- Right: Sidebar Toggle + Save -->
        <div class="flex items-center gap-2">
          <!-- Mobile preview toggle -->
          <el-radio-group v-model="previewMode" size="small" class="preview-mode-toggle sm:hidden">
            <el-radio-button value="edit">
              <Edit3 class="w-3.5 h-3.5" />
            </el-radio-button>
            <el-radio-button value="live">
              <Layout class="w-3.5 h-3.5" />
            </el-radio-button>
            <el-radio-button value="preview">
              <Eye class="w-3.5 h-3.5" />
            </el-radio-button>
          </el-radio-group>

          <button
type="button" class="p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold bg-transparent" :class="showSettingsSidebar
              ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400'
              : 'border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/5'" @click="showSettingsSidebar = !showSettingsSidebar">
            <PanelRightOpen v-if="!showSettingsSidebar" class="w-4 h-4" />
            <PanelRightClose v-else class="w-4 h-4" />
            <span class="hidden md:inline">设置</span>
          </button>

          <button type="button" :disabled="isSaving" class="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5 border-none shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400" @click="saveResource">
            <Loader2 v-if="isSaving" class="w-3.5 h-3.5 animate-spin" />
            <Check v-else class="w-3.5 h-3.5" />
            {{ isSaving ? '保存中...' : '保存并发布' }}
          </button>
        </div>
      </header>

      <!-- ② + ③ MAIN AREA: Editor + Sidebar -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Editor Content Area -->
        <div class="flex-1 overflow-y-auto custom-scrollbar">
          <div class="max-w-5xl mx-auto px-3 md:px-6 pb-16 pt-6 md:pt-10">
            <div class="bg-[var(--bg-card)] border border-[var(--border-base)] shadow-sm rounded-2xl min-h-[70vh] px-5 md:px-12 py-6 md:py-12 transition-all duration-300">
              <el-input v-model="resourceForm.title" placeholder="请输入资源标题" class="editor-modern-title mb-6" />
              <div class="w-16 h-0.5 bg-gradient-to-r from-cyan-500/40 to-transparent rounded-full mb-6"></div>
              <MarkdownEditor
                v-model="resourceForm.contentHtml"
                auto-height
                class="modern-paper-theme"
                :auto-focus="true"
                :preview="previewMode === 'live'"
                :preview-only="previewMode === 'preview'"
                placeholder="编写资源的详细介绍与使用指南，支持 Markdown 排版、图片、表格及代码高亮..."
                upload-url="/api/admin/manual/upload"
                upload-field="manual_image"
              />
            </div>
          </div>
        </div>

        <!-- ③ Settings Sidebar -->
        <aside
          v-if="showSettingsSidebar"
          class="w-80 shrink-0 border-l border-[var(--border-base)] bg-[var(--bg-card)] overflow-y-auto custom-scrollbar hidden md:block"
        >
          <div class="p-5 space-y-5">
            <!-- Sidebar Header -->
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Settings class="w-4 h-4 text-cyan-500" />
                资源设置
              </h3>
              <button type="button" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-muted)] transition-colors cursor-pointer bg-transparent border-none" @click="showSettingsSidebar = false">
                <X class="w-4 h-4" />
              </button>
            </div>

            <!-- Category -->
            <div class="settings-group">
              <label class="settings-label">
                <span class="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0"></span>
                所属分类
              </label>
              <el-select v-model="resourceForm.categoryId" placeholder="选择分类" size="small" class="w-full">
                <el-option label="暂无分类" value="" />
                <el-option v-for="cat in props.formattedCategories" :key="cat.id" :label="cat.name" :value="cat.id" />
              </el-select>
            </div>

            <!-- Resource Type -->
            <div class="settings-group">
              <label class="settings-label">
                <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                资源类型
              </label>
              <el-select v-model="resourceForm.resourceType" placeholder="选择类型" size="small" class="w-full">
                <el-option label="课程/教程" value="COURSE" />
                <el-option label="3D模型" value="MODEL" />
                <el-option label="材质贴图" value="MATERIAL" />
                <el-option label="软件插件" value="SOFTWARE" />
                <el-option label="其它资源" value="OTHER" />
              </el-select>
            </div>

            <!-- Download URL + Netdisk Badge -->
            <div class="settings-group">
              <label class="settings-label">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                极速提取链接
                <span
                  v-if="parsedNetdisk"
                  class="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all"
                  :class="parsedNetdisk.color"
                >
                  {{ parsedNetdisk.name }}
                </span>
              </label>
              <el-input v-model="resourceForm.contentUrl" placeholder="https://pan.quark.cn/s/..." size="small" />
            </div>

            <!-- Thumbnail Upload -->
            <div class="settings-group">
              <label class="settings-label">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                资源封面
              </label>
              <div
                class="w-full aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-all bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 group"
              >
                <img v-if="resourceForm.thumbnailUrl" alt="" :src="getAssetUrl(resourceForm.thumbnailUrl)" class="w-full h-full object-cover" />
                <div v-else class="flex flex-col items-center justify-center p-2 text-center space-y-1 pointer-events-none">
                  <Upload class="w-5 h-5 text-slate-400" />
                  <span class="text-[10px] text-slate-400">点击上传封面图片</span>
                  <span class="text-[8px] text-slate-400">PNG/JPG/WebP &lt; 5MB</span>
                </div>
                
                <label class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <Upload v-if="!isUploadingThumbnail" class="w-5 h-5 text-white" />
                  <Loader2 v-else class="w-5 h-5 text-white animate-spin" />
                  <input type="file" accept="image/*" class="hidden" @change="handleThumbnailUpload" />
                </label>
              </div>
              <el-input
                v-model="resourceForm.thumbnailUrl"
                placeholder="或者输入网络图片 URL"
                size="small"
                class="mt-2"
              />
            </div>

            <!-- Tags -->
            <div class="settings-group">
              <label class="settings-label">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                资源标签
              </label>
              <el-input v-model="resourceForm.tags" placeholder="C4D, 材质包, 渲染器" size="small" />
              <p class="text-[10px] text-[var(--text-muted)] mt-1">多个标签用英文逗号隔开</p>
            </div>

            <!-- Description -->
            <div class="settings-group">
              <label class="settings-label">
                <span class="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0"></span>
                资源描述
              </label>
              <el-input
                v-model="resourceForm.description"
                type="textarea"
                :rows="3"
                placeholder="对此资源的精品特征做简明阐述..."
                size="small"
              />
            </div>
          </div>
        </aside>
      </div>

      <!-- ④ BOTTOM STATUS BAR -->
      <footer
        class="sticky bottom-0 z-40 h-9 flex items-center justify-between px-4 md:px-6 bg-[var(--bg-app)]/80 backdrop-blur-md border-t border-[var(--border-base)] shrink-0"
      >
        <div class="flex items-center gap-4 text-[10px] font-medium text-[var(--text-muted)]">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            已就绪
          </span>
          <span class="hidden sm:flex items-center gap-1">
            <Keyboard class="w-3 h-3" />
            Ctrl+S 保存
          </span>
          <span class="hidden md:flex items-center gap-1">
            <Database class="w-3 h-3 text-cyan-500" />
            Markdown
          </span>
        </div>
        <div class="flex items-center gap-4 text-[10px] font-medium text-[var(--text-muted)]">
          <span>{{ charCount }} 字符</span>
          <span class="hidden sm:inline">{{ lineCount }} 行</span>
        </div>
      </footer>
    </div>
  </el-dialog>
</template>

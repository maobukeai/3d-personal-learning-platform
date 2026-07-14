<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Save, ExternalLink } from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import AdminHeader from './components/AdminHeader.vue';

interface WebOverview {
  courses: number;
  assets: number;
  materials: number;
  plugins: number;
  softwares: number;
  activeMirrors: number;
  mirroredResources: number;
}
type FeaturedResourceIds = {
  courses: string[];
  assets: string[];
  materials: string[];
  plugins: string[];
  softwares: string[];
};

const loading = ref(false);
const saving = ref(false);
const featuredResourceIdsText = ref('{}');
const catalogOptions = ref<Record<string, { id: string; title: string }[]>>({});
const banners = ref<
  Array<{
    id: string;
    imageUrl: string;
    title: string;
    subtitle: string;
    buttonLabel: string;
    href: string;
    enabled: boolean;
    order: number;
  }>
>([]);
const selectedCatalogKind = ref('courses');
const catalogFilter = ref('');
const mirrors = ref<{ id: string; displayName: string }[]>([]);
const stats = ref<WebOverview | null>(null);

const form = ref({
  eyebrow: 'PERSONAL LEARNING PLATFORM',
  title: '把每一次学习，\n变成看得见的成长。',
  subtitle: '一个将课程、资源、3D 创作与协作串联起来的个人学习空间。更专注，也更自由。',
  featuredMirrorId: null as string | null,
  showCoursePreview: true,
  showCapabilityMap: true,
  showMirrorPreview: true,
  showDiscovery: true,
  showLatest: true,
  showTrending: true,
  bannerImage: null as string | null,
  featuredResourceIds: {
    courses: [] as string[],
    assets: [] as string[],
    materials: [] as string[],
    plugins: [] as string[],
    softwares: [] as string[],
  } as FeaturedResourceIds,
  recommendedCategories: [] as string[],
  moduleOrder: ['hero', 'metrics', 'latest', 'trending', 'courses', 'capabilities', 'mirrors'],
});

const officialSiteUrl =
  import.meta.env.VITE_OFFICIAL_SITE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '/');

const load = async () => {
  loading.value = true;
  try {
    const [homeRes, mirrorsRes, overviewRes, catalogRes, bannersRes] = await Promise.all([
      api.get('/api/admin/website/home'),
      api.get('/api/admin/mirror/sources'),
      api.get('/website/overview'),
      api.get('/api/admin/website/catalog-options'),
      api.get('/api/admin/website/banners'),
    ]);
    form.value = { ...form.value, ...homeRes.data };
    featuredResourceIdsText.value = JSON.stringify(form.value.featuredResourceIds || {}, null, 2);
    mirrors.value = mirrorsRes.data || [];
    stats.value = overviewRes.data;
    catalogOptions.value = catalogRes.data || {};
    banners.value = bannersRes.data || [];
  } catch {
    ElMessage.error('官网配置加载失败');
  } finally {
    loading.value = false;
  }
};
const catalogItems = computed(() =>
  (catalogOptions.value[selectedCatalogKind.value] || []).filter(
    (item) =>
      !catalogFilter.value || item.title.toLowerCase().includes(catalogFilter.value.toLowerCase()),
  ),
);
const isFeatured = (id: string) =>
  (
    form.value.featuredResourceIds?.[
      selectedCatalogKind.value as keyof typeof form.value.featuredResourceIds
    ] || []
  ).includes(id);
const toggleFeatured = (id: string) => {
  const key = selectedCatalogKind.value as keyof typeof form.value.featuredResourceIds;
  const current = [...(form.value.featuredResourceIds?.[key] || [])];
  form.value.featuredResourceIds = {
    ...form.value.featuredResourceIds,
    [key]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
  };
  featuredResourceIdsText.value = JSON.stringify(form.value.featuredResourceIds, null, 2);
};

const save = async () => {
  saving.value = true;
  try {
    let featuredResourceIds = form.value.featuredResourceIds;
    try {
      featuredResourceIds = JSON.parse(featuredResourceIdsText.value || '{}');
    } catch {
      ElMessage.error('精选资源 JSON 格式不正确');
      saving.value = false;
      return;
    }
    await api.put('/api/admin/website/home', { ...form.value, featuredResourceIds });
    await api.put('/api/admin/website/banners', banners.value);
    ElMessage.success('官网首页已保存');
  } catch {
    ElMessage.error('官网配置保存失败');
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div class="h-full w-full flex flex-col min-w-0 bg-[var(--bg-main)]">
    <!-- Main settings area aligned with standard dashboard layouts -->
    <main class="min-h-0 flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-2 scrollbar-hide">
      <!-- Admin Header with action buttons placed in default slot -->
      <AdminHeader title="官网运营" :show-search="false">
        <a class="preview-link" :href="officialSiteUrl" target="_blank" rel="noopener">
          预览官网 <ExternalLink :size="14" />
        </a>
        <Button
          variant="primary"
          size="sm"
          :loading="saving"
          :icon="Save"
          class="!h-7.5 !text-xs !px-2.5"
          @click="save"
        >
          保存发布
        </Button>
      </AdminHeader>

      <!-- 官网数据概览看板 -->
      <div v-if="stats" class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div class="stats-card">
          <span class="stats-label">学院公开课程</span>
          <strong class="stats-val">{{ stats.courses }}</strong>
        </div>
        <div class="stats-card">
          <span class="stats-label">模型创作资产</span>
          <strong class="stats-val">{{ stats.assets }}</strong>
        </div>
        <div class="stats-card">
          <span class="stats-label">收藏材料资源</span>
          <strong class="stats-val">{{ stats.materials }}</strong>
        </div>
        <div class="stats-card">
          <span class="stats-label">工具与软件数</span>
          <strong class="stats-val">{{ stats.plugins + stats.softwares }}</strong>
        </div>
        <div class="stats-card">
          <span class="stats-label">公开镜像分类总数</span>
          <strong class="stats-val text-[var(--accent)]">{{ stats.activeMirrors }}</strong>
        </div>
      </div>

      <!-- Bento Grid Style Settings Columns -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <!-- Left Column:的首屏文案 -->
        <Card class="lg:col-span-3 border-base bg-card shadow-sm" :aria-busy="loading">
          <h3 class="section-title">首屏文案编辑</h3>
          <div class="space-y-4">
            <div class="form-group">
              <label class="form-label">眉题 (Eyebrow)</label>
              <input
                v-model="form.eyebrow"
                maxlength="80"
                class="form-input"
                placeholder="例如: PERSONAL LEARNING PLATFORM"
              />
              <span class="form-help">展示在主标题上方的辅助性小字标题，最多 80 个字符。</span>
            </div>

            <div class="form-group">
              <label class="form-label">主标题 (Title)</label>
              <textarea
                v-model="form.title"
                rows="3"
                maxlength="160"
                class="form-textarea"
                placeholder="输入首页的大标题"
              />
              <span class="form-help"
                >支持用换行符 \n 控制断行，以在官网呈现更好的排版张力。最多 160 字。</span
              >
            </div>

            <div class="form-group">
              <label class="form-label">介绍副标题 (Subtitle)</label>
              <textarea
                v-model="form.subtitle"
                rows="4"
                maxlength="300"
                class="form-textarea"
                placeholder="输入平台的简要描述"
              />
              <span class="form-help"
                >详细描述平台的主旨，突出个人成长或 3D 工作空间特色。最多 300 字。</span
              >
            </div>
          </div>
        </Card>

        <!-- Right Column:模块控制 -->
        <Card
          class="lg:col-span-2 border-base bg-card shadow-sm flex flex-col justify-between"
          :aria-busy="loading"
        >
          <div class="space-y-4">
            <h3 class="section-title">官网模块管理</h3>

            <div class="form-group">
              <label class="form-label">特色镜像源推荐</label>
              <select v-model="form.featuredMirrorId" class="form-select">
                <option :value="null">-- 默认展示首个活跃镜像源 --</option>
                <option v-for="mirror in mirrors" :key="mirror.id" :value="mirror.id">
                  {{ mirror.displayName }}
                </option>
              </select>
              <span class="form-help"
                >选择在官网首页底部的镜像站板块中，优先推荐展示的资源源头。</span
              >
            </div>

            <div class="form-group mt-6">
              <label class="form-label mb-2 block">可见功能板块</label>
              <fieldset class="module-switches-clean">
                <label class="switch-item">
                  <input v-model="form.showCoursePreview" type="checkbox" />
                  <div class="switch-info">
                    <strong>课程预览区</strong>
                    <small>在首页展示最新公开课程大纲和学习入口</small>
                  </div>
                </label>
                <label class="switch-item">
                  <input v-model="form.showCapabilityMap" type="checkbox" />
                  <div class="switch-info">
                    <strong>核心功能卡片</strong>
                    <small>展示我的学习、协作、资源和工具五大入口</small>
                  </div>
                </label>
                <label class="switch-item">
                  <input v-model="form.showMirrorPreview" type="checkbox" />
                  <div class="switch-info">
                    <strong>镜像资源站预览</strong>
                    <small>在首页直接呈现公开镜像源及精选分类</small>
                  </div>
                </label>
                <label class="switch-item">
                  <input v-model="form.showDiscovery" type="checkbox" />
                  <div class="switch-info">
                    <strong>资源发现流</strong><small>显示最新收录、热门资源和趋势内容</small>
                  </div>
                </label>
                <label class="switch-item">
                  <input v-model="form.showLatest" type="checkbox" />
                  <div class="switch-info">
                    <strong>最近更新</strong><small>在官网首页展示最近更新的公开内容</small>
                  </div>
                </label>
                <label class="switch-item">
                  <input v-model="form.showTrending" type="checkbox" />
                  <div class="switch-info">
                    <strong>本周热门</strong><small>按公开浏览量和下载热度展示热门内容</small>
                  </div>
                </label>
              </fieldset>
            </div>
            <div class="form-group mt-6">
              <label class="form-label">编辑精选资源 ID</label>
              <label class="form-label">首页 Banner</label>
              <div v-for="banner in banners" :key="banner.id" class="banner-editor">
                <input v-model="banner.imageUrl" class="form-input" placeholder="图片地址" /><input
                  v-model="banner.title"
                  class="form-input"
                  placeholder="标题"
                /><input v-model="banner.subtitle" class="form-input" placeholder="副标题" />
                <div class="banner-editor-row">
                  <input
                    v-model="banner.buttonLabel"
                    class="form-input"
                    placeholder="按钮文字"
                  /><input v-model="banner.href" class="form-input" placeholder="跳转地址" /><label
                    ><input v-model="banner.enabled" type="checkbox" /> 显示</label
                  >
                </div>
              </div>
              <button
                type="button"
                class="preview-link"
                @click="
                  banners.push({
                    id: `banner-${Date.now()}`,
                    imageUrl: '',
                    title: '',
                    subtitle: '',
                    buttonLabel: '探索资源',
                    href: '/resources',
                    enabled: true,
                    order: banners.length,
                  })
                "
              >
                + 添加 Banner
              </button>
              <label class="form-label mt-4 block">可视化精选资源</label>
              <div class="featured-picker">
                <div class="featured-picker-toolbar">
                  <select v-model="selectedCatalogKind" class="form-select">
                    <option value="courses">课程</option>
                    <option value="assets">模型</option>
                    <option value="materials">材料</option>
                    <option value="plugins">插件</option>
                    <option value="softwares">软件</option></select
                  ><input v-model="catalogFilter" class="form-input" placeholder="搜索资源标题" />
                </div>
                <div class="featured-picker-list">
                  <label
                    v-for="item in catalogItems.slice(0, 20)"
                    :key="item.id"
                    class="featured-picker-item"
                    ><input
                      type="checkbox"
                      :checked="isFeatured(item.id)"
                      @change="toggleFeatured(item.id)"
                    /><span>{{ item.title }}</span></label
                  >
                </div>
              </div>
              <span class="form-help">勾选后会同步写入精选配置，首页优先展示这些资源。</span>
              <textarea
                v-model="featuredResourceIdsText"
                rows="6"
                class="form-textarea"
                placeholder='{ "courses": [], "assets": [] }'
              />
              <span class="form-help"
                >按类型填写公开资源 ID 数组；留空时自动使用最新内容补位。</span
              >
            </div>
          </div>

          <div class="website-admin__note-clean mt-6">
            <span class="info-icon">💡</span>
            <span>保存的内容会在客户端下一次发起官网首页请求时实时生效。</span>
          </div>
        </Card>
      </div>
    </main>
  </div>
</template>

<style scoped>
.preview-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
}
.stats-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}
.featured-picker {
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-main);
}
.banner-editor {
  display: grid;
  gap: 7px;
  margin: 8px 0;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-main);
}
.banner-editor-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 7px;
  align-items: center;
}
.featured-picker-toolbar {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px;
}
.featured-picker-list {
  display: grid;
  gap: 6px;
  max-height: 190px;
  overflow: auto;
  margin-top: 8px;
}
.featured-picker-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 7px;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
}
.featured-picker-item:hover {
  background: var(--card);
}
.stats-label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}
.stats-val {
  color: var(--text);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.section-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  border-left: 3.5px solid var(--accent);
  padding-left: 8px;
  line-height: 1.15;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.form-label {
  font-size: 13px;
  font-weight: 650;
  color: var(--text);
}
.form-help {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}
.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 11px 12px;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  background: var(--surface-soft);
  font: inherit;
  font-weight: 400;
  resize: vertical;
}
.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
}
.module-switches-clean {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.switch-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  background: var(--surface);
  transition:
    background 0.15s,
    border-color 0.15s;
}
.switch-item:hover {
  background: var(--surface-soft);
  border-color: var(--accent);
}
.switch-item input[type='checkbox'] {
  width: 16px;
  height: 16px;
  margin-top: 3px;
  accent-color: var(--accent);
}
.switch-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.switch-info strong {
  font-size: 13px;
  color: var(--text);
}
.switch-info small {
  font-size: 11px;
  color: var(--text-secondary);
}
.website-admin__note-clean {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  color: var(--text-secondary);
  background: var(--surface-soft);
  font-size: 12px;
  line-height: 1.5;
  border: 1px dashed var(--border);
}
.info-icon {
  font-size: 14px;
}
</style>

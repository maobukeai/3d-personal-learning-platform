<script setup lang="ts">
import { computed, ref, defineAsyncComponent } from 'vue';
import { useThemeObserver } from '@/composables/useThemeObserver';
import {
  Search,
  ExternalLink,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Compass,
  ArrowRight,
  DownloadCloud,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { useLabel } from '@/utils/i18n';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';

const MdPreview = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdPreview));

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const label = useLabel();

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const { isDark } = useThemeObserver();

const searchQuery = ref('');
const isSearching = ref(false);
const searchStep = ref<'idle' | 'scraping' | 'analyzing' | 'done'>('idle');
const aiAnalysis = ref('');

interface SiteStatus {
  key: string;
  name: string;
  url: string;
  status: 'idle' | 'searching' | 'success' | 'empty' | 'error';
  resultsCount: number;
}

const targetSites = ref<SiteStatus[]>([
  {
    key: 'extensions.blender.org',
    name: 'Blender 官方扩展库',
    url: 'https://extensions.blender.org',
    status: 'idle',
    resultsCount: 0,
  },
  {
    key: 'www.blenderx.cn',
    name: 'BlenderX 源素',
    url: 'https://www.blenderx.cn',
    status: 'idle',
    resultsCount: 0,
  },
  {
    key: 'budeco.top',
    name: 'Blender 布的',
    url: 'https://budeco.top',
    status: 'idle',
    resultsCount: 0,
  },
  {
    key: 'superhivemarket.com',
    name: 'Superhive 市场',
    url: 'https://superhivemarket.com',
    status: 'idle',
    resultsCount: 0,
  },
  {
    key: 'www.gfxcamp.com',
    name: 'CG营地 GfxCamp',
    url: 'https://www.gfxcamp.com',
    status: 'idle',
    resultsCount: 0,
  },
  {
    key: 'www.blendermx.com',
    name: 'BlenderMX 模型库',
    url: 'https://www.blendermx.com',
    status: 'idle',
    resultsCount: 0,
  },
]);

const rawResults = ref<Record<string, any[]>>({});

// Simulated steps for scraper progress
const simulatedIntervals = ref<number[]>([]);

function resetSearchState() {
  aiAnalysis.value = '';
  rawResults.value = {};
  searchStep.value = 'idle';
  targetSites.value.forEach((site) => {
    site.status = 'idle';
    site.resultsCount = 0;
  });
  simulatedIntervals.value.forEach(clearInterval);
  simulatedIntervals.value = [];
}

async function handleSearch() {
  const query = searchQuery.value.trim();
  if (!query) {
    ElMessage.warning(label('请输入要搜索的资源名称', 'Please enter a resource name'));
    return;
  }

  isSearching.value = true;
  resetSearchState();
  searchStep.value = 'scraping';

  // Start simulated step-by-step progress for visual aesthetics
  targetSites.value.forEach((site, index) => {
    // Staggered status change to searching
    const startDelay = setTimeout(() => {
      if (searchStep.value === 'scraping') {
        site.status = 'searching';
      }
    }, index * 400);
    simulatedIntervals.value.push(startDelay as any);
  });

  try {
    const { data } = await api.get('/api/resources/search-external', {
      params: { q: query },
    });

    // Move to AI analysis step
    searchStep.value = 'analyzing';
    targetSites.value.forEach((site) => {
      const siteResults = data.results?.[site.key] || [];
      site.resultsCount = siteResults.length;
      site.status = siteResults.length > 0 ? 'success' : 'empty';
    });

    aiAnalysis.value = data.aiAnalysis;
    rawResults.value = data.results || {};
    searchStep.value = 'done';
  } catch (error) {
    searchStep.value = 'idle';
    targetSites.value.forEach((site) => {
      site.status = 'error';
    });
    ElMessage.error(
      getApiErrorMessage(
        error,
        label('搜索失败，请稍后重试', 'Search failed, please try again later'),
      ),
    );
  } finally {
    isSearching.value = false;
    simulatedIntervals.value.forEach(clearInterval);
    simulatedIntervals.value = [];
  }
}

// 用 Set 追踪每个条目的导入状态，避免并发冲突和静默丢弃
const importingLinks = ref<Set<string>>(new Set());
// 用 Set 追踪当前展开选择面板的条目，支持多个独立展开
const activeImportLinks = ref<Set<string>>(new Set());

async function handleImport(item: { title: string; link: string; snippet: string }, type: string) {
  if (importingLinks.value.has(item.link)) return;

  importingLinks.value = new Set([...importingLinks.value, item.link]);
  activeImportLinks.value = new Set([...activeImportLinks.value].filter((l) => l !== item.link));

  const loadingMsg = ElMessage({
    message: label('正在自动分析网页排图并导入...', 'Importing and parsing images...'),
    type: 'info',
    duration: 0,
  });

  try {
    await api.post('/api/resources/import-external', {
      url: item.link,
      title: item.title,
      type,
      snippet: item.snippet,
    });
    loadingMsg.close();
    ElMessage.success(label('导入成功！已存入对应板块的草稿箱中', 'Import success! Saved to drafts.'));
  } catch (error) {
    loadingMsg.close();
    ElMessage.error(
      getApiErrorMessage(
        error,
        label('导入失败，请稍后重试', 'Import failed, please try again'),
      ),
    );
  } finally {
    const next = new Set(importingLinks.value);
    next.delete(item.link);
    importingLinks.value = next;
  }
}

function toggleImportPanel(link: string) {
  const next = new Set(activeImportLinks.value);
  if (next.has(link)) {
    next.delete(link);
  } else {
    next.add(link);
  }
  activeImportLinks.value = next;
}

function handleClose() {
  isOpen.value = false;
  resetSearchState();
}
</script>

<template>
  <Modal
    v-model:show="isOpen"
    :glass-card="true"
    :title="label('全网 3D & Blender 资源 AI 搜索引擎', 'Global 3D & Blender Resource AI Search')"
    size="xl"
    :close-on-outside-click="!isSearching"
    @close="handleClose"
  >
    <div class="flex flex-col gap-5 max-h-[82vh] overflow-y-auto pr-1">
      <!-- Search Bar Section -->
      <div class="flex gap-2.5">
        <div class="relative flex-1">
          <Search
            class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--text-muted)]"
          />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="
              label(
                '输入您想搜索的 3D 模型、工程、材质或插件名称...',
                'Enter the name of 3D models, projects, materials, or add-ons...',
              )
            "
            class="search-input w-full pl-10.5 pr-4 py-2.5 text-sm rounded-xl border border-white/10 bg-white/[0.03] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-indigo-500 focus:bg-white/[0.05] focus:outline-none transition-all"
            :disabled="isSearching"
            @keydown.enter="handleSearch"
          />
        </div>
        <Button
          variant="primary"
          class="!px-6 shrink-0 shadow-lg shadow-indigo-600/10 cursor-pointer"
          :disabled="isSearching || !searchQuery.trim()"
          @click="handleSearch"
        >
          <Loader2 v-if="isSearching" class="w-4 h-4 mr-2 animate-spin" />
          <Sparkles v-else class="w-4 h-4 mr-2" />
          <span>{{ label('AI 搜索', 'AI Search') }}</span>
        </Button>
      </div>

      <!-- Welcome / Idle State -->
      <div
        v-if="searchStep === 'idle'"
        class="welcome-card flex flex-col items-center justify-center py-10 px-6 text-center border border-white/5 bg-white/[0.01] rounded-2xl"
      >
        <div
          class="p-3 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400 mb-4 animate-pulse"
        >
          <Compass class="w-7 h-7" />
        </div>
        <h4 class="text-sm font-bold text-[var(--text-primary)] mb-1">
          {{ label('Blender 全球资源一键检索', 'One-click global resource search') }}
        </h4>
        <p class="text-xs text-[var(--text-muted)] max-w-md leading-relaxed">
          {{
            label(
              '系统将并发搜索 Blender 官方、BlenderX、布的、Superhive、CG营地、BlenderMX 等平台，并利用 AI 智能提炼最佳下载链接与版本匹配。',
              'The system searches official, BlenderX, Budeco, Superhive, GfxCamp, and BlenderMX, extracting optimal download links with AI.',
            )
          }}
        </p>
      </div>

      <!-- Loading / Progress State -->
      <div
        v-if="searchStep === 'scraping' || searchStep === 'analyzing'"
        class="flex flex-col md:flex-row gap-5 p-5 border border-indigo-500/10 bg-indigo-500/[0.02] rounded-2xl animate-fade-in"
      >
        <!-- Stepper list -->
        <div class="flex-1 flex flex-col gap-3">
          <h4 class="text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
            {{ label('多源站点并发抓取中...', 'Scraping target websites...') }}
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
              v-for="site in targetSites"
              :key="site.key"
              class="flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300"
              :class="
                site.status === 'searching'
                  ? 'bg-amber-500/[0.03] border-amber-500/20'
                  : site.status === 'success'
                    ? 'bg-emerald-500/[0.03] border-emerald-500/20'
                    : site.status === 'empty'
                      ? 'bg-white/[0.01] border-white/5'
                      : 'bg-white/[0.01] border-white/5 opacity-50'
              "
            >
              <div class="flex items-center gap-2 min-w-0">
                <Globe
                  class="w-3.5 h-3.5"
                  :class="
                    site.status === 'searching'
                      ? 'text-amber-400 animate-pulse'
                      : site.status === 'success'
                        ? 'text-emerald-400'
                        : 'text-[var(--text-muted)]'
                  "
                />
                <span class="text-xs font-medium truncate text-[var(--text-secondary)]">{{
                  site.name
                }}</span>
              </div>
              <div class="flex items-center">
                <Loader2
                  v-if="site.status === 'searching'"
                  class="w-3.5 h-3.5 text-amber-500 animate-spin"
                />
                <CheckCircle2
                  v-else-if="site.status === 'success'"
                  class="w-3.5 h-3.5 text-emerald-400"
                />
                <CheckCircle2
                  v-else-if="site.status === 'empty'"
                  class="w-3.5 h-3.5 text-gray-500/60"
                />
                <AlertCircle
                  v-else-if="site.status === 'error'"
                  class="w-3.5 h-3.5 text-rose-500"
                />
                <span v-else class="text-[10px] text-[var(--text-muted)] font-mono">等待中</span>
              </div>
            </div>
          </div>
        </div>

        <!-- AI status panel -->
        <div
          class="md:w-60 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-5 flex flex-col justify-center items-center text-center"
        >
          <div
            class="p-3.5 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400 mb-3"
            :class="{ 'animate-spin': searchStep === 'analyzing' }"
          >
            <RefreshCw class="w-5 h-5" />
          </div>
          <span class="text-xs font-bold text-[var(--text-primary)]">
            {{
              searchStep === 'scraping'
                ? label('数据抓取与对齐中...', 'Aligning results...')
                : label('AI 智能决策与分析中...', 'AI Thinking...')
            }}
          </span>
          <span class="text-[10px] text-[var(--text-muted)] mt-1 max-w-[180px]">
            {{
              searchStep === 'scraping'
                ? label('正在解析各站的标题、说明与链接', 'Parsing links, tags, and titles')
                : label('正在优选资源版本并撰写推荐说明', 'Curating matching items...')
            }}
          </span>
        </div>
      </div>

      <!-- Search Results Area -->
      <div v-if="searchStep === 'done'" class="flex flex-col gap-4 animate-fade-in">
        <!-- AI Summary Card -->
        <div
          class="ai-summary-card border border-indigo-500/10 rounded-2xl overflow-hidden shadow-sm"
        >
          <div
            class="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-indigo-500/[0.03]"
          >
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-indigo-400" />
              <h4 class="text-xs font-bold text-[var(--text-primary)]">AI 推荐与提炼结论</h4>
            </div>
            <span
              class="text-[10px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full font-mono"
            >
              关键词: {{ searchQuery }}
            </span>
          </div>
          <div class="p-4 md:p-5 markdown-container text-xs">
            <MdPreview
              :model-value="aiAnalysis"
              :theme="isDark ? 'dark' : 'light'"
              class="!bg-transparent !text-[var(--text-secondary)] !text-xs dark:invert-preview"
            />
          </div>
        </div>

        <!-- Direct Result Lists (grouped by site) -->
        <div class="flex flex-col gap-3">
          <h4
            class="text-xs font-bold text-[var(--text-primary)] border-l-2 border-indigo-500 pl-2"
          >
            原始检索详情
          </h4>
          <div class="flex flex-col gap-2">
            <template v-for="site in targetSites" :key="site.key">
              <div
                v-if="site.resultsCount > 0"
                class="site-results-group border border-white/5 bg-white/[0.01] rounded-xl overflow-hidden"
              >
                <div
                  class="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-white/5"
                >
                  <div class="flex items-center gap-2">
                    <Globe class="w-3.5 h-3.5 text-indigo-400" />
                    <span class="text-xs font-bold text-[var(--text-primary)]">{{
                      site.name
                    }}</span>
                  </div>
                  <span class="text-[10px] text-[var(--text-muted)] font-mono"
                    >找到 {{ site.resultsCount }} 个资源</span
                  >
                </div>
                <div class="divide-y divide-white/5 max-h-48 overflow-y-auto">
                  <div
                    v-for="(item, idx) in rawResults[site.key]"
                    :key="idx"
                    class="p-3 flex items-start justify-between gap-4 hover:bg-white/[0.01] transition-colors"
                  >
                    <div class="min-w-0 flex-1">
                      <h5 class="text-xs font-semibold text-[var(--text-secondary)] truncate">
                        {{ item.title }}
                      </h5>
                      <p class="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-1">
                        {{ item.snippet || '暂无详细描述。' }}
                      </p>
                    </div>
                    <!-- 正在导入：显示加载态 -->
                    <div v-if="importingLinks.has(item.link)" class="flex items-center gap-1.5 shrink-0 text-[10px] text-amber-400">
                      <Loader2 class="w-3 h-3 animate-spin" />
                      <span>导入中...</span>
                    </div>
                    <!-- 展开目标选择面板 -->
                    <div v-else-if="activeImportLinks.has(item.link)" class="flex items-center gap-2 shrink-0 text-[10px]">
                      <span class="text-[var(--text-muted)]">导入至:</span>
                      <button
                        type="button"
                        class="text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                        @click="handleImport(item, 'asset')"
                      >
                        资产库
                      </button>
                      <span class="text-white/10">|</span>
                      <button
                        type="button"
                        class="text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                        @click="handleImport(item, 'material')"
                      >
                        材质库
                      </button>
                      <span class="text-white/10">|</span>
                      <button
                        type="button"
                        class="text-blue-400 hover:text-blue-300 font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                        @click="handleImport(item, 'plugin')"
                      >
                        插件库
                      </button>
                      <span class="text-white/10">|</span>
                      <button
                        type="button"
                        class="text-rose-400 hover:text-rose-300 font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                        @click="toggleImportPanel(item.link)"
                      >
                        取消
                      </button>
                    </div>
                    <!-- 默认状态 -->
                    <div v-else class="flex items-center gap-3 shrink-0">
                      <a
                        :href="item.link"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5 hover:underline"
                      >
                        <span>打开链接</span>
                        <ExternalLink class="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        class="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 cursor-pointer hover:underline bg-transparent border-none p-0"
                        @click="toggleImportPanel(item.link)"
                      >
                        <span>一键导入</span>
                        <DownloadCloud class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Permanent site link list at the bottom -->
      <div class="mt-2 border-t border-white/5 pt-4">
        <h4 class="text-xs font-bold text-[var(--text-primary)] mb-3 flex items-center gap-1.5">
          <Compass class="w-4 h-4 text-indigo-400" />
          <span>直接访问源站</span>
        </h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <a
            v-for="site in targetSites"
            :key="site.key"
            :href="site.url"
            target="_blank"
            rel="noopener noreferrer"
            class="site-card group p-3 flex flex-col items-center justify-center text-center rounded-xl border border-white/5 bg-white/[0.02] hover:bg-indigo-600/[0.03] hover:border-indigo-500/25 transition-all duration-200"
          >
            <div
              class="w-8 h-8 rounded-full bg-white/[0.03] group-hover:bg-indigo-500/10 flex items-center justify-center text-[var(--text-muted)] group-hover:text-indigo-400 transition-colors mb-2"
            >
              <Globe class="w-4 h-4" />
            </div>
            <span
              class="text-[10px] font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate w-full"
              >{{ site.name }}</span
            >
            <div
              class="flex items-center gap-0.5 text-[9px] text-[var(--text-muted)] group-hover:text-indigo-400 mt-1 opacity-0 group-hover:opacity-100 transition-all duration-200"
            >
              <span>立即跳转</span>
              <ArrowRight class="w-2.5 h-2.5" />
            </div>
          </a>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.search-input {
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.search-input:focus {
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.2),
    0 0 0 2px rgba(99, 102, 241, 0.15);
}

.site-card {
  box-sizing: border-box;
}

.site-results-group {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.ai-summary-card {
  background-color: rgba(99, 102, 241, 0.02) !important;
}

.dark .ai-summary-card {
  background-color: rgba(0, 0, 0, 0.45) !important;
  border-color: rgba(99, 102, 241, 0.15) !important;
}

.markdown-container :deep(.md-editor-preview),
.markdown-container :deep(.md-preview),
.markdown-container :deep(.mdw__preview-only) {
  padding: 0 !important;
  font-size: 0.775rem !important;
  color: var(--text-secondary) !important;
}

.markdown-container :deep(.md-preview p) {
  margin-bottom: 8px !important;
  line-height: 1.6 !important;
}

.markdown-container :deep(.md-preview ul),
.markdown-container :deep(.md-preview ol) {
  margin-top: 4px !important;
  margin-bottom: 8px !important;
  padding-left: 16px !important;
}

.markdown-container :deep(.md-preview li) {
  margin-bottom: 4px !important;
}

.markdown-container :deep(.md-preview a) {
  color: #818cf8 !important;
  text-decoration: underline !important;
  font-weight: 600 !important;
}

.markdown-container :deep(.md-preview a:hover) {
  color: #c7d2fe !important;
}

.markdown-container :deep(.md-preview h1),
.markdown-container :deep(.md-preview h2),
.markdown-container :deep(.md-preview h3) {
  color: var(--text-primary) !important;
  font-weight: 700 !important;
  margin-top: 12px !important;
  margin-bottom: 6px !important;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

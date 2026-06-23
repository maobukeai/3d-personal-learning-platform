<script setup lang="ts">
import { type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  BarChart3,
  CalendarClock,
  Tags,
  Download,
  Box,
  Layers,
  Sun,
  Bone,
  Import,
  Package,
} from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import { formatCompactNumber, formatRelativeTime } from '../resourceUtils';

const CATEGORY_ALL = '全部插件';
const CATEGORY_OTHER = '其他工具';

interface PluginUser {
  id?: string;
  name?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}

interface PluginItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  version: string;
  compatibility: string;
  downloads: number;
  fileUrl?: string | null;
  fileSize?: number | null;
  previewUrl?: string | null;
  installGuide: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  createdAt: string;
  user?: PluginUser | null;
}

interface StarterPluginTemplate {
  title: string;
  description: string;
  category: string;
  compatibility: string;
  tags: string[];
  packageType: string;
  Icon: Component;
  tone: string;
}

interface SideCategory {
  name: string;
  count: number;
  downloads: number;
}

const props = defineProps<{
  topDownloadPlugins: PluginItem[];
  latestPlugins: PluginItem[];
  sideCategories: SideCategory[];
  starterTemplates: StarterPluginTemplate[];
}>();

const emit = defineEmits<{
  (e: 'openDetail', plugin: PluginItem): void;
  (e: 'startFromTemplate', template: StarterPluginTemplate): void;
  (e: 'setCategory', category: string): void;
}>();

const label = useLabel();
const { locale } = useI18n();

const categoryLabel = (category?: string | null) => {
  const normalized = category || CATEGORY_OTHER;
  const englishLabels: Record<string, string> = {
    [CATEGORY_ALL]: 'All Add-ons',
    [CATEGORY_OTHER]: 'Other Utilities',
    建模: 'Modeling',
    材质与纹理: 'Materials & Texturing',
    渲染与灯光: 'Rendering & Lighting',
    动画与骨骼: 'Animation & Rigging',
    导入与导出: 'Import & Export',
    物理与特效: 'Physics & FX',
  };
  return locale.value === 'en-US' ? englishLabels[normalized] || normalized : normalized;
};

const getCategoryIcon = (category: string): Component => {
  if (category.includes('建模')) return Box;
  if (category.includes('材质')) return Layers;
  if (category.includes('渲染')) return Sun;
  if (category.includes('骨骼')) return Bone;
  if (category.includes('导入')) return Import;
  return Package;
};

const getCategoryTone = (category: string) => {
  if (category === '建模') return 'tone-orange';
  if (category === '材质与纹理') return 'tone-rose';
  if (category === '渲染与灯光') return 'tone-blue';
  if (category === '动画与骨骼') return 'tone-cyan';
  if (category === '导入与导出') return 'tone-emerald';
  if (category === '物理与特效') return 'tone-violet';
  return 'tone-slate';
};
</script>

<template>
  <aside class="insight-panel">
    <section class="side-section">
      <div class="side-title">
        <BarChart3 class="icon-sm" />
        {{ label('下载榜', 'Top Downloads') }}
      </div>
      <button
        v-for="(plugin, index) in topDownloadPlugins"
        :key="plugin.id"
        type="button"
        class="rank-item"
        @click="emit('openDetail', plugin)"
      >
        <span class="rank-badge" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
        <span class="rank-icon" :class="getCategoryTone(plugin.category)">
          <component :is="getCategoryIcon(plugin.category)" class="icon-sm" />
        </span>
        <span class="rank-title">{{ plugin.title }}</span>
        <strong class="rank-value">{{ formatCompactNumber(plugin.downloads) }}</strong>
      </button>
      <div v-if="!topDownloadPlugins.length" class="side-placeholder">
        <Download class="icon-sm" />
        <span>{{
          label(
            '下载榜会在插件产生下载后自动生成',
            'Top downloads appear after plugins get downloads',
          )
        }}</span>
      </div>
    </section>

    <section class="side-section">
      <div class="side-title">
        <CalendarClock class="icon-sm" />
        {{ label('最新插件', 'Latest Plugins') }}
      </div>
      <button
        v-for="plugin in latestPlugins"
        :key="plugin.id"
        type="button"
        class="activity-item"
        @click="emit('openDetail', plugin)"
      >
        <span>{{ plugin.title }}</span>
        <small>{{ formatRelativeTime(plugin.createdAt) }}</small>
      </button>
      <button
        v-for="template in !latestPlugins.length ? starterTemplates.slice(0, 3) : []"
        :key="template.title"
        type="button"
        class="activity-item template-activity"
        @click="emit('startFromTemplate', template)"
      >
        <span>{{ template.title }}</span>
        <small>{{ template.compatibility }}</small>
      </button>
    </section>

    <section class="side-section">
      <div class="side-title">
        <Tags class="icon-sm" />
        {{ label('分类热度', 'Category Heat') }}
      </div>
      <button
        v-for="category in sideCategories"
        :key="category.name"
        type="button"
        class="category-rank"
        @click="emit('setCategory', category.name)"
      >
        <span>{{ categoryLabel(category.name) }}</span>
        <strong>{{ category.count }}</strong>
      </button>
    </section>
  </aside>
</template>

<style scoped>
.insight-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.side-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
}

.side-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 4px;
}

.side-title svg {
  color: var(--accent);
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.rank-item,
.activity-item,
.category-rank {
  display: flex;
  align-items: center;
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 5px 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.rank-item:hover,
.activity-item:hover,
.category-rank:hover {
  background: var(--bg-hover);
}

.side-section > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.rank-item {
  display: grid;
  grid-template-columns: 18px 24px minmax(0, 1fr) auto;
  gap: 6px;
}

.rank-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: #fff;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.rank-badge.rank-1 {
  background: #f59e0b;
  color: #fff;
}

.rank-badge.rank-2 {
  background: #94a3b8;
  color: #fff;
}

.rank-badge.rank-3 {
  background: #a16207;
  color: #fff;
}

.rank-badge:not(.rank-1):not(.rank-2):not(.rank-3) {
  background: var(--bg-app);
  color: var(--text-muted);
}

.rank-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-value {
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.activity-item span {
  font-weight: 500;
  font-size: 11px;
}

.activity-item small {
  color: var(--text-muted);
  font-size: 10px;
}

.category-rank {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-rank span {
  font-weight: 500;
  font-size: 11px;
}

.category-rank strong {
  color: var(--accent);
  font-size: 11px;
}

.side-placeholder {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  min-height: 44px;
  border: 1px dashed var(--border-base);
  border-radius: 6px;
  color: var(--text-muted);
  padding: 6px;
  font-size: 10px;
  font-weight: 500;
}

.template-activity small {
  color: var(--accent);
}

.tone-orange {
  background: linear-gradient(135deg, #f97316, #7c2d12);
}

.tone-blue {
  background: linear-gradient(135deg, #2563eb, #172554);
}

.tone-rose {
  background: linear-gradient(135deg, #e11d48, #4c0519);
}

.tone-cyan {
  background: linear-gradient(135deg, #0891b2, #164e63);
}

.tone-emerald {
  background: linear-gradient(135deg, #059669, #064e3b);
}

.tone-violet {
  background: linear-gradient(135deg, #7c3aed, #312e81);
}

.tone-slate {
  background: linear-gradient(135deg, #475569, #0f172a);
}

@media (max-width: 920px) {
  .insight-panel {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .insight-panel {
    grid-template-columns: 1fr;
  }
}
</style>

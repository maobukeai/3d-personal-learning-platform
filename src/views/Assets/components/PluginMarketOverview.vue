<script setup lang="ts">
import { type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { Puzzle, Star, Box, Layers, Sun, Bone, Import, Package } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import { formatCompactNumber } from '../resourceUtils';

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

interface MarketplaceSignal {
  title: string;
  description: string;
  Icon: Component;
}

defineProps<{
  isVisible: boolean;
  spotlightPlugin: PluginItem | null;
  starterTemplates: StarterPluginTemplate[];
  marketplaceSignals: MarketplaceSignal[];
}>();

const emit = defineEmits<{
  (e: 'openDetail', plugin: PluginItem): void;
  (e: 'startFromTemplate', template: StarterPluginTemplate): void;
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
  <section v-show="isVisible" class="market-overview">
    <div class="overview-copy">
      <div class="eyebrow market-eyebrow">
        <Puzzle class="icon-sm" />
        {{ label('Blender 插件中心', 'Blender Add-on Hub') }}
      </div>
      <h2>
        {{
          label(
            '把 Python 脚本、插件和工具包集中上架',
            'Ship Python scripts, add-ons, and toolkits in one catalog',
          )
        }}
      </h2>
      <p>
        {{
          label(
            '按宿主软件、兼容版本、标签和安装说明浏览，让插件像应用商店一样可发现、可维护。',
            'Browse by host app, compatibility, tags, and install guides so plugins feel discoverable and maintainable.',
          )
        }}
      </p>
      <div class="format-strip" :aria-label="label('支持的插件格式', 'Supported plugin formats')">
        <span>ZIP</span>
        <span>PY</span>
      </div>
    </div>

    <div class="spotlight-panel">
      <div class="side-title">
        <Star class="icon-sm" />
        {{
          spotlightPlugin
            ? label('当前推荐', 'Spotlight')
            : label('插件卡片预览', 'Plugin Card Preview')
        }}
      </div>
      <button
        v-if="spotlightPlugin"
        type="button"
        class="spotlight-row"
        @click="emit('openDetail', spotlightPlugin)"
      >
        <span class="spotlight-icon" :class="getCategoryTone(spotlightPlugin.category)">
          <component :is="getCategoryIcon(spotlightPlugin.category)" class="icon-sm" />
        </span>
        <span>
          <strong>{{ spotlightPlugin.title }}</strong>
          <small
            >{{ categoryLabel(spotlightPlugin.category) }} · v{{ spotlightPlugin.version }}</small
          >
        </span>
        <b>{{ formatCompactNumber(spotlightPlugin.downloads) }}</b>
      </button>
      <button
        v-else
        type="button"
        class="spotlight-row"
        @click="emit('startFromTemplate', starterTemplates[0])"
      >
        <span class="spotlight-icon tone-orange">
          <Box class="icon-sm" />
        </span>
        <span>
          <strong>{{ starterTemplates[0].title }}</strong>
          <small
            >{{ starterTemplates[0].compatibility }} · {{ starterTemplates[0].packageType }}</small
          >
        </span>
        <b>{{ label('模板', 'Template') }}</b>
      </button>
    </div>

    <div class="signal-stack">
      <div v-for="signal in marketplaceSignals" :key="signal.title" class="signal-item">
        <span class="signal-icon">
          <component :is="signal.Icon" class="icon-sm" />
        </span>
        <span>
          <strong>{{ signal.title }}</strong>
          <small>{{ signal.description }}</small>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.market-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.75fr) minmax(250px, 0.8fr);
  gap: 10px;
  margin-bottom: 10px;
}

.overview-copy,
.spotlight-panel,
.signal-item {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.overview-copy {
  min-height: 100px;
  padding: 10px 14px;
  background:
    linear-gradient(
      135deg,
      rgba(37, 99, 235, 0.06),
      rgba(20, 184, 166, 0.05) 55%,
      rgba(249, 115, 22, 0.05)
    ),
    var(--bg-card);
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #0f766e;
  font-size: 10px;
  font-weight: 600;
  margin-bottom: 4px;
}

.market-eyebrow {
  color: var(--accent);
}

.overview-copy h2 {
  max-width: 760px;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.overview-copy p {
  max-width: 760px;
  line-height: 1.4;
  font-size: 11px;
  margin-top: 3px;
  color: var(--text-secondary);
}

.format-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.format-strip span {
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: #1d4ed8;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 600;
}

.dark .format-strip span {
  background: rgba(15, 23, 42, 0.6);
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.2);
}

.spotlight-panel {
  display: grid;
  align-content: start;
  gap: 6px;
  min-height: 100px;
  padding: 8px;
}

.spotlight-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  width: 100%;
  min-height: 48px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-hover);
  color: var(--text-primary);
  padding: 6px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.spotlight-row:hover {
  border-color: var(--accent);
  background: var(--accent-subtle);
  transform: translateY(-0.5px);
}

.spotlight-icon,
.signal-icon {
  display: grid;
  place-items: center;
  color: #fff;
  border-radius: 6px;
}

.spotlight-icon {
  width: 24px;
  height: 24px;
}

.spotlight-row strong,
.signal-item strong {
  display: block;
  overflow: hidden;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spotlight-row strong {
  font-size: 12px;
  font-weight: 600;
}

.spotlight-row small,
.signal-item small {
  display: block;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spotlight-row b {
  color: var(--accent);
  font-size: 11px;
}

.signal-stack {
  display: grid;
  gap: 6px;
}

.signal-item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 4px 6px;
}

.signal-item strong {
  font-size: 11px;
  font-weight: 600;
}

.signal-icon {
  width: 24px;
  height: 24px;
  background: #0f766e;
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

@media (max-width: 1180px) {
  .market-overview {
    grid-template-columns: 1fr 1fr;
  }

  .overview-copy {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .market-overview {
    grid-template-columns: 1fr;
  }
}
</style>

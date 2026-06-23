<script setup lang="ts">
import { type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { Heart, Download, Box, Layers, Sun, Bone, Import, Package } from 'lucide-vue-next';
import { formatDate } from '@/utils/format';
import { useLabel } from '@/utils/i18n';
import { getAssetUrl } from '@/utils/api';
import Modal from '@/components/ui/Modal.vue';

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

const props = defineProps<{
  show: boolean;
  plugin: PluginItem | null;
  isFavorited: boolean;
  isDownloading: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'favorite'): void;
  (e: 'download'): void;
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

const formatSize = (size?: number | null) => {
  if (!size) return label('未知大小', 'Unknown size');
  if (size >= 1) return `${size.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size * 1024))} KB`;
};

const getTagsList = (tags?: string) =>
  (tags || '')
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);
</script>

<template>
  <Modal :show="show && !!plugin" size="lg" glass-card @close="emit('close')">
    <div v-if="plugin">
      <div class="detail-hero" :class="getCategoryTone(plugin.category)">
        <img v-if="plugin.previewUrl" :src="getAssetUrl(plugin.previewUrl)" :alt="plugin.title" />
        <component :is="getCategoryIcon(plugin.category)" v-else class="preview-icon" />
      </div>

      <div class="detail-body">
        <div class="meta-row">
          <span class="category-pill">{{ categoryLabel(plugin.category) }}</span>
          <span class="version-pill">v{{ plugin.version }}</span>
        </div>
        <h2>{{ plugin.title }}</h2>
        <p>
          {{ plugin.description || label('作者暂未填写简介。', 'No plugin description yet.') }}
        </p>

        <dl class="detail-grid">
          <div>
            <dt>{{ label('兼容版本', 'Compatible With') }}</dt>
            <dd>{{ plugin.compatibility }}</dd>
          </div>
          <div>
            <dt>{{ label('文件大小', 'File Size') }}</dt>
            <dd>{{ formatSize(plugin.fileSize) }}</dd>
          </div>
          <div>
            <dt>{{ label('发布时间', 'Published') }}</dt>
            <dd>{{ formatDate(plugin.createdAt) }}</dd>
          </div>
          <div>
            <dt>{{ label('下载次数', 'Downloads') }}</dt>
            <dd>{{ plugin.downloads }}</dd>
          </div>
        </dl>

        <div class="tag-row detail-tags">
          <span v-for="tag in getTagsList(plugin.tags)" :key="tag">#{{ tag }}</span>
        </div>

        <section class="install-box">
          <h3>{{ label('安装说明', 'Installation Guide') }}</h3>
          <p>{{ plugin.installGuide }}</p>
        </section>
      </div>
    </div>

    <template #footer>
      <div v-if="plugin" class="flex justify-end gap-2 w-full">
        <Button
          variant="secondary"
          size="sm"
          :class="{ active: isFavorited }"
          @click="emit('favorite')"
        >
          <Heart class="icon-sm inline mr-1" :class="{ filled: isFavorited }" />
          {{ isFavorited ? label('已收藏', 'Saved') : label('收藏', 'Save') }}
        </Button>
        <Button variant="primary" size="sm" :loading="isDownloading" @click="emit('download')">
          <Download v-if="!isDownloading" class="icon-sm inline mr-1" />
          {{ label('下载插件', 'Download Plugin') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.detail-hero {
  height: 180px;
  display: grid;
  place-items: center;
}

.detail-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.preview-icon {
  width: 32px;
  height: 32px;
  color: rgba(255, 255, 255, 0.85);
}

.detail-body {
  padding: 16px;
}

.detail-body h2 {
  margin-top: 10px;
  font-size: 18px;
  font-weight: 700;
}

.detail-body > p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.meta-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.category-pill,
.version-pill {
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 600;
}

.category-pill {
  color: var(--accent);
  background: var(--accent-subtle);
}

.version-pill {
  color: #0f766e;
  background: rgba(20, 184, 166, 0.08);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0 0;
}

.detail-grid div,
.install-box {
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-hover);
  padding: 8px 10px;
}

.detail-grid dt {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
}

.detail-grid dd {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 600;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 18px;
  margin-top: 6px;
}

.tag-row span {
  border-radius: 4px;
  padding: 1px 5px;
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 500;
}

.detail-tags {
  margin-top: 10px;
}

.install-box {
  margin-top: 12px;
}

.install-box h3 {
  font-size: 12px;
  font-weight: 600;
}

.install-box p {
  margin-top: 6px;
  white-space: pre-wrap;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.filled {
  color: #e11d48;
  fill: #e11d48;
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

@media (max-width: 760px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>

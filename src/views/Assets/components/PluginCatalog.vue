<script setup lang="ts">
import { Cpu, Plus, RefreshCw } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import UnifiedCard from '@/components/UnifiedCard.vue';
import SkeletonGrid from '@/components/SkeletonGrid.vue';

type LibraryTab = 'explore' | 'favorites' | 'mine';
type PluginStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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
  status: PluginStatus;
  rejectReason?: string | null;
  createdAt: string;
  user?: PluginUser | null;
}

const props = defineProps<{
  plugins: PluginItem[];
  isLoading: boolean;
  viewMode: 'grid' | 'list';
  activeTab: LibraryTab;
  favoritedIds: string[];
  downloadingIds: Record<string, boolean>;
}>();

const emit = defineEmits<{
  (e: 'openDetail', plugin: PluginItem): void;
  (e: 'toggleFavorite', pluginId: string, event?: Event): void;
  (e: 'download', plugin: PluginItem, event?: Event): void;
  (e: 'resetFilters'): void;
  (e: 'upload'): void;
}>();

const label = useLabel();

const isFavorited = (pluginId: string) => props.favoritedIds.includes(pluginId);
</script>

<template>
  <main class="plugin-content">
    <div class="library-heading mobile-row">
      <div>
        <strong>{{ label('插件列表', 'Plugin Catalog') }}</strong>
        <span>
          {{
            plugins.length
              ? label(`当前显示 ${plugins.length} 个插件`, `${plugins.length} plugins shown`)
              : label(
                  '浏览插件模板或上传你的第一个插件',
                  'Browse plugin templates or publish the first plugin',
                )
          }}
        </span>
      </div>
      <button type="button" class="text-button" @click="emit('resetFilters')">
        {{ label('重置筛选', 'Reset Filters') }}
      </button>
    </div>

    <SkeletonGrid v-if="isLoading" :count="8" :columns="viewMode === 'list' ? 1 : 4" compact />

    <div
      v-else-if="plugins.length"
      :class="viewMode === 'list' ? 'flex flex-col gap-3' : 'plugin-grid'"
    >
      <UnifiedCard
        v-for="plugin in plugins"
        :key="plugin.id"
        :item="plugin"
        kind="plugin"
        :view-mode="viewMode"
        :is-favorited="isFavorited(plugin.id)"
        :downloading="!!downloadingIds[plugin.id]"
        :active-tab="activeTab"
        @click="emit('openDetail', plugin)"
        @like="(item, event) => emit('toggleFavorite', plugin.id, event)"
        @download="(item, event) => emit('download', plugin, event)"
      />
    </div>

    <div v-else class="starter-market">
      <div class="empty-state">
        <Cpu class="empty-icon" />
        <h2>{{ label('还没有匹配的插件', 'No Matching Plugins') }}</h2>
        <p>
          {{
            label(
              '可以调整筛选条件，也可以从下面的插件方向开始发布。',
              'Adjust filters or start publishing from one of the plugin directions below.',
            )
          }}
        </p>
        <div class="empty-actions">
          <button type="button" class="primary-button" @click="emit('upload')">
            <Plus class="icon-sm" />
            {{ label('上传插件', 'Upload Plugin') }}
          </button>
          <button type="button" class="ghost-button" @click="emit('resetFilters')">
            <RefreshCw class="icon-sm" />
            {{ label('查看全部', 'Show All') }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.plugin-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.library-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.library-heading strong {
  font-size: 13px;
  font-weight: 600;
}

.library-heading span {
  display: block;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-button {
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  border-radius: 6px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  border-color: transparent;
  background: transparent;
  color: var(--accent);
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.starter-market {
  display: grid;
  grid-template-columns: minmax(220px, 0.65fr) minmax(0, 1.35fr);
  gap: 10px;
  align-items: stretch;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  padding: 16px 20px;
  text-align: center;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.empty-icon {
  width: 32px;
  height: 32px;
  color: var(--accent);
  opacity: 0.45;
  margin-bottom: 8px;
}

.empty-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.primary-button,
.ghost-button {
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  border-radius: 6px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-base);
}

.primary-button {
  border-color: transparent;
  background: var(--accent);
  color: white;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
}

.primary-button:hover {
  background: var(--accent-hover);
  transform: translateY(-0.5px);
}

.ghost-button {
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.icon-sm {
  width: 14px;
  height: 14px;
}

@media (max-width: 760px) {
  .library-heading {
    flex-direction: column;
    align-items: stretch;
  }

  .starter-market {
    grid-template-columns: 1fr;
  }
}
</style>

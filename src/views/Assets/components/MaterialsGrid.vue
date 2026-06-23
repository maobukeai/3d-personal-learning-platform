<script setup lang="ts">
import { computed } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import UnifiedCard from '@/components/UnifiedCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import SkeletonGrid from '@/components/SkeletonGrid.vue';

type ViewMode = 'grid' | 'list';
type LibraryTab = 'explore' | 'favorites' | 'mine';
type MaterialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface MaterialUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface NormalizedMaterial {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  preview: string;
  downloads: number;
  fileSize: number;
  resolution: string;
  favorites: number;
  isProcedural?: boolean;
  status?: MaterialStatus;
  rejectReason?: string | null;
  userId?: string;
  isFavorited?: boolean;
  _count?: { favorites?: number };
  user?: MaterialUser | null;
  createdAt?: string;
}

const props = defineProps<{
  isLoading: boolean;
  viewMode: ViewMode;
  materials: NormalizedMaterial[];
  selectedIds: string[];
  activeTab: LibraryTab;
  emptyTitle: string;
  emptyBody: string;
}>();

const emit = defineEmits<{
  (e: 'openDetail', material: NormalizedMaterial): void;
  (e: 'toggleSelect', id: string, event?: Event): void;
  (e: 'toggleFavorite', material: NormalizedMaterial, event?: Event): void;
  (e: 'download', material: NormalizedMaterial, event?: Event): void;
  (e: 'create'): void;
}>();

const label = useLabel();

const selectedIdSet = computed(() => new Set(props.selectedIds));
</script>

<template>
  <main class="asset-area">
    <SkeletonGrid v-if="isLoading" :count="12" :columns="viewMode === 'list' ? 1 : 4" compact />

    <div v-else-if="materials.length" class="material-grid" :class="viewMode">
      <UnifiedCard
        v-for="material in materials"
        :key="material.id"
        :item="material"
        kind="material"
        :view-mode="viewMode"
        :is-selected="selectedIdSet.has(material.id)"
        :is-favorited="material.isFavorited"
        :active-tab="activeTab"
        @click="emit('openDetail', material)"
        @select="(_item, event) => emit('toggleSelect', material.id, event)"
        @like="(_item, event) => emit('toggleFavorite', material, event)"
        @download="(_item, event) => emit('download', material, event)"
      />
    </div>

    <EmptyState
      v-else
      :icon="Sparkles"
      :title="emptyTitle"
      :description="emptyBody"
      :action-text="label('上传材质', 'Upload Material')"
      @action="emit('create')"
    />
  </main>
</template>

<style scoped>
.asset-area {
  min-width: 0;
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  min-height: 200px;
}

.material-grid.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 560px) {
  .material-grid.grid {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { MonitorPlay, ChevronRight } from 'lucide-vue-next';
import UnifiedCard from '@/components/UnifiedCard.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import SkeletonGrid from '@/components/SkeletonGrid.vue';
import type { ShowcaseItem } from './showcaseTypes';

defineProps<{
  showcases: ShowcaseItem[];
  viewMode: 'grid' | 'list';
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
}>();

const emit = defineEmits<{
  (e: 'open-detail', item: ShowcaseItem): void;
  (e: 'toggle-like', item: ShowcaseItem): void;
  (e: 'share', item: ShowcaseItem): void;
  (e: 'user-click', userId: string): void;
  (e: 'load-more'): void;
  (e: 'publish'): void;
}>();
</script>

<template>
  <section v-if="isLoading" class="mobile-adaptive" style="margin-top: 14px">
    <SkeletonGrid :count="12" :columns="viewMode === 'list' ? 1 : 4" compact />
  </section>

  <section
    v-else-if="showcases.length"
    :class="viewMode === 'list' ? 'flex flex-col gap-3' : 'showcase-grid'"
    class="mobile-adaptive"
  >
    <UnifiedCard
      v-for="item in showcases"
      :key="item.id"
      :item="item"
      kind="showcase"
      :view-mode="viewMode"
      @click="emit('open-detail', item)"
      @like="emit('toggle-like', item)"
      @share="emit('share', item)"
      @user-click="emit('user-click', $event)"
    />
  </section>

  <EmptyState
    v-else
    class="mobile-adaptive"
    style="margin-top: 10px"
    :icon="MonitorPlay"
    title="还没有找到作品"
    description="换一个关键词或类型筛选，也可以现在发布一个作品把这里点亮。"
    action-text="发布作品"
    @action="emit('publish')"
  />

  <div v-if="hasMore && !isLoading" class="load-more-row mobile-row">
    <Button
      variant="secondary"
      :loading="isLoadingMore"
      :icon="ChevronRight"
      icon-position="left"
      class="hover:scale-105 transition-all !rounded-xl"
      @click="emit('load-more')"
    >
      加载更多作品
    </Button>
  </div>
</template>

<style scoped>
.showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 14px;
  padding-bottom: 22px;
}

@media (max-width: 767px) {
  .showcase-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 375px) {
  .showcase-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .showcase-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .showcase-grid {
    grid-template-columns: 1fr;
  }
}

.load-more-row button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  color: white;
  background: var(--accent);
  font-size: 13px;
  font-weight: 900;
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding: 4px 0 22px;
}
</style>

<script setup lang="ts">
import { Package, Download, Heart, Tags } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import { formatCompactNumber } from '../resourceUtils';

defineProps<{
  total: number;
  downloads: number;
  favorites: number;
  categories: number;
  isVisible: boolean;
}>();

const label = useLabel();
</script>

<template>
  <section v-show="isVisible" class="stats-strip">
    <div class="stat">
      <span><Package class="icon-sm" />{{ label('插件总数', 'Plugins') }}</span>
      <strong>{{ total }}</strong>
    </div>
    <div class="stat">
      <span><Download class="icon-sm" />{{ label('总下载', 'Downloads') }}</span>
      <strong>{{ formatCompactNumber(downloads) }}</strong>
    </div>
    <div class="stat">
      <span><Heart class="icon-sm" />{{ label('已收藏', 'Saved') }}</span>
      <strong>{{ favorites }}</strong>
    </div>
    <div class="stat">
      <span><Tags class="icon-sm" />{{ label('分类', 'Categories') }}</span>
      <strong>{{ categories }}</strong>
    </div>
  </section>
</template>

<style scoped>
.stats-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 36px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 4px 10px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  transition: all 0.15s ease;
}

.stat:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
  box-shadow: var(--shadow-card-hover);
}

.stat span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.stat strong {
  display: block;
  font-size: 15px;
  font-weight: 700;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

@media (max-width: 760px) {
  .stats-strip {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { ArrowDownToLine, Cpu, Eye, Flame, Layers, PackageCheck, Tags } from 'lucide-vue-next';
import {
  formatResourceNumber as formatNumber,
  getResourceStatusLabel as getStatusLabel,
  type ResourceItem,
  type ResourceKind,
  type ResourceOverview,
} from '../resourceCenterModel';

const props = defineProps<{
  overview: ResourceOverview | null;
  kindMeta: Record<ResourceKind, { label: string; icon: Component; tone: string; path: string }>;
}>();

const emit = defineEmits<{
  (e: 'openItem', item: ResourceItem): void;
  (e: 'openReviewItem', item: ResourceItem): void;
  (e: 'openPublishDialog', category: 'model' | 'asset' | 'work' | 'plugin'): void;
  (e: 'navigate', path: string): void;
  (e: 'search', query: string): void;
}>();

const reviewPressure = computed(() => props.overview?.reviewPressure);
const hasReviewPressure = computed(() => {
  const pressure = reviewPressure.value;
  return Boolean(pressure && pressure.level !== 'none' && (pressure.pending || pressure.rejected));
});
</script>

<template>
  <aside class="insight-rail">
    <section class="review-panel" :class="{ active: hasReviewPressure }">
      <div class="rail-title">
        <PackageCheck class="icon-sm" />
        审核与返修
      </div>
      <div v-if="overview?.reviewQueue.length" class="rail-list">
        <button
          v-for="item in overview.reviewQueue"
          :key="`${item.kind}:review:${item.id}`"
          type="button"
          class="compact-row"
          @click="emit('openReviewItem', item)"
        >
          <span>{{ getStatusLabel(item.status) }}</span>
          <strong>{{ item.title }}</strong>
          <small>
            {{ kindMeta[item.kind].label }}
            <template v-if="item.reviewAgeHours"> / {{ item.reviewAgeHours }}h</template>
          </small>
        </button>
      </div>
      <p v-else class="rail-empty">当前没有待审核或被驳回内容。</p>
    </section>

    <section>
      <div class="rail-title">
        <Flame class="icon-sm" />
        热门内容
      </div>
      <div class="rail-list">
        <button
          v-for="(item, index) in overview?.topItems || []"
          :key="`${item.kind}:top:${item.id}`"
          type="button"
          class="rank-row"
          @click="emit('openItem', item)"
        >
          <span class="rank-badge" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
          <component :is="kindMeta[item.kind].icon" class="icon-sm" />
          <span class="rank-title">{{ item.title }}</span>
          <strong class="rank-value">{{ formatNumber(item.metric) }}</strong>
        </button>
      </div>
    </section>

    <section>
      <div class="rail-title">
        <Tags class="icon-sm" />
        跨库热标签
      </div>
      <div class="tag-cloud">
        <button
          v-for="tag in overview?.hotTags || []"
          :key="tag.label"
          type="button"
          @click="emit('search', tag.label)"
        >
          #{{ tag.label }}
          <span>{{ tag.count }}</span>
        </button>
      </div>
    </section>

    <section>
      <div class="rail-title">
        <Eye class="icon-sm" />
        快速动作
      </div>
      <div class="quick-grid">
        <button type="button" @click="emit('openPublishDialog', 'work')">
          <PackageCheck class="icon-sm" />
          发布作品
        </button>
        <button type="button" @click="emit('openPublishDialog', 'asset')">
          <ArrowDownToLine class="icon-sm" />
          上传模型
        </button>
        <button type="button" @click="emit('navigate', '/materials?create=1')">
          <Layers class="icon-sm" />
          上传材质
        </button>
        <button type="button" @click="emit('openPublishDialog', 'plugin')">
          <Cpu class="icon-sm" />
          上传插件
        </button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.insight-rail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.insight-rail section {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 12px;
  box-shadow: var(--shadow-card);
}

.review-panel.active {
  border-color: rgba(217, 119, 6, 0.3);
  background: rgba(217, 119, 6, 0.02);
}

.rail-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.rail-title svg {
  color: var(--accent);
}

.rail-empty {
  color: var(--text-muted);
  font-size: 11px;
  padding: 4px;
  margin: 0;
}

.rail-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.compact-row,
.rank-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 6px 8px;
  text-align: left;
  transition: all 0.15s ease;
  cursor: pointer;
}

.compact-row:hover,
.rank-row:hover {
  background: var(--bg-hover);
  transform: translateY(-0.5px);
}

.rail-list > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.compact-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
}

.compact-row span {
  color: #b45309;
  font-size: 10px;
  font-weight: 600;
  background: rgba(217, 119, 6, 0.1);
  padding: 1px 5px;
  border-radius: 4px;
}

.compact-row strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-row small {
  color: var(--text-muted);
  font-size: 10px;
}

.rank-row {
  display: grid;
  grid-template-columns: 18px 16px minmax(0, 1fr) auto;
  gap: 8px;
}

.rank-row svg {
  color: var(--text-secondary);
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
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
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-value {
  color: var(--tone-color, var(--accent));
  font-size: 12px;
  font-weight: 600;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-cloud button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  border: 0;
  border-radius: 9999px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 0 10px;
  font-size: 10px;
  font-weight: 500;
  transition: all 0.15s ease;
  cursor: pointer;
}

.tag-cloud button:hover {
  background: var(--bg-active);
  color: var(--accent);
  transform: translateY(-0.5px);
}

.tag-cloud span {
  color: var(--text-muted);
  font-size: 9px;
  margin-left: 2px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.quick-grid button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s ease;
  cursor: pointer;
}

.quick-grid button:hover {
  background: var(--bg-active);
  color: var(--accent);
  border-color: var(--accent);
  transform: translateY(-1px);
}

@media (max-width: 1180px) {
  .insight-rail {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .insight-rail {
    grid-template-columns: 1fr;
  }
}
</style>

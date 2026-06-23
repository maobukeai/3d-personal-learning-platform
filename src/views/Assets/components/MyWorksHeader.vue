<script setup lang="ts">
import { Eye, EyeOff, Loader2, PackageCheck, Plus, Search, Sparkles } from 'lucide-vue-next';

const searchQuery = defineModel<string>('searchQuery', { required: true });
const isStatsExpanded = defineModel<boolean>('isStatsExpanded', { required: true });

defineProps<{
  activeTab: 'mine' | 'favorites';
  isLoading: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  publish: [];
}>();
</script>

<template>
  <header
    class="page-header flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0"
  >
    <div class="title-block flex-1 min-w-0">
      <div class="title-icon">
        <PackageCheck class="icon-sm" />
      </div>
      <div>
        <h1>我的作品</h1>
        <p>统一管理资源、材料、插件和展示作品的发布状态。</p>
      </div>
    </div>

    <!-- Center: Centered Search Input -->
    <div class="flex justify-center flex-1 w-full md:w-auto">
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
        <Search />
        <input v-model="searchQuery" type="text" placeholder="搜索标题、说明、标签或发布位置" />
      </label>
    </div>

    <div class="header-actions flex-1 flex justify-end mobile-row">
      <button
        v-if="activeTab === 'mine'"
        type="button"
        class="ghost-button"
        @click="isStatsExpanded = !isStatsExpanded"
      >
        <component :is="isStatsExpanded ? EyeOff : Eye" class="icon-sm" />
        {{ isStatsExpanded ? '收起指标' : '数据指标' }}
      </button>
      <button type="button" class="ghost-button" :disabled="isLoading" @click="emit('refresh')">
        <Loader2 v-if="isLoading" class="icon-sm spinning" />
        <Sparkles v-else class="icon-sm" />
        刷新
      </button>
      <button
        v-if="activeTab === 'mine'"
        type="button"
        class="primary-button"
        @click="emit('publish')"
      >
        <Plus class="icon-sm" />
        发布作品
      </button>
    </div>
  </header>
</template>

<style scoped>
.page-header,
.title-block,
.header-actions {
  display: flex;
  align-items: center;
}

.page-header {
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
}

.title-block {
  gap: 8px;
  min-width: 0;
}

.title-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
  flex: 0 0 auto;
}

h1,
p {
  margin: 0;
}

.title-block h1 {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.title-block p {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.2;
}

.header-actions {
  gap: 8px;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.primary-button,
.ghost-button {
  cursor: pointer;
  transition: all 0.15s ease;
}

.primary-button,
.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border-base);
}

.primary-button {
  border-color: transparent;
  background: #2563eb;
  color: #fff;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
}

.primary-button:hover {
  background: #1d4ed8;
  transform: translateY(-0.5px);
}

.ghost-button {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-base);
  border-radius: 6px;
}

.ghost-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.primary-button:disabled,
.ghost-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 680px) {
  .page-header,
  .header-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .primary-button,
  .ghost-button {
    width: 100%;
  }
}
</style>

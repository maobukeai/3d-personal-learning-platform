<script setup lang="ts">
import { FileStack, Search, Eye, EyeOff, RefreshCw, UploadCloud } from 'lucide-vue-next';

const searchQuery = defineModel<string>('searchQuery', { required: true });

defineProps<{
  isLoading: boolean;
  isFeedLoading: boolean;
  isStatsExpanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleStats'): void;
  (e: 'refresh'): void;
  (e: 'publish'): void;
}>();
</script>

<template>
  <header
    class="page-header flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0"
  >
    <div class="title-block flex-1 min-w-0">
      <div class="title-icon">
        <FileStack class="icon-sm" />
      </div>
      <div>
        <h1>资源中心</h1>
        <p>统一查看资源、材质、插件和作品展示的运营状态。</p>
      </div>
    </div>

    <div class="flex justify-center flex-1 w-full md:w-auto">
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
        <Search />
        <input v-model="searchQuery" type="text" placeholder="搜索最近内容、作者或标签" />
      </label>
    </div>

    <div class="header-actions flex-1 flex justify-end mobile-row">
      <button type="button" class="ghost-button" @click="emit('toggleStats')">
        <component :is="isStatsExpanded ? EyeOff : Eye" class="icon-sm" />
        {{ isStatsExpanded ? '收起指标' : '数据指标' }}
      </button>
      <button
        type="button"
        class="ghost-button"
        :disabled="isLoading || isFeedLoading"
        @click="emit('refresh')"
      >
        <RefreshCw class="icon-sm" :class="{ spinning: isLoading || isFeedLoading }" />
        刷新
      </button>
      <button type="button" class="primary-button" @click="emit('publish')">
        <UploadCloud class="icon-sm" />
        发布内容
      </button>
    </div>
  </header>
</template>

<style scoped>
.page-header {
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
}

.title-block {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.title-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-subtle);
}

.title-block h1 {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin: 0;
}

.title-block p {
  margin: 1px 0 0;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.2;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
  transition: all 0.15s ease;
  border: 1px solid var(--border-base);
}

.primary-button {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
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

.ghost-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .page-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 10px;
    min-height: auto;
  }

  .header-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    width: 100%;
  }

  .primary-button,
  .ghost-button {
    width: 100%;
    min-width: 0;
    height: 38px;
  }
}
</style>

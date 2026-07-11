<script setup lang="ts">
import type { Component } from 'vue';

interface Tab {
  id: string;
  label: string;
  icon: Component;
}

defineProps<{
  tabs: Tab[];
  activeTab: string;
  activeTabMeta: Tab;
  configurationCompleteness: number;
}>();

const emit = defineEmits<{
  (e: 'select-tab', tabId: string): void;
}>();
</script>

<template>
  <aside class="admin-settings-rail">
    <div class="rail-title">
      <p>系统设置</p>
      <h2>管理设置中心</h2>
    </div>

    <div class="rail-summary">
      <component :is="activeTabMeta.icon" />
      <div>
        <strong>{{ activeTabMeta.label }}</strong>
        <span>配置完整度 {{ configurationCompleteness }}%</span>
      </div>
    </div>

    <div class="rail-heading">
      <span>{{ $t('admin.set_categories') }}</span>
      <strong>{{ tabs.length }}</strong>
    </div>

    <nav class="admin-settings-tab-list scrollbar-hide">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="{ active: activeTab === tab.id }"
        @click="emit('select-tab', tab.id)"
      >
        <component :is="tab.icon" />
        <span>
          <strong>{{ tab.label }}</strong>
          <small>{{ tab.id === activeTab ? '当前正在配置' : '点击查看配置' }}</small>
        </span>
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.admin-settings-rail {
  min-height: 0;
  overflow: auto;
  padding: 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-enterprise);
}

.rail-title {
  display: grid;
  gap: 2px;
  padding: 2px 2px 8px;
}

.rail-title p,
.rail-title h2 {
  margin: 0;
}

.rail-title p,
.rail-heading {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.rail-title h2 {
  color: var(--text-primary);
  font-size: 21px;
  font-weight: 900;
  line-height: 1.1;
}

.rail-summary {
  min-height: 58px;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 9px;
  border-radius: 8px;
  background: var(--bg-app);
}

.rail-summary > svg {
  width: 40px;
  height: 40px;
  padding: 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-app));
  color: var(--accent);
}

.rail-summary strong,
.rail-summary span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-summary strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.rail-summary span {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 11px;
}

.rail-heading {
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rail-heading strong {
  min-width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: var(--bg-app);
  color: var(--text-primary);
}

.admin-settings-tab-list {
  display: grid;
  gap: 5px;
}

.admin-settings-tab-list button {
  width: 100%;
  min-height: 58px;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 9px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.admin-settings-tab-list button:hover,
.admin-settings-tab-list button.active {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-base));
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.admin-settings-tab-list button > svg {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

.admin-settings-tab-list button.active > svg {
  color: var(--accent);
}

.admin-settings-tab-list span {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.admin-settings-tab-list strong,
.admin-settings-tab-list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-settings-tab-list strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.admin-settings-tab-list small {
  color: var(--text-muted);
  font-size: 11px;
}

@media (max-width: 1279px) {
  .admin-settings-rail {
    overflow: visible;
  }

  .admin-settings-tab-list {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
}
</style>

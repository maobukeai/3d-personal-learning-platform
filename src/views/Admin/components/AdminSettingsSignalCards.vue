<script setup lang="ts">
import type { Component } from 'vue';

interface Tab {
  id: string;
  label: string;
  icon: Component;
}

interface SignalCard {
  label: string;
  value: string;
  detail: string;
  icon: Component;
  tone: string;
}

defineProps<{
  activeTabMeta: Tab;
  configurationCompleteness: number;
  settingsSignalCards: SignalCard[];
}>();
</script>

<template>
  <section class="settings-command-center">
    <div class="settings-command-copy">
      <span class="settings-eyebrow">SYSTEM CONTROL</span>
      <h2>{{ activeTabMeta.label }}</h2>
      <p>
        当前配置完整度
        {{ configurationCompleteness }}%，修改会先在页面暂存，保存后同步到服务端配置中心。
      </p>
    </div>
    <div class="settings-signal-grid">
      <article
        v-for="card in settingsSignalCards"
        :key="card.label"
        class="settings-signal-card"
        :data-tone="card.tone"
      >
        <component :is="card.icon" class="settings-signal-icon" />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-1.5 leading-none mb-0.5">
            <strong class="settings-signal-value">{{ card.value }}</strong>
            <span class="settings-signal-label">{{ card.label }}</span>
          </div>
          <small class="settings-signal-detail">{{ card.detail }}</small>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.settings-command-center {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 16px 20px;
}

.settings-command-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-eyebrow {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.settings-command-copy h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 900;
  line-height: 1.2;
}

.settings-command-copy p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

.settings-signal-grid {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
  max-width: 48rem;
}

.settings-signal-card {
  --settings-tone: #2563eb;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--settings-tone) 22%, var(--border-base));
  border-radius: 6px;
  background: color-mix(in srgb, var(--settings-tone) 7%, var(--bg-card));
  padding: 6px 10px;
}

.settings-signal-card[data-tone='emerald'] {
  --settings-tone: #059669;
}

.settings-signal-card[data-tone='sky'] {
  --settings-tone: #0284c7;
}

.settings-signal-card[data-tone='amber'] {
  --settings-tone: #d97706;
}

.settings-signal-card[data-tone='rose'] {
  --settings-tone: #e11d48;
}

.settings-signal-card[data-tone='violet'] {
  --settings-tone: #7c3aed;
}

.settings-signal-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  color: var(--settings-tone);
}

.settings-signal-value {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.settings-signal-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
}

.settings-signal-detail {
  display: block;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1120px) {
  .settings-command-center {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .settings-signal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: none;
  }
}

@media (max-width: 720px) {
  .settings-command-copy p {
    display: none;
  }

  .settings-signal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .settings-command-center {
    padding: 6px 10px;
  }

  .settings-signal-grid {
    gap: 4px;
  }

  .settings-signal-card {
    padding: 4px 8px;
    gap: 6px;
  }

  .settings-signal-icon {
    width: 13px;
    height: 13px;
  }

  .settings-signal-value {
    font-size: 11px;
  }

  .settings-signal-label {
    font-size: 8px;
  }

  .settings-signal-detail {
    font-size: 8px;
  }
}
</style>

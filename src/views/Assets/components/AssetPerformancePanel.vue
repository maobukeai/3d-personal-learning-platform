<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Gauge } from 'lucide-vue-next';
import type { PerformanceReport, PerformanceTone } from './types';

defineProps<{
  activePerformanceReport: PerformanceReport;
  mobileRiskLabel: string;
}>();

const riskToneText = (tone: PerformanceTone) => {
  if (tone === 'danger') return '高风险';
  if (tone === 'warning') return '需优化';
  if (tone === 'notice') return '关注';
  return '通过';
};

const formatNumber = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '未解析';
  return value.toLocaleString('zh-CN');
};

const formatMetricValue = (value: number, unit = '') => {
  if (unit === 'MB') return `${value.toFixed(2)} MB`;
  if (unit === 'px') return `${formatNumber(value)} px`;
  if (!unit) return formatNumber(value);
  return `${formatNumber(value)} ${unit}`;
};
</script>

<template>
  <div class="performance-panel">
    <div class="performance-hero mobile-row" :data-tone="activePerformanceReport.level">
      <Gauge class="h-7 w-7" />
      <div>
        <strong>{{ activePerformanceReport.score }}</strong>
        <span>{{ activePerformanceReport.summary }}</span>
      </div>
      <small>{{ mobileRiskLabel }}</small>
    </div>

    <div class="risk-grid">
      <article
        v-for="risk in activePerformanceReport.risks"
        :key="risk.metric"
        :data-tone="risk.tone"
      >
        <div>
          <CheckCircle2 v-if="risk.tone === 'pass'" class="h-4 w-4" />
          <AlertTriangle v-else class="h-4 w-4" />
          <strong>{{ risk.label }}</strong>
          <span>{{ riskToneText(risk.tone) }}</span>
        </div>
        <b>{{ formatMetricValue(risk.value, risk.unit) }}</b>
        <p>{{ risk.message }}</p>
        <small>{{ risk.recommendation }}</small>
      </article>
    </div>
  </div>
</template>

<style scoped>
.performance-panel {
  display: grid;
  gap: 14px;
}

.performance-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  border: 1px solid #dbe7ff;
  border-radius: 8px;
  background: #f7fbff;
  padding: 16px;
  color: #2563eb;
}

.performance-hero[data-tone='warning'] {
  border-color: #ffe2a9;
  background: #fffaf0;
  color: #c27000;
}
.performance-hero[data-tone='danger'] {
  border-color: #fecaca;
  background: #fff7f7;
  color: #dc2626;
}
.performance-hero[data-tone='pass'] {
  border-color: #bbf7d0;
  background: #f4fff8;
  color: #0f9f6e;
}

.performance-hero strong {
  display: block;
  color: #17213a;
  font-size: 28px;
  line-height: 1;
}

.performance-hero span,
.performance-hero small {
  color: #53617c;
  font-size: 13px;
  font-weight: 800;
}

.risk-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.risk-grid article {
  display: grid;
  gap: 10px;
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #f8faff;
  padding: 14px;
}

.risk-grid article > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.risk-grid article strong {
  color: #17213a;
  font-size: 14px;
}

.risk-grid article span {
  margin-left: auto;
  border-radius: 7px;
  background: #eef3fb;
  padding: 4px 7px;
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
}

.risk-grid article[data-tone='pass'] span {
  color: #0f9f6e;
  background: #e8fbf1;
}
.risk-grid article[data-tone='notice'] span {
  color: #2563eb;
  background: #eaf2ff;
}
.risk-grid article[data-tone='warning'] span {
  color: #c27000;
  background: #fff4dd;
}
.risk-grid article[data-tone='danger'] span {
  color: #dc2626;
  background: #fee2e2;
}

.risk-grid b {
  color: #17213a;
  font-size: 20px;
}

.risk-grid p,
.risk-grid small {
  margin: 0;
  color: #65718b;
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 760px) {
  .risk-grid,
  .performance-hero {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { Download, Eye, Gauge, MessageSquare, Plus, Smartphone, Star } from 'lucide-vue-next';
import type { AssetDetail, PerformanceReport } from './types';
import type { Component } from 'vue';

type ReviewStatus = { label: string; tone: 'success' | 'warning' | 'danger' };
type InfoRow = { label: string; value: string };
type ModelRow = { label: string; value: string; icon: Component };

const props = defineProps<{
  asset: AssetDetail | null;
  displayFormat: string;
  assetSize: string;
  parsedFormats: string[];
  reviewStatus: ReviewStatus;
  viewCount: number;
  favoriteCount: number;
  downloadCount: number;
  annotationCount: number;
  fileInfo: InfoRow[];
  modelInfoRows: ModelRow[];
  activePerformanceReport: PerformanceReport;
  performanceToneLabel: string;
  mobileRiskLabel: string;
  tags: string[];
}>();

const emit = defineEmits<{
  viewPerformance: [];
}>();

const originalityText = computed(() => {
  const orig = props.asset?.originality;
  if (orig === 'ORIGINAL') return '原创';
  if (orig === 'AUTHORIZED') return '授权发布';
  if (orig === 'REMIX') return '二次创作';
  return '原创';
});

const meshTypeText = computed(() => {
  const t = props.asset?.meshType;
  if (t === 'LOW_POLY') return '低模 (Low Poly)';
  if (t === 'HIGH_POLY') return '高模 (High Poly)';
  if (t === 'CAD') return '工程模型 (CAD)';
  return '未指定';
});

const pbrChannelsList = computed<string[]>(() => {
  const chs = props.asset?.pbrChannels;
  if (!chs) return [];
  if (Array.isArray(chs)) return chs;
  try {
    const parsed = JSON.parse(chs);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
});
</script>

<template>
  <section class="side-card identity-card">
    <span>MODEL INSPECTOR</span>
    <h2>{{ displayFormat }} / {{ assetSize }}</h2>
    <p>
      {{ asset?.description || '暂无模型说明，可在模型档案中补充拓扑、贴图、授权和使用场景。' }}
    </p>
    <div>
      <strong>{{ reviewStatus.label }}</strong>
      <strong class="uppercase">{{ originalityText }}</strong>
      <strong v-if="asset?.license" class="uppercase">{{ asset.license.replace('_', ' ') }}</strong>
      <strong>{{ parsedFormats.length || 1 }} 种格式</strong>
    </div>
  </section>

  <section class="side-card summary-card">
    <h2>概览</h2>
    <div class="summary-grid">
      <div>
        <Eye class="h-4 w-4" /><strong>{{ viewCount }}</strong
        ><span>浏览</span>
      </div>
      <div>
        <Star class="h-4 w-4" /><strong>{{ favoriteCount }}</strong
        ><span>收藏</span>
      </div>
      <div>
        <Download class="h-4 w-4" /><strong>{{ downloadCount }}</strong
        ><span>下载</span>
      </div>
      <div>
        <MessageSquare class="h-4 w-4" /><strong>{{ annotationCount }}</strong
        ><span>评论</span>
      </div>
    </div>
  </section>

  <section class="side-card">
    <h2>文件信息</h2>
    <div class="file-grid">
      <div v-for="item in fileInfo" :key="item.label">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>
  </section>

  <section v-if="asset?.packageUrl" class="side-card">
    <h2>资源包内容</h2>
    <div class="file-grid">
      <div>
        <span>资源包大小</span>
        <strong>{{ asset.packageSize ? `${asset.packageSize} MB` : '未知大小' }}</strong>
      </div>
      <div class="col-span-2 mt-2">
        <span class="block text-xs text-[var(--text-secondary)] mb-1">包内所含文件格式：</span>
        <div class="flex flex-wrap gap-1.5 mt-1">
          <span
            v-for="fmt in parsedFormats"
            :key="fmt"
            class="px-2 py-0.5 rounded text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium uppercase"
          >
            {{ fmt }}
          </span>
        </div>
      </div>
    </div>
  </section>

  <section class="side-card">
    <h2>模型信息</h2>
    <div class="model-rows">
      <div v-for="item in modelInfoRows" :key="item.label">
        <span><component :is="item.icon" class="h-4 w-4" />{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>
  </section>

  <!-- 3D Specifications & Optimizations -->
  <section class="side-card specs-card">
    <h2>3D 技术参数与优化</h2>
    <div class="specs-grid">
      <div class="spec-item">
        <span>多边形类型</span>
        <strong>{{ meshTypeText }}</strong>
      </div>
      <div class="spec-item">
        <span>UV 展开状况</span>
        <strong>{{ asset?.uvUnwrapped ? '已展开' : '未展开' }}{{ asset?.uvOverlapping ? ' (重叠)' : ' (无重叠)' }}</strong>
      </div>
      <div class="spec-item">
        <span>骨骼动画绑定</span>
        <strong>{{ asset?.rigged ? '已绑定骨骼' : '无骨骼绑定' }}</strong>
      </div>
      <div class="spec-item">
        <span>游戏引擎就绪</span>
        <strong>{{ asset?.gameReady ? 'Game Ready' : '未就绪' }}</strong>
      </div>
      <div class="spec-item col-span-2" v-if="pbrChannelsList.length > 0">
        <span>PBR 材质通道</span>
        <div class="flex flex-wrap gap-1 mt-1.5">
          <span
            v-for="ch in pbrChannelsList"
            :key="ch"
            class="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium"
          >
            {{ ch }}
          </span>
        </div>
      </div>
    </div>
  </section>

  <section class="side-card performance-card" :data-tone="activePerformanceReport.level">
    <h2>性能检测</h2>
    <div class="score-ring">
      <strong>{{ activePerformanceReport.score }}</strong>
      <span>{{ performanceToneLabel }}</span>
    </div>
    <p><Smartphone class="h-4 w-4" />{{ mobileRiskLabel }}</p>
    <button type="button" @click="emit('viewPerformance')">
      <Gauge class="h-4 w-4" />
      查看检测报告
    </button>
  </section>

  <section class="side-card tags-card">
    <h2>标签</h2>
    <div class="mobile-row">
      <span v-for="tag in tags" :key="tag">{{ tag }}</span>
      <button type="button"><Plus class="h-3.5 w-3.5" /></button>
    </div>
  </section>
</template>

<style scoped>
.side-card {
  border: 1px solid #e6ebf5;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
}

.identity-card {
  display: grid;
  gap: 11px;
  overflow: hidden;
  border-color: #263244;
  background:
    radial-gradient(circle at 88% 8%, rgba(245, 121, 42, 0.22), transparent 34%),
    linear-gradient(145deg, #17202d, #0c1118);
  color: #eef4fb;
}

.identity-card > span {
  color: #93c5fd;
  font-size: 10px;
  font-weight: 900;
}

.side-card.identity-card h2 {
  margin: 0;
  color: #ffffff;
  font-size: 18px;
}

.identity-card p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: #b9c5d4;
  font-size: 12px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.identity-card div {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.identity-card strong {
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 900;
}

.side-card h2 {
  margin: 0 0 14px;
  color: #17213a;
  font-size: 15px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.summary-grid div {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 72px;
  border-right: 1px solid #edf1f7;
}

.summary-grid div:last-child {
  border-right: 0;
}

.summary-grid svg:nth-child(1) {
  color: #6757ff;
}

.summary-grid strong {
  color: #17213a;
  font-size: 18px;
}

.summary-grid span {
  color: #78849b;
  font-size: 11px;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.file-grid div {
  min-height: 64px;
  border-radius: 8px;
  background: #f8faff;
  padding: 12px;
}

.file-grid span,
.model-rows span {
  color: #65718b;
  font-size: 12px;
}

.file-grid strong {
  display: block;
  margin-top: 7px;
  color: #17213a;
  font-size: 13px;
}

.model-rows {
  display: grid;
  gap: 10px;
}

.model-rows div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.model-rows span {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #6757ff;
}

.model-rows strong {
  color: #17213a;
  font-size: 12px;
  text-align: right;
}

.performance-card {
  display: grid;
  gap: 12px;
}

.score-ring {
  display: grid;
  place-items: center;
  width: 86px;
  height: 86px;
  border: 7px solid #dbe7ff;
  border-radius: 50%;
  background: #f7fbff;
}

.performance-card[data-tone='pass'] .score-ring {
  border-color: #bbf7d0;
  background: #f4fff8;
}
.performance-card[data-tone='warning'] .score-ring {
  border-color: #ffe2a9;
  background: #fffaf0;
}
.performance-card[data-tone='danger'] .score-ring {
  border-color: #fecaca;
  background: #fff7f7;
}

.score-ring strong {
  color: #17213a;
  font-size: 24px;
  line-height: 1;
}

.score-ring span {
  color: #65718b;
  font-size: 11px;
  font-weight: 900;
}

.performance-card p,
.performance-card button {
  display: flex;
  align-items: center;
  gap: 7px;
}

.performance-card p {
  margin: 0;
  color: #53617c;
  font-size: 12px;
  font-weight: 900;
}

.performance-card button {
  justify-content: center;
  height: 34px;
  border: 1px solid #e2e8f2;
  border-radius: 8px;
  background: #fff;
  color: #17213a;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.tags-card div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tags-card span,
.tags-card button {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  border: 0;
  border-radius: 7px;
  background: #f3f5fa;
  color: #4d5b74;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
}

.tags-card button {
  width: 28px;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}

.specs-card {
  display: grid;
  gap: 12px;
}

.specs-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.spec-item {
  min-height: 58px;
  border-radius: 8px;
  background: #f8faff;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.spec-item.col-span-2 {
  grid-column: span 2 / span 2;
}

.spec-item span {
  color: #65718b;
  font-size: 11px;
  font-weight: 500;
}

.spec-item strong {
  display: block;
  margin-top: 4px;
  color: #17213a;
  font-size: 12px;
  font-weight: bold;
}
</style>

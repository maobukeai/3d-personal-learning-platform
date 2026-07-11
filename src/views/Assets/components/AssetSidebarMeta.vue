<script setup lang="ts">
import { computed } from 'vue';
import { ExternalLink, Settings, Shield } from 'lucide-vue-next';
import { formatFileSize } from '../resourceUtils';
import { useLabel } from '@/utils/i18n';
import type { AssetDetailResource } from './types'; /** * Right-column lower block for AssetDetailModal: telemetry stats grid * (file size / vertices / faces / materials), copyright & licensing card, * technical specifications card, and the tag badge list. Owns the * originality/meshType labels and tag parsing computeds. */
const props = defineProps<{ asset: AssetDetailResource }>();
const label = useLabel();
const originalityLabel = computed(() => {
  const o = props.asset.originality;
  if (o === 'ORIGINAL') return label('原创', 'Original');
  if (o === 'AUTHORIZED') return label('授权发布', 'Authorized');
  if (o === 'REMIX') return label('二次创作', 'Remix');
  return label('原创', 'Original');
});
const meshTypeLabel = computed(() => {
  const m = props.asset.meshType;
  if (m === 'LOW_POLY') return label('低模 (Low Poly)', 'Low Poly');
  if (m === 'HIGH_POLY') return label('高模 (High Poly)', 'High Poly');
  if (m === 'CAD') return label('工程模型 (CAD)', 'CAD');
  return label('未指定', 'Not Specified');
});
const parsedTags = computed(() => {
  const raw = props.asset.tags;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t: string) => t.trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((t: string) => t.trim()).filter(Boolean);
  } catch {
    return raw
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
  }
  return [];
});
</script>
<template>
  <!-- Telemetry Stats Grid (2x2 Grid) -->
  <div class="grid grid-cols-2 gap-2 text-xs">
    <!-- File size -->
    <div class="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-1 text-left">
      <span class="text-[10px] text-[var(--text-muted)] uppercase font-medium">{{
        label('文件大小', 'File Size')
      }}</span>
      <span class="font-bold text-[var(--text-primary)]">{{ formatFileSize(asset.size) }}</span>
    </div>
    <!-- Vertices -->
    <div class="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-1 text-left">
      <span class="text-[10px] text-[var(--text-muted)] uppercase font-medium">{{
        label('顶点数', 'Vertices')
      }}</span>
      <span class="font-bold text-[var(--text-primary)]">{{
        asset.vertices?.toLocaleString() || '-'
      }}</span>
    </div>
    <!-- Faces -->
    <div class="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-1 text-left">
      <span class="text-[10px] text-[var(--text-muted)] uppercase font-medium">{{
        label('三角面', 'Faces')
      }}</span>
      <span class="font-bold text-[var(--text-primary)]">{{
        asset.faces?.toLocaleString() || '-'
      }}</span>
    </div>
    <!-- Materials -->
    <div class="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-1 text-left">
      <span class="text-[10px] text-[var(--text-muted)] uppercase font-medium">{{
        label('材质球', 'Materials')
      }}</span>
      <span class="font-bold text-[var(--text-primary)]">{{
        asset.materials?.toLocaleString() || '-'
      }}</span>
    </div>
  </div>
  <!-- Compact Specifications & Copyright side-by-side -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <!-- Copyright Info -->
    <div
      class="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02]"
    >
      <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
        <Shield class="h-3.5 w-3.5 text-indigo-400" />
        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
          {{ label('版权与许可协议', 'Copyright & Licensing') }}
        </span>
      </div>
      <div class="p-3 flex flex-col gap-2 text-xs text-left">
        <div class="flex justify-between">
          <span class="text-[var(--text-muted)]">{{ label('原创属性', 'Originality') }}</span>
          <span class="font-semibold text-[var(--text-secondary)]">{{ originalityLabel }}</span>
        </div>
        <div v-if="asset.license" class="flex justify-between">
          <span class="text-[var(--text-muted)]">{{ label('授权协议', 'License') }}</span>
          <span class="font-semibold text-teal-400 uppercase text-[10px]">{{
            asset.license.replace('_', ' ')
          }}</span>
        </div>
        <div
          v-if="asset.originality !== 'ORIGINAL' && asset.originalAuthor"
          class="flex justify-between"
        >
          <span class="text-[var(--text-muted)]">{{ label('原作者', 'Original Author') }}</span>
          <span
            class="font-semibold text-[var(--text-secondary)] truncate max-w-[80px]"
            :title="asset.originalAuthor"
            >{{ asset.originalAuthor }}</span
          >
        </div>
        <div
          v-if="asset.originality !== 'ORIGINAL' && asset.originalLink"
          class="flex justify-between items-center"
        >
          <span class="text-[var(--text-muted)]">{{ label('原作链接', 'Original Link') }}</span>
          <a
            :href="asset.originalLink"
            target="_blank"
            class="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
          >
            {{ label('查看', 'Link') }} <ExternalLink class="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
    <!-- 3D Specifications -->
    <div
      class="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02]"
    >
      <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
        <Settings class="h-3.5 w-3.5 text-teal-400" />
        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
          {{ label('技术参数与规格', 'Technical Specifications') }}
        </span>
      </div>
      <div class="p-3 flex flex-col gap-2 text-xs text-left">
        <div class="flex justify-between">
          <span class="text-[var(--text-muted)]">{{ label('多边形网格', 'Mesh Type') }}</span>
          <span
            class="font-semibold text-[var(--text-secondary)] truncate max-w-[90px]"
            :title="meshTypeLabel"
            >{{ meshTypeLabel }}</span
          >
        </div>
        <div class="flex justify-between">
          <span class="text-[var(--text-muted)]">{{ label('已展 UV', 'UV Unwrapped') }}</span>
          <span class="font-semibold text-[var(--text-secondary)]">
            {{ asset.uvUnwrapped ? label('是', 'Yes') : label('否', 'No') }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-[var(--text-muted)]">{{ label('UV 重叠', 'Overlapping') }}</span>
          <span class="font-semibold text-[var(--text-secondary)]">
            {{ asset.uvOverlapping ? label('是', 'Yes') : label('否', 'No') }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-[var(--text-muted)]">{{ label('骨骼绑定', 'Rigged') }}</span>
          <span class="font-semibold text-[var(--text-secondary)]">
            {{ asset.rigged ? label('是', 'Yes') : label('否', 'No') }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-[var(--text-muted)]">{{ label('游戏就绪', 'Game Ready') }}</span>
          <span class="font-semibold text-[var(--text-secondary)]">
            {{ asset.gameReady ? label('是', 'Yes') : label('否', 'No') }}
          </span>
        </div>
      </div>
    </div>
  </div>
  <!-- Tag badges -->
  <div v-if="parsedTags.length > 0" class="flex flex-col gap-1.5 text-left">
    <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
      {{ label('标签', 'Tags') }}
    </h4>
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="tag in parsedTags"
        :key="tag"
        class="px-2 py-0.5 rounded-md text-xs bg-white/[0.04] text-[var(--text-secondary)] border border-white/5 font-medium"
      >
        {{ tag }}
      </span>
    </div>
  </div>
</template>

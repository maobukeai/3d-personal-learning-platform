<script setup lang="ts">
import { Shield, Settings } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import type { NormalizedMaterial } from '../materialAdapter'; /** * Right-column lower block for MaterialDetailPanel: copyright/licensing card, * technical specifications card, and the tag badge list. */
defineProps<{ material: NormalizedMaterial }>();
const label = useLabel();
</script>
<template>
  <!-- Specifications & Copyright side-by-side -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <!-- Copyright Info -->
    <div
      class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left"
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
          <span class="font-semibold text-[var(--text-secondary)]">{{
            material.originality === 'ORIGINAL'
              ? label('原创', 'Original')
              : label('转载/改编', 'Reprint/Adaptation')
          }}</span>
        </div>
        <div v-if="material.license" class="flex justify-between">
          <span class="text-[var(--text-muted)]">{{ label('授权协议', 'License') }}</span>
          <span class="font-semibold text-teal-400 uppercase text-[10px]">{{
            material.license.replace('_', ' ')
          }}</span>
        </div>
      </div>
    </div>
    <!-- Specifications -->
    <div
      class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left"
    >
      <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
        <Settings class="h-3.5 w-3.5 text-teal-400" />
        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
          {{ label('技术参数与规格', 'Specifications') }}
        </span>
      </div>
      <div class="p-3 flex flex-col gap-2 text-xs text-left">
        <div class="flex justify-between">
          <span class="text-[var(--text-muted)]">{{ label('程序化材质', 'Procedural') }}</span>
          <span class="font-semibold text-[var(--text-secondary)]">{{
            material.isProcedural ? label('是', 'Yes') : label('否', 'No')
          }}</span>
        </div>
      </div>
    </div>
  </div>
  <!-- Tag badges -->
  <div
    v-if="material.tags && material.tags.length"
    class="border border-white/10 rounded-2xl p-3 bg-white/[0.01] dark:bg-white/[0.02] text-left"
  >
    <span
      class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-2"
      >{{ label('相关标签', 'Tags') }}</span
    >
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="tag in material.tags"
        :key="tag"
        class="px-2 py-0.5 rounded-md text-[10px] bg-white/[0.04] text-[var(--text-secondary)] border border-white/5 font-medium"
      >
        #{{ tag }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { CheckCircle2, Image as ImageIcon } from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import type { NormalizedMaterial } from '../materialAdapter';

/**
 * Left-column preview for MaterialDetailPanel: bilibili/image tab switcher,
 * prominent square preview, and the PBR texture-channel explorer grid.
 *
 * Owns preview-only UI state (active tab, channel selection) so the parent
 * only needs to supply the material + the fetched package file list.
 */
const props = defineProps<{
  material: NormalizedMaterial;
  packageFiles: string[];
}>();

const label = useLabel();
const activePreviewTab = ref<'image' | 'video'>('image');
const selectedPreviewUrl = ref<string | null>(null);

watch(
  () => props.material?.id,
  () => {
    activePreviewTab.value = 'image';
    selectedPreviewUrl.value = null;
  },
);

const getBilibiliEmbedUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const match = url.match(/video\/(BV[a-zA-Z0-9]+)/i) || url.match(/bvid=(BV[a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return `//player.bilibili.com/player.html?bvid=${match[1]}&page=1&high_quality=1&as_wide=1&autoplay=0&danmaku=0`;
  }
  return undefined;
};

interface PbrChannel {
  name: string;
  key: string;
  patterns: string[];
  matchedFile: string | null;
}

const pbrChannels = computed<PbrChannel[]>(() => {
  const files = props.packageFiles || [];
  const channelsList: PbrChannel[] = [
    {
      name: label('基础颜色 (Base Color / Albedo)', 'Albedo / Diffuse'),
      key: 'albedo',
      patterns: ['albedo', 'diffuse', 'color', 'basecolor', 'col', 'diff'],
      matchedFile: null,
    },
    {
      name: label('法线贴图 (Normal GL/DX)', 'Normal Map'),
      key: 'normal',
      patterns: ['normal', 'nor', 'nrm', 'gl', 'dx'],
      matchedFile: null,
    },
    {
      name: label('粗糙度 (Roughness)', 'Roughness'),
      key: 'roughness',
      patterns: ['roughness', 'rough', 'rgh'],
      matchedFile: null,
    },
    {
      name: label('金属感 (Metallic)', 'Metallic'),
      key: 'metallic',
      patterns: ['metallic', 'metal', 'met'],
      matchedFile: null,
    },
    {
      name: label('高度/置换 (Height / Displacement)', 'Displacement'),
      key: 'height',
      patterns: ['height', 'displacement', 'disp', 'hgt'],
      matchedFile: null,
    },
    {
      name: label('环境光遮蔽 (Ambient Occlusion)', 'AO Map'),
      key: 'ao',
      patterns: ['ao', 'occlusion', 'ambient'],
      matchedFile: null,
    },
  ];

  for (const channel of channelsList) {
    const match = files.find((filePath) => {
      const fileName = filePath.split('/').pop()?.toLowerCase() || '';
      const isImg = /\.(png|jpg|jpeg|tga|dds|exr|hdr|tiff|bmp)$/i.test(filePath);
      if (!isImg) return false;
      return channel.patterns.some((pattern) => {
        if (pattern === 'ao' && fileName.includes('albedo')) return false;
        if (pattern === 'gl' && fileName.includes('roughness')) return false;
        return fileName.includes(pattern);
      });
    });
    if (match) {
      channel.matchedFile = match.split('/').pop() || match;
    }
  }
  return channelsList;
});

const handleChannelClick = (channel: PbrChannel) => {
  if (!channel.matchedFile) return;
  const pathPart = encodeURIComponent(channel.matchedFile);
  const targetUrl = getAssetUrl(`/api/materials/${props.material.id}/zip-entry?path=${pathPart}`);
  if (selectedPreviewUrl.value === targetUrl) {
    selectedPreviewUrl.value = null; // Toggle off if clicked again
  } else {
    selectedPreviewUrl.value = targetUrl;
  }
};
</script>
<template>
  <!-- Preview Mode Selector -->
  <div
    v-if="material.bilibiliUrl"
    class="flex items-center gap-1 p-0.5 bg-black/20 dark:bg-white/5 backdrop-blur-md rounded-lg border border-white/10 self-start"
  >
    <button
      type="button"
      class="px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border-none"
      :class="
        activePreviewTab === 'image'
          ? 'bg-teal-500 text-white shadow-sm'
          : 'bg-transparent text-slate-400 hover:text-white'
      "
      @click="activePreviewTab = 'image'"
    >
      图片预览
    </button>
    <button
      type="button"
      class="px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border-none"
      :class="
        activePreviewTab === 'video'
          ? 'bg-teal-500 text-white shadow-sm'
          : 'bg-transparent text-slate-400 hover:text-white'
      "
      @click="activePreviewTab = 'video'"
    >
      视频演示
    </button>
  </div>
  <!-- Prominent Square Preview Container -->
  <div
    class="relative w-full aspect-square sm:max-h-[480px] rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 flex items-center justify-center group shrink-0"
  >
    <iframe
      v-if="activePreviewTab === 'video' && getBilibiliEmbedUrl(material.bilibiliUrl)"
      :src="getBilibiliEmbedUrl(material.bilibiliUrl)"
      scrolling="no"
      border="0"
      frameborder="no"
      framespacing="0"
      allowfullscreen="true"
      class="w-full h-full absolute inset-0 z-20"
    ></iframe>
    <img
      v-if="activePreviewTab === 'image' && (selectedPreviewUrl || material.preview)"
      :src="selectedPreviewUrl || material.preview"
      class="w-full h-full object-cover filter blur-md opacity-25 absolute inset-0 scale-105"
      alt="Background blur"
    />
    <img
      v-if="activePreviewTab === 'image' && (selectedPreviewUrl || material.preview)"
      :src="selectedPreviewUrl || material.preview"
      class="w-full h-full object-contain relative z-10"
      alt="Material Preview"
    />
    <div
      v-else
      class="text-center text-[var(--text-muted)] text-sm flex flex-col items-center gap-2 relative z-10"
    >
      <ImageIcon class="h-10 w-10 text-white/20" />
      <span>{{ label('暂无预览图', 'No Preview Available') }}</span>
    </div>
    <!-- Float Badge -->
    <div class="absolute top-3 left-3 z-20 flex gap-2">
      <span
        v-if="material.status === 'APPROVED'"
        class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
      >
        {{ label('已发布', 'Approved') }}
      </span>
      <span
        v-else-if="material.status === 'PENDING'"
        class="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold"
      >
        {{ label('审核中', 'Pending') }}
      </span>
      <span
        v-else
        class="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-semibold"
      >
        {{ label('未通过', 'Rejected') }}
      </span>
    </div>
    <!-- Floating Overlay for Channel Preview -->
    <div
      v-if="selectedPreviewUrl"
      class="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-md border-t border-white/10 px-4 py-2.5 z-20 flex items-center justify-between text-xs text-white"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
        <span class="font-bold truncate text-left">{{
          label('正在预览贴图通道', 'Previewing texture map channel')
        }}</span>
      </div>
      <button
        type="button"
        class="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 border-0 text-white text-[10px] font-bold cursor-pointer transition-colors"
        @click="selectedPreviewUrl = null"
      >
        {{ label('恢复主预览', 'Reset View') }}
      </button>
    </div>
  </div>
  <!-- PBR Map Channel Explorer Grid -->
  <div class="border border-white/10 rounded-2xl p-4 bg-white/[0.01] dark:bg-white/[0.02] shrink-0">
    <h3
      class="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3 flex items-center justify-between"
    >
      <span>{{ label('贴图通道解析', 'Texture Maps & Channels') }}</span>
      <span class="text-[10px] text-[var(--text-muted)] font-normal normal-case">
        {{ label('自动识别压缩包内的 PBR 贴图文件', 'Auto-identified PBR textures from package') }}
      </span>
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      <div
        v-for="channel in pbrChannels"
        :key="channel.key"
        class="p-3 rounded-xl border transition-all duration-300 flex flex-col gap-2 relative overflow-hidden text-left"
        :class="[
          channel.matchedFile
            ? 'border-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01] cursor-pointer hover:border-emerald-500/40 hover:bg-emerald-500/5'
            : 'border-white/5 bg-white/[0.005] opacity-60 cursor-not-allowed',
          selectedPreviewUrl &&
          selectedPreviewUrl.includes(encodeURIComponent(channel.matchedFile || ''))
            ? '!border-teal-500 !bg-teal-500/10 shadow-lg'
            : '',
        ]"
        @click="channel.matchedFile && handleChannelClick(channel)"
      >
        <!-- Card header: Name and Status -->
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-[var(--text-primary)] truncate">{{ channel.name }}</span>
          <span
            class="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase"
            :class="
              channel.matchedFile
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-white/5 text-[var(--text-muted)] border border-white/5'
            "
          >
            {{ channel.matchedFile ? label('已包含', 'Included') : label('未找到', 'Missing') }}
          </span>
        </div>
        <!-- Card body: Filename -->
        <div class="flex items-center gap-1.5 min-w-0">
          <CheckCircle2 v-if="channel.matchedFile" class="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span
            v-else
            class="h-3.5 w-3.5 rounded-full border border-dashed border-white/20 shrink-0"
          ></span>
          <span
            class="truncate font-mono text-[10px] text-left"
            :class="
              channel.matchedFile
                ? 'text-[var(--text-secondary)] font-semibold'
                : 'text-[var(--text-muted)] italic'
            "
            :title="channel.matchedFile || ''"
          >
            {{
              channel.matchedFile ||
              label('压缩包中未检测到此通道文件', 'No matching file found in package')
            }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

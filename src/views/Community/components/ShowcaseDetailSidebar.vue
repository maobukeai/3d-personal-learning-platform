<script setup lang="ts">
import {
  Heart,
  Eye,
  MessageCircle,
  Clock,
  Play,
  Download,
  Box,
  Layers3,
  Puzzle,
  Sparkles,
} from 'lucide-vue-next';
import {
  formatCompactNumber as formatNumber,
  formatRelativeTime as formatTime,
} from '@/utils/format';
import { getAssetUrl } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { parseTags } from '@/utils/tags';
import type { ShowcaseItem } from './showcaseTypes';
import {
  getTypeLabel,
  getTypeClass,
  downloadMaterialFile,
  downloadPluginFile,
} from './showcaseHelpers';
interface StatusMeta {
  label: string;
  tone: string;
  hint: string;
}
defineProps<{ item: ShowcaseItem; detailStatusMeta: StatusMeta }>();
const emit = defineEmits<{
  (e: 'toggle-like', target: ShowcaseItem): void;
  (e: 'select-tag', tag: string): void;
  (e: 'open-user-profile', userId: string): void;
  (e: 'start-chat', user: ShowcaseItem['user']): void;
}>();
const authStore = useAuthStore();
const hasLinkedResources = (item: ShowcaseItem) =>
  (item.linkedAssets && item.linkedAssets.length > 0) ||
  (item.linkedMaterials && item.linkedMaterials.length > 0) ||
  (item.linkedPlugins && item.linkedPlugins.length > 0);
</script>
<template>
  <aside class="lg:col-span-4 flex flex-col gap-6">
    <!-- Creator profile box -->
    <div
      class="detail-author flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
    >
      <UserAvatar :user="item.user" size="md" />
      <button
        type="button"
        class="detail-author-profile flex-1 text-left bg-transparent border-0 p-0 cursor-pointer min-w-0"
        @click="emit('open-user-profile', item.user.id)"
      >
        <strong class="block text-xs font-bold text-[var(--text-primary)] truncate">{{
          item.user.name || item.user.email || '匿名创作者'
        }}</strong>
        <span class="block text-[10px] text-[var(--text-muted)] truncate mt-0.5">{{
          item.user.bio || '查看创作者主页与更多作品'
        }}</span>
      </button>
      <button
        v-if="item.user.id !== authStore.user?.id"
        type="button"
        class="detail-author-chat w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border-0 text-slate-400 hover:text-white transition-colors cursor-pointer"
        title="私信创作者"
        @click="emit('start-chat', item.user)"
      >
        <MessageCircle class="w-4 h-4" />
      </button>
    </div>
    <!-- Metadata & Stats Module -->
    <div class="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400">作品元数据</h4>
        <div class="detail-title-row m-0">
          <span :class="['detail-type', getTypeClass(item.type)]">
            {{ getTypeLabel(item.type) }}
          </span>
          <span :class="['detail-status', detailStatusMeta.tone]">
            {{ detailStatusMeta.label }}
          </span>
        </div>
      </div>
      <div
        class="detail-actions mobile-row m-0 border-t border-b border-white/5 py-3 rounded-none bg-transparent"
      >
        <button type="button" :class="{ liked: item.isLiked }" @click="emit('toggle-like', item)">
          <Heart class="w-4 h-4" :class="{ 'fill-current': item.isLiked }" />
          {{ formatNumber(item.likesCount) }}
        </button>
        <span><Eye class="w-4 h-4" />{{ formatNumber(item.views) }}</span>
        <span><MessageCircle class="w-4 h-4" />{{ formatNumber(item.commentsCount) }}</span>
        <span><Clock class="w-4 h-4" />{{ formatTime(item.createdAt) }}</span>
      </div>
      <div v-if="parseTags(item.tags).length" class="detail-tags mt-0">
        <button
          v-for="tag in parseTags(item.tags)"
          :key="tag"
          type="button"
          @click="emit('select-tag', tag)"
        >
          #{{ tag }}
        </button>
      </div>
      <div class="flex flex-col gap-2 pt-2">
        <a
          v-if="item.videoUrl"
          :href="item.videoUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="detail-link m-0"
        >
          <Play class="w-4 h-4" /> 打开视频源
        </a>
        <a
          v-if="item.asset?.url"
          :href="getAssetUrl(item.asset.url)"
          download
          class="detail-link m-0"
        >
          <Download class="w-4 h-4" /> 下载关联模型
        </a>
      </div>
    </div>
    <!-- Linked Resources Section (Models, Materials, Plugins used in showcase) -->
    <div
      v-if="hasLinkedResources(item)"
      class="linked-resources-section p-4 rounded-xl bg-white/[0.01] border border-white/5"
    >
      <h3
        class="text-xs font-black uppercase tracking-wider text-indigo-500 mb-3.5 flex items-center gap-1.5"
      >
        <Sparkles class="w-4 h-4 text-indigo-500" /> 使用的项目资源
      </h3>
      <div class="space-y-4">
        <!-- Linked Assets (3D models) -->
        <div v-if="item.linkedAssets && item.linkedAssets.length > 0" class="space-y-2">
          <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">
            3D模型作品
          </div>
          <div class="grid grid-cols-1 gap-2.5">
            <div
              v-for="asset in item.linkedAssets"
              :key="asset.id"
              class="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-all"
            >
              <div class="flex items-center gap-2 min-w-0">
                <div
                  class="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-slate-950 flex-shrink-0 flex items-center justify-center"
                >
                  <img
                    v-if="asset.thumbnail"
                    :src="getAssetUrl(asset.thumbnail)"
                    class="w-full h-full object-cover"
                  />
                  <Box v-else class="w-4 h-4 text-slate-400" />
                </div>
                <div class="min-w-0">
                  <h5 class="text-[11px] font-bold text-slate-200 truncate leading-tight">
                    {{ asset.title }}
                  </h5>
                  <p class="text-[9px] text-slate-500 mt-0.5">
                    <span v-if="asset.vertices">{{ formatNumber(asset.vertices) }} 顶点</span>
                  </p>
                </div>
              </div>
              <a
                :href="getAssetUrl(asset.url)"
                download
                class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold text-indigo-400 bg-indigo-950/30 hover:bg-indigo-950/60 transition-colors border-0 cursor-pointer no-underline"
              >
                <Download class="w-3.5 h-3.5" /> 下载
              </a>
            </div>
          </div>
        </div>
        <!-- Linked Materials -->
        <div v-if="item.linkedMaterials && item.linkedMaterials.length > 0" class="space-y-2">
          <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">
            材质贴图作品
          </div>
          <div class="grid grid-cols-1 gap-2.5">
            <div
              v-for="mat in item.linkedMaterials"
              :key="mat.id"
              class="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-all"
            >
              <div class="flex items-center gap-2 min-w-0">
                <div
                  class="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-slate-950 flex-shrink-0 flex items-center justify-center"
                >
                  <img
                    v-if="mat.previewUrl"
                    :src="getAssetUrl(mat.previewUrl)"
                    class="w-full h-full object-cover"
                  />
                  <Layers3 v-else class="w-4 h-4 text-slate-400" />
                </div>
                <div class="min-w-0">
                  <h5 class="text-[11px] font-bold text-slate-200 truncate leading-tight">
                    {{ mat.title }}
                  </h5>
                  <p class="text-[9px] text-slate-500 mt-0.5">
                    <span v-if="mat.resolution">{{ mat.resolution }}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold text-indigo-400 bg-indigo-950/30 hover:bg-indigo-950/60 transition-colors border-0 cursor-pointer"
                @click="downloadMaterialFile(mat)"
              >
                <Download class="w-3.5 h-3.5" /> 下载
              </button>
            </div>
          </div>
        </div>
        <!-- Linked Plugins -->
        <div v-if="item.linkedPlugins && item.linkedPlugins.length > 0" class="space-y-2">
          <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">
            工具插件作品
          </div>
          <div class="grid grid-cols-1 gap-2.5">
            <div
              v-for="plugin in item.linkedPlugins"
              :key="plugin.id"
              class="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-all"
            >
              <div class="flex items-center gap-2 min-w-0">
                <div
                  class="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-slate-950 flex-shrink-0 flex items-center justify-center"
                >
                  <img
                    v-if="plugin.previewUrl"
                    :src="getAssetUrl(plugin.previewUrl)"
                    class="w-full h-full object-cover"
                  />
                  <Puzzle v-else class="w-4 h-4 text-slate-400" />
                </div>
                <div class="min-w-0">
                  <h5 class="text-[11px] font-bold text-slate-200 truncate leading-tight">
                    {{ plugin.title }}
                  </h5>
                  <p class="text-[9px] text-slate-500 mt-0.5">
                    <span>v{{ plugin.version }}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold text-indigo-400 bg-indigo-950/30 hover:bg-indigo-950/60 transition-colors border-0 cursor-pointer"
                @click="downloadPluginFile(plugin)"
              >
                <Download class="w-3.5 h-3.5" /> 下载
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
<style scoped>
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.detail-tags button {
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.08);
  color: #818cf8;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid rgba(99, 102, 241, 0.15);
  cursor: pointer;
  transition: all 0.2s;
}
.detail-tags button:hover {
  background: rgba(99, 102, 241, 0.15);
  color: #c7d2fe;
}
.detail-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.detail-actions button,
.detail-actions span {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}
.detail-actions button {
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}
.detail-actions button:hover {
  color: var(--text-primary);
}
.detail-actions button.liked {
  color: #f43f5e;
}
.detail-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.15);
  color: #818cf8;
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  margin-top: 8px;
  transition: all 0.2s;
}
.detail-link:hover {
  background: rgba(99, 102, 241, 0.15);
  color: #c7d2fe;
}
.detail-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.detail-type {
  font-size: 9px;
  font-weight: 700;
  padding: 2.5px 7px;
  border-radius: 5px;
  text-transform: uppercase;
}
.detail-status {
  font-size: 9px;
  font-weight: 600;
  padding: 2.5px 7px;
  border-radius: 5px;
}
.detail-type.tone-blue {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.25);
}
.detail-type.tone-rose {
  background: rgba(244, 63, 94, 0.15);
  color: #fb7185;
  border: 1px solid rgba(244, 63, 94, 0.25);
}
.detail-type.tone-green {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}
.detail-type.tone-amber {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.25);
}
.detail-type.tone-slate {
  background: rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
.detail-status.status-pending {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}
.detail-status.status-rejected {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
.detail-status.status-approved {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
</style>

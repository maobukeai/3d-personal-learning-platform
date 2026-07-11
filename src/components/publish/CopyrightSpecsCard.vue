<script setup lang="ts">
import { Shield, Settings, ChevronDown, ChevronUp } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import {
  ASSET_ORIGINALITY_OPTIONS,
  ASSET_LICENSE_OPTIONS,
  ASSET_MESHTYPE_OPTIONS,
  ASSET_PBR_MAPS_OPTIONS,
} from '@/views/Assets/assetLibraryModel';
import type { PublishForm } from './publishWorkSchema'; /** * Shared "Copyright & Licensing" + "Technical Specifications" collapsible * card pair. Extracted verbatim from the three identical copies that lived * inside PublishWorkDialog.vue (asset / plugin / material sections). * * The form object is bound via `v-model:form` so nested field mutations stay * in sync with the parent's reactive state without triggering * `vue/no-mutating-props`. */
const form = defineModel<PublishForm>('form', { required: true });
defineProps<{
  /** Which collapsible section is currently open (shared across both cards). */ activeSection:
    | 'copyright'
    | 'specs'
    | null;
}>();
const emit = defineEmits<{
  (e: 'toggle-section', section: 'copyright' | 'specs'): void;
  (e: 'toggle-pbr', map: string): void;
}>();
const label = useLabel();
</script>
<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
    <!-- Copyright & License Section (Left) -->
    <div
      class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all"
    >
      <div
        class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors"
        @click="emit('toggle-section', 'copyright')"
      >
        <div class="flex items-center gap-2">
          <Shield class="h-4 w-4 text-indigo-500" />
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {{ label('版权与许可协议', 'Copyright & Licensing') }}
          </span>
        </div>
        <div class="flex items-center gap-1.5 ml-auto mr-1">
          <span
            v-if="activeSection !== 'copyright'"
            class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20"
          >
            {{
              form.originality ? (form.originality === 'ORIGINAL' ? '原创' : '转载') : '未设置原创'
            }}
            · {{ form.license || '未设置协议' }}
          </span>
          <component
            :is="activeSection === 'copyright' ? ChevronUp : ChevronDown"
            class="h-4 w-4 text-[var(--text-secondary)] shrink-0"
          />
        </div>
      </div>
      <div
        v-show="activeSection === 'copyright'"
        class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4"
      >
        <!-- Originality -->
        <div class="flex flex-col text-left">
          <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
            >原创属性</span
          >
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in ASSET_ORIGINALITY_OPTIONS"
              :key="opt.value"
              type="button"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                form.originality === opt.value
                  ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm scale-[1.02]'
                  : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800',
              ]"
              @click="form.originality = form.originality === opt.value ? '' : opt.value"
            >
              {{ label(opt.label_zh, opt.label_en) }}
            </button>
          </div>
        </div>
        <div
          v-if="form.originality && form.originality !== 'ORIGINAL'"
          class="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all"
        >
          <Input
            v-model="form.originalAuthor"
            type="text"
            :label="label('原作者姓名/署名', 'Original Author')"
            placeholder="e.g. SketchUp Studio"
          />
          <Input
            v-model="form.originalLink"
            type="url"
            :label="label('原作者作品链接', 'Original URL')"
            placeholder="https://..."
          />
        </div>
        <!-- License & Download -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col text-left">
            <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
              >授权许可协议</span
            >
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in ASSET_LICENSE_OPTIONS"
                :key="opt.value"
                type="button"
                :class="[
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                  form.license === opt.value
                    ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50',
                ]"
                @click="form.license = form.license === opt.value ? '' : opt.value"
              >
                {{ opt.value }}
              </button>
            </div>
          </div>
          <div class="flex flex-col text-left">
            <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
              >下载权限</span
            >
            <div class="flex gap-2">
              <button
                type="button"
                :class="[
                  'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                  form.isFree === true
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400',
                ]"
                @click="form.isFree = form.isFree === true ? null : true"
              >
                免费下载
              </button>
              <button
                type="button"
                :class="[
                  'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border text-center',
                  form.isFree === false
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400 font-semibold shadow-sm'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400',
                ]"
                @click="form.isFree = form.isFree === false ? null : false"
              >
                VIP 会员专享
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Technical Specs Section (Right) -->
    <div
      class="collapsible-card border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden glass-panel bg-white/40 dark:bg-slate-900/40 shadow-sm transition-all"
    >
      <div
        class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors"
        @click="emit('toggle-section', 'specs')"
      >
        <div class="flex items-center gap-2">
          <Settings class="h-4 w-4 text-teal-500" />
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {{ label('技术参数与规格', 'Technical Specifications') }}
          </span>
        </div>
        <div class="flex items-center gap-1.5 ml-auto mr-1">
          <span
            v-if="activeSection !== 'specs'"
            class="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20"
          >
            {{ form.meshType || '未设置网格' }} · PBR({{ form.pbrChannels?.length || 0 }})
          </span>
          <component
            :is="activeSection === 'specs' ? ChevronUp : ChevronDown"
            class="h-4 w-4 text-[var(--text-secondary)] shrink-0"
          />
        </div>
      </div>
      <div
        v-show="activeSection === 'specs'"
        class="card-body p-4 border-t border-slate-200/40 dark:border-white/5 flex flex-col gap-4"
      >
        <!-- Mesh Type -->
        <div class="flex flex-col text-left">
          <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
            >网格多边形类型</span
          >
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in ASSET_MESHTYPE_OPTIONS"
              :key="opt.value"
              type="button"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                form.meshType === opt.value
                  ? 'bg-teal-500/15 border-teal-500/50 text-teal-600 dark:text-teal-400 font-semibold shadow-sm scale-[1.02]'
                  : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50',
              ]"
              @click="form.meshType = form.meshType === opt.value ? '' : opt.value"
            >
              {{ label(opt.label_zh, opt.label_en) }}
            </button>
          </div>
        </div>
        <!-- UV & Features Toggles -->
        <div class="grid grid-cols-2 gap-2 text-left">
          <button
            type="button"
            :class="[
              'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
              form.uvUnwrapped
                ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
            ]"
            @click="form.uvUnwrapped = !form.uvUnwrapped"
          >
            <span>已展 UV</span>
            <span
              :class="[
                'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                form.uvUnwrapped ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700',
              ]"
              >✓</span
            >
          </button>
          <button
            type="button"
            :class="[
              'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
              form.uvOverlapping
                ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-semibold'
                : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
            ]"
            @click="form.uvOverlapping = !form.uvOverlapping"
          >
            <span>UV 重叠</span>
            <span
              :class="[
                'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                form.uvOverlapping ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700',
              ]"
              >✓</span
            >
          </button>
          <button
            type="button"
            :class="[
              'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
              form.rigged
                ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
            ]"
            @click="form.rigged = !form.rigged"
          >
            <span>骨骼绑定</span>
            <span
              :class="[
                'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                form.rigged ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700',
              ]"
              >✓</span
            >
          </button>
          <button
            type="button"
            :class="[
              'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border',
              form.gameReady
                ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-800 text-slate-500',
            ]"
            @click="form.gameReady = !form.gameReady"
          >
            <span>游戏引擎就绪</span>
            <span
              :class="[
                'w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
                form.gameReady ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700',
              ]"
              >✓</span
            >
          </button>
        </div>
        <!-- PBR Maps fast toggle tags -->
        <div class="flex flex-col text-left">
          <span class="block text-xs font-semibold mb-2 text-[var(--text-secondary)]"
            >包含 PBR 材质通道</span
          >
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="map in ASSET_PBR_MAPS_OPTIONS"
              :key="map"
              type="button"
              :class="[
                'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                form.pbrChannels?.includes(map)
                  ? 'bg-teal-500/20 border-teal-500/50 text-teal-600 dark:text-teal-300 font-semibold shadow-sm scale-105'
                  : 'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-800 text-slate-400 hover:bg-slate-200/50',
              ]"
              @click="emit('toggle-pbr', map)"
            >
              <span class="mr-1">{{ form.pbrChannels?.includes(map) ? '✓' : '+' }}</span
              >{{ map }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

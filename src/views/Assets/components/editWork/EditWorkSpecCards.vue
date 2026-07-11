<script setup lang="ts">
import { computed } from 'vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import { Shield, Settings, ChevronDown, ChevronUp } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import type { WorkKind } from '../../myWorksModel';
import {
  ASSET_ORIGINALITY_OPTIONS,
  ASSET_LICENSE_OPTIONS,
  ASSET_MESHTYPE_OPTIONS,
  ASSET_PBR_MAPS_OPTIONS,
} from '../../assetLibraryModel';
import type { EditForm, SpecSection } from './types';
const form = defineModel<EditForm>('form', { required: true });
defineProps<{ workKind: WorkKind; activeSection: SpecSection | null }>();
const emit = defineEmits<{ (e: 'toggle-section', sec: SpecSection): void }>();
const label = useLabel();
function emitUpdate(patch: Partial<EditForm>) {
  form.value = { ...form.value, ...patch };
}
const originality = computed({
  get: () => form.value.originality || 'ORIGINAL',
  set: (v) => emitUpdate({ originality: v }),
});
const originalAuthor = computed({
  get: () => form.value.originalAuthor || '',
  set: (v) => emitUpdate({ originalAuthor: v }),
});
const originalLink = computed({
  get: () => form.value.originalLink || '',
  set: (v) => emitUpdate({ originalLink: v }),
});
const license = computed({
  get: () => form.value.license || 'CC_BY',
  set: (v) => emitUpdate({ license: v }),
});
const isFree = computed({
  get: () => form.value.isFree !== false,
  set: (v) => emitUpdate({ isFree: v }),
});
const meshType = computed({
  get: () => form.value.meshType || 'LOW_POLY',
  set: (v) => emitUpdate({ meshType: v }),
});
const uvUnwrapped = computed({
  get: () => form.value.uvUnwrapped !== false,
  set: (v) => emitUpdate({ uvUnwrapped: v }),
});
const uvOverlapping = computed({
  get: () => !!form.value.uvOverlapping,
  set: (v) => emitUpdate({ uvOverlapping: v }),
});
const pbrChannels = computed({
  get: () => form.value.pbrChannels || [],
  set: (v) => emitUpdate({ pbrChannels: v }),
});
const rigged = computed({ get: () => !!form.value.rigged, set: (v) => emitUpdate({ rigged: v }) });
const gameReady = computed({
  get: () => !!form.value.gameReady,
  set: (v) => emitUpdate({ gameReady: v }),
});
</script>
<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
    <!-- Copyright & Licensing Section -->
    <div
      class="collapsible-card border border-white/10 rounded-xl overflow-hidden glass-panel bg-white/[0.02]"
    >
      <div
        class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-white/[0.03] transition-colors"
        @click="emit('toggle-section', 'copyright')"
      >
        <div class="flex items-center gap-2">
          <Shield class="h-4 w-4 text-indigo-400" />
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {{ label('版权与许可声明', 'Copyright & Licensing') }}
          </span>
        </div>
        <component
          :is="activeSection === 'copyright' ? ChevronUp : ChevronDown"
          class="h-4 w-4 text-[var(--text-secondary)]"
        />
      </div>
      <div
        v-show="activeSection === 'copyright'"
        class="card-body p-4 border-t border-white/5 flex flex-col gap-4"
      >
        <label class="form-field flex flex-col text-left">
          <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
            {{ label('原创属性', 'Originality') }}
          </span>
          <Select v-model="originality" size="large" class="w-full custom-dialog-input">
            <SelectOption
              v-for="opt in ASSET_ORIGINALITY_OPTIONS"
              :key="opt.value"
              :label="label(opt.label_zh, opt.label_en)"
              :value="opt.value"
            />
          </Select>
        </label>
        <div
          v-if="originality !== 'ORIGINAL'"
          class="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all"
        >
          <Input
            v-model="originalAuthor"
            type="text"
            :label="label('原作者姓名/署名', 'Original Author')"
            placeholder="e.g. SketchUp Studio"
          />
          <Input
            v-model="originalLink"
            type="url"
            :label="label('原作者作品链接', 'Original URL')"
            placeholder="https://..."
          />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="form-field flex flex-col text-left">
            <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
              {{ label('授权许可协议 (License)', 'Distribution License') }}
            </span>
            <Select v-model="license" size="large" class="w-full custom-dialog-input">
              <SelectOption
                v-for="opt in ASSET_LICENSE_OPTIONS"
                :key="opt.value"
                :label="label(opt.label_zh, opt.label_en)"
                :value="opt.value"
              />
            </Select>
          </label>
          <label class="form-field flex flex-col text-left">
            <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
              {{ label('下载权限 (Download)', 'Download Permission') }}
            </span>
            <Select v-model="isFree" size="large" class="w-full custom-dialog-input">
              <SelectOption :label="label('免费下载', 'Free Download')" :value="true" />
              <SelectOption
                :label="label('会员专享 (VIP才能下载)', 'VIP Member Only')"
                :value="false"
              />
            </Select>
          </label>
        </div>
      </div>
    </div>
    <!-- Technical Specs Section (Asset only) -->
    <div
      v-if="workKind === 'asset'"
      class="collapsible-card border border-white/10 rounded-xl overflow-hidden glass-panel bg-white/[0.02]"
    >
      <div
        class="card-header flex justify-between items-center p-3 cursor-pointer select-none hover:bg-white/[0.03] transition-colors"
        @click="emit('toggle-section', 'specs')"
      >
        <div class="flex items-center gap-2">
          <Settings class="h-4 w-4 text-teal-400" />
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {{ label('技术参数与规格', 'Technical Specifications') }}
          </span>
        </div>
        <component
          :is="activeSection === 'specs' ? ChevronUp : ChevronDown"
          class="h-4 w-4 text-[var(--text-secondary)]"
        />
      </div>
      <div
        v-show="activeSection === 'specs'"
        class="card-body p-4 border-t border-white/5 flex flex-col gap-4"
      >
        <label class="form-field flex flex-col text-left">
          <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
            {{ label('网格多边形类型', 'Mesh Type') }}
          </span>
          <Select v-model="meshType" size="large" class="w-full custom-dialog-input">
            <SelectOption
              v-for="opt in ASSET_MESHTYPE_OPTIONS"
              :key="opt.value"
              :label="label(opt.label_zh, opt.label_en)"
              :value="opt.value"
            />
          </Select>
        </label>
        <div class="flex gap-6 mt-1 mb-1">
          <Checkbox
            :model-value="uvUnwrapped"
            @update:model-value="uvUnwrapped = $event as boolean"
          >
            {{ label('已展 UV (UV Unwrapped)', 'UV Unwrapped') }}
          </Checkbox>
          <Checkbox
            :model-value="uvOverlapping"
            @update:model-value="uvOverlapping = $event as boolean"
          >
            {{ label('UV 重叠 (Overlapping UVs)', 'Overlapping UVs') }}
          </Checkbox>
        </div>
        <label class="form-field flex flex-col text-left">
          <span class="block text-xs font-semibold mb-1.5 text-[var(--text-secondary)]">
            {{ label('包含 PBR 材质通道 (PBR Maps)', 'PBR Texture Channels') }}
          </span>
          <Select
            v-model="pbrChannels"
            multiple
            collapse-tags
            collapse-tags-tooltip
            size="large"
            class="w-full custom-dialog-input"
            :placeholder="label('选择包含的贴图通道 (PBR)', 'Select included PBR maps')"
          >
            <SelectOption
              v-for="map in ASSET_PBR_MAPS_OPTIONS"
              :key="map"
              :label="map"
              :value="map"
            />
          </Select>
        </label>
        <div class="flex gap-6 mt-1">
          <Checkbox :model-value="rigged" @update:model-value="rigged = $event as boolean">
            {{ label('骨骼绑定 (Rigged)', 'Rigged') }}
          </Checkbox>
          <Checkbox :model-value="gameReady" @update:model-value="gameReady = $event as boolean">
            {{ label('游戏引擎就绪 (Game Ready)', 'Game Ready') }}
          </Checkbox>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.form-field {
  position: relative;
  display: grid;
  gap: 4px;
}
.form-field > span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}
.form-field select {
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 0 10px;
  font-size: 12px;
}
</style>

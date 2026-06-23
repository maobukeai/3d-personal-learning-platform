<script setup lang="ts">
import { UploadCloud } from 'lucide-vue-next';
import { formatDateTime as formatDate } from '@/utils/format';
import type { AssetVersion } from './types';
import UiButton from '@/components/ui/Button.vue';

defineProps<{
  versions: AssetVersion[];
  isUploadingVersion: boolean;
  newVersionChangeLog: string;
}>();

const emit = defineEmits<{
  'update:newVersionChangeLog': [value: string];
  fileChange: [event: Event];
  upload: [];
}>();

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
  <div class="versions-panel">
    <div class="version-upload mobile-row">
      <input
        id="version-file-input"
        type="file"
        accept=".glb,.gltf,.fbx,.obj,.stl"
        @change="emit('fileChange', $event)"
      />
      <textarea
        :value="newVersionChangeLog"
        rows="2"
        placeholder="记录本次修改内容"
        @input="emit('update:newVersionChangeLog', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <UiButton
        variant="primary"
        :icon="UploadCloud"
        :disabled="isUploadingVersion"
        :loading="isUploadingVersion"
        @click="emit('upload')"
      >
        {{ isUploadingVersion ? '上传中...' : '发布新版本' }}
      </UiButton>
    </div>
    <article v-for="version in versions" :key="version.id" class="version-card">
      <div>
        <strong>{{ version.version }}</strong>
        <span>{{ formatDate(version.createdAt) }}</span>
      </div>
      <div class="version-metrics">
        <span>{{ formatMetricValue(version.faces || 0) }} 面</span>
        <span>{{ formatMetricValue(version.maxTextureRes || 0, 'px') }}</span>
        <span>{{ formatMetricValue(version.size || 0, 'MB') }}</span>
      </div>
      <p>{{ version.changeLog || '初始版本提交' }}</p>
    </article>
    <div v-if="versions.length === 0" class="empty-panel">暂无版本记录</div>
  </div>
</template>

<style scoped>
.versions-panel {
  display: block;
}

.version-upload {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #f8faff;
  padding: 12px;
}

.version-upload input,
.version-upload textarea {
  width: 100%;
  border: 1px solid #e2e8f2;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
  outline: 0;
  resize: vertical;
}

.version-upload button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: #6757ff;
  color: #fff;
  font-weight: 900;
  cursor: pointer;
}

.version-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  margin-top: 10px;
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #f8faff;
  padding: 12px;
}

.version-card strong {
  color: #192640;
}

.version-card span {
  display: block;
  margin-top: 4px;
  color: #7b879d;
  font-size: 12px;
}

.version-card p {
  grid-column: 1 / -1;
  margin: 0;
  color: #65718b;
  font-size: 13px;
  line-height: 1.7;
}

.version-metrics {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.version-metrics span {
  margin: 0;
  border-radius: 7px;
  background: #eef3fb;
  padding: 4px 7px;
  color: #53617c;
  font-size: 11px;
  font-weight: 900;
}

.empty-panel {
  display: grid;
  place-items: center;
  min-height: 120px;
  color: #7b879d;
  font-size: 13px;
}
</style>

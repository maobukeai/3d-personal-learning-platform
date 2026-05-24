<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, watch } from 'vue';
import { X, Globe, Upload, Loader2 } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';

interface MirrorSource {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  adapterType: string;
  status: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSyncDuration: number | null;
  totalResources: number;
  minPlanPriority: number;
  syncInterval: number;
  syncConfig: string | null;
  iconUrl: string | null;
  description: string | null;
  createdAt: string;
}

const props = defineProps<{
  modelValue: boolean;
  source: MirrorSource | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', data: any): void;
}>();

const adapterTypes = [
  { label: 'Zycku (资源酷)', value: 'ZYCKU' },
  { label: '通用 WordPress', value: 'GENERIC_WP' },
  { label: '手动上传 (资产站)', value: 'MANUAL' },
];

const formData = ref({
  name: '',
  displayName: '',
  baseUrl: '',
  adapterType: 'ZYCKU',
  syncInterval: 3600,
  minPlanPriority: 1,
  description: '',
  iconUrl: '',
  syncConfig: '',
});

const isUploadingIcon = ref(false);

const handleIconUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    return ElMessage.warning('图标图片大小不能超过 5MB');
  }

  try {
    isUploadingIcon.value = true;
    const formDataObj = new FormData();
    formDataObj.append('mirror_image', file);
    const { data } = await api.post('/api/admin/mirror/upload', formDataObj);
    formData.value.iconUrl = data.url;
    ElMessage.success('图标上传成功');
  } catch (error) {
    console.error('Icon upload error:', error);
    const err = error as { response?: { data?: { error?: string } } };
    ElMessage.error(getApiErrorMessage(err, '图标上传失败'));
  } finally {
    isUploadingIcon.value = false;
    target.value = '';
  }
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      if (props.source) {
        formData.value = {
          name: props.source.name,
          displayName: props.source.displayName,
          baseUrl: props.source.baseUrl,
          adapterType: props.source.adapterType,
          syncInterval: props.source.syncInterval,
          minPlanPriority: props.source.minPlanPriority,
          description: props.source.description || '',
          iconUrl: props.source.iconUrl || '',
          syncConfig: props.source.syncConfig || '',
        };
      } else {
        formData.value = {
          name: '',
          displayName: '',
          baseUrl: '',
          adapterType: 'ZYCKU',
          syncInterval: 3600,
          minPlanPriority: 1,
          description: '',
          iconUrl: '',
          syncConfig: '',
        };
      }
    }
  },
  { immediate: true },
);

const handleSave = () => {
  if (!formData.value.name.trim()) {
    ElMessage.warning('请输入名称（英文标识）');
    return;
  }
  if (!formData.value.displayName.trim()) {
    ElMessage.warning('请输入显示名称');
    return;
  }
  if (!formData.value.baseUrl.trim()) {
    ElMessage.warning('请输入站点地址');
    return;
  }

  let syncConfigObj = undefined;
  if (formData.value.syncConfig.trim()) {
    try {
      syncConfigObj = JSON.parse(formData.value.syncConfig);
    } catch (_e) {
      ElMessage.warning('配置参数 JSON 格式不正确');
      return;
    }
  }

  emit('save', {
    ...formData.value,
    syncConfig: syncConfigObj ? JSON.stringify(syncConfigObj) : null,
  });
};

const handleClose = () => {
  emit('update:modelValue', false);
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-none"
      @click.self="handleClose"
    >
      <div
        class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div
          class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700"
        >
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ source ? '编辑镜像源' : '添加镜像源' }}
          </h2>
          <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" @click="handleClose">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >名称（英文标识）</label
            >
            <input
              v-model="formData.name"
              type="text"
              placeholder="例如: zycku"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >显示名称</label
            >
            <input
              v-model="formData.displayName"
              type="text"
              placeholder="例如: 资源酷"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >站点图标 (推荐 1:1 比例)</label
            >
            <div class="flex items-center gap-4">
              <div
                class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
              >
                <img v-if="formData.iconUrl" alt="" :src="getAssetUrl(formData.iconUrl)" class="w-full h-full object-cover" />
                <Globe v-else class="w-6 h-6 text-slate-400 animate-none" />

                <label
                  class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                >
                  <Upload v-if="!isUploadingIcon" class="w-5 h-5 text-white" />
                  <Loader2 v-else class="w-5 h-5 text-white animate-spin" />
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="handleIconUpload"
                  />
                </label>
              </div>
              <div class="flex-1 space-y-1.5">
                <input
                  v-model="formData.iconUrl"
                  type="text"
                  placeholder="或者输入网络图标 URL"
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                <p class="text-[10px] text-slate-400 dark:text-slate-500 leading-none">
                  推荐尺寸 128x128px，支持 PNG/JPG/WebP，大小不超过 5MB
                </p>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >网站地址</label
            >
            <input
              v-model="formData.baseUrl"
              type="text"
              placeholder="https://www.zycku.com"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >适配器类型</label
            >
            <select
              v-model="formData.adapterType"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              <option v-for="opt in adapterTypes" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >访问权限</label
              >
              <select
                v-model="formData.minPlanPriority"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option :value="0">免费版及以上</option>
                <option :value="1">VIP及以上</option>
                <option :value="2">SVIP及以上</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >同步间隔(秒)</label
              >
              <input
                v-model.number="formData.syncInterval"
                type="number"
                min="600"
                step="600"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >描述</label
            >
            <textarea
              v-model="formData.description"
              rows="2"
              placeholder="简要描述该镜像源..."
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            ></textarea>
          </div>
          <div v-if="formData.adapterType !== 'MANUAL'">
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >自定义配置参数 (JSON格式)</label
            >
            <textarea
              v-model="formData.syncConfig"
              rows="3"
              placeholder='例如: {"cookies": "...", "headers": {...}}'
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none font-mono text-xs"
            ></textarea>
          </div>
        </div>

        <div
          class="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700"
        >
          <button type="button" class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer" @click="handleClose">
            取消
          </button>
          <button type="button" class="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors cursor-pointer" @click="handleSave">
            {{ source ? '保存' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

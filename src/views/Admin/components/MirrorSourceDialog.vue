<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import { Globe, Upload, Loader2 } from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import type { MirrorSource } from '../AdminMirrorView.vue';
import Button from '@/components/ui/Button.vue';
import Modal from '@/components/ui/Modal.vue';

const visible = defineModel<boolean>({ default: false });

const props = defineProps<{
  source?: MirrorSource | null;
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
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

function resetForm() {
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

watch(
  () => props.source,
  (newSource) => {
    if (newSource) {
      formData.value = {
        name: newSource.name,
        displayName: newSource.displayName,
        baseUrl: newSource.baseUrl,
        adapterType: newSource.adapterType,
        syncInterval: newSource.syncInterval,
        minPlanPriority: newSource.minPlanPriority,
        description: newSource.description || '',
        iconUrl: newSource.iconUrl || '',
        syncConfig: newSource.syncConfig || '',
      };
    } else {
      resetForm();
    }
  },
  { immediate: true },
);

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
  } catch (error: unknown) {
    logError(error, { operation: 'admin.uploadMirrorIcon', component: 'MirrorSourceDialog' });
    ElMessage.error(getApiErrorMessage(error, '图标上传失败'));
  } finally {
    isUploadingIcon.value = false;
    target.value = '';
  }
};

async function submit() {
  if (!formData.value.name.trim()) {
    ElMessage.warning('请输入名称（英文标识）');
    return;
  }
  if (!formData.value.displayName.trim()) {
    ElMessage.warning('请输入显示名称');
    return;
  }
  try {
    const payload = {
      ...formData.value,
      syncConfig: formData.value.syncConfig ? JSON.parse(formData.value.syncConfig) : undefined,
    };
    if (props.source) {
      await api.put(`/api/admin/mirror/sources/${props.source.id}`, payload);
      ElMessage.success('更新成功');
    } else {
      await api.post('/api/admin/mirror/sources', payload);
      ElMessage.success('镜像源创建成功');
    }
    visible.value = false;
    emit('saved');
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, props.source ? '更新失败' : '创建失败'));
  }
}
</script>

<template>
  <Modal :show="visible" size="md" @close="visible = false">
    <template #header>
      <div>
        <h3 class="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
          {{ source ? '编辑镜像源' : '添加镜像源' }}
        </h3>
        <p class="text-xs text-slate-400 mt-1">
          {{
            source ? '调整镜像源网站接入设置及同步规则' : '接入并配置一个新的 3D 资源库镜像同步源'
          }}
        </p>
      </div>
    </template>

    <div class="space-y-4">
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >名称（英文标识）</label
        >
        <input
          v-model="formData.name"
          type="text"
          placeholder="例如: zycku"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        />
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >显示名称</label
        >
        <input
          v-model="formData.displayName"
          type="text"
          placeholder="例如: 资源酷"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        />
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >站点图标 (推荐 1:1 比例)</label
        >
        <div class="flex items-center gap-4 mobile-row">
          <div
            class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
          >
            <img
              v-if="formData.iconUrl"
              alt=""
              :src="getAssetUrl(formData.iconUrl)"
              class="w-full h-full object-cover"
            />
            <Globe v-else class="w-6 h-6 text-slate-400" />

            <label
              class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
            >
              <Upload v-if="!isUploadingIcon" class="w-5 h-5 text-white" />
              <Loader2 v-else class="w-5 h-5 text-white animate-spin" />
              <input type="file" accept="image/*" class="hidden" @change="handleIconUpload" />
            </label>
          </div>
          <div class="flex-1 space-y-1.5">
            <input
              v-model="formData.iconUrl"
              type="text"
              placeholder="或者输入网络图标 URL"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
            <p class="text-[10px] text-slate-400 dark:text-slate-500 leading-none pl-1">
              推荐尺寸 128x128px，支持 PNG/JPG/WebP，大小不超过 5MB
            </p>
          </div>
        </div>
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >网站地址</label
        >
        <input
          v-model="formData.baseUrl"
          type="text"
          placeholder="https://www.zycku.com"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        />
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >适配器类型</label
        >
        <Select v-model="formData.adapterType" class="w-full" size="large">
          <SelectOption
            v-for="opt in adapterTypes"
            :key="opt.value"
            :value="opt.value"
            :label="opt.label"
          />
        </Select>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mobile-grid">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >访问权限</label
          >
          <Select v-model="formData.minPlanPriority" class="w-full" size="large">
            <SelectOption :value="0" label="免费版及以上" />
            <SelectOption :value="1" label="VIP及以上" />
            <SelectOption :value="2" label="SVIP及以上" />
          </Select>
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >同步间隔(秒)</label
          >
          <input
            v-model.number="formData.syncInterval"
            type="number"
            min="600"
            step="600"
            class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >描述</label
        >
        <textarea
          v-model="formData.description"
          rows="2"
          placeholder="简要描述该镜像源..."
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        ></textarea>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center gap-3">
        <Button variant="secondary" size="md" @click="visible = false"> 取消 </Button>
        <Button variant="primary" size="md" @click="submit">
          {{ source ? '保存' : '创建' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Database, Upload, Loader2 } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';

interface ManualStation {
  id: string;
  name: string;
  displayName: string;
  status: string;
  totalResources: number;
  minPlanPriority: number;
  iconUrl: string | null;
  description: string | null;
  createdAt: string;
}

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const showDialog = ref(false);
const isEdit = ref(false);
const editingStation = ref<ManualStation | null>(null);

const formData = ref({
  name: '',
  displayName: '',
  minPlanPriority: 0,
  description: '',
  iconUrl: '',
  status: 'ACTIVE',
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
    formDataObj.append('manual_image', file);
    const { data } = await api.post('/api/admin/manual/upload', formDataObj);
    formData.value.iconUrl = data.url;
    ElMessage.success('图标上传成功');
  } catch (error) {
    console.error('Icon upload error:', error);
    ElMessage.error(getApiErrorMessage(error, '图标上传失败'));
  } finally {
    isUploadingIcon.value = false;
    target.value = '';
  }
};

const openCreate = () => {
  isEdit.value = false;
  editingStation.value = null;
  formData.value = {
    name: '',
    displayName: '',
    minPlanPriority: 0,
    description: '',
    iconUrl: '',
    status: 'ACTIVE',
  };
  showDialog.value = true;
};

const openEdit = (station: ManualStation) => {
  isEdit.value = true;
  editingStation.value = station;
  formData.value = {
    name: station.name,
    displayName: station.displayName,
    minPlanPriority: station.minPlanPriority,
    description: station.description || '',
    iconUrl: station.iconUrl || '',
    status: station.status,
  };
  showDialog.value = true;
};

const saveStation = async () => {
  if (!formData.value.name.trim()) {
    ElMessage.warning('请输入英文标识');
    return;
  }
  if (!formData.value.displayName.trim()) {
    ElMessage.warning('请输入显示名称');
    return;
  }

  try {
    if (isEdit.value && editingStation.value) {
      await api.put(`/api/admin/manual/stations/${editingStation.value.id}`, formData.value);
      ElMessage.success('更新成功');
    } else {
      await api.post('/api/admin/manual/stations', formData.value);
      ElMessage.success('手动资源站创建成功');
    }
    showDialog.value = false;
    emit('refresh');
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, '保存失败'));
  }
};

defineExpose({
  openCreate,
  openEdit,
});
</script>

<template>
  <!-- DIALOG: CREATE OR EDIT MANUAL STATION -->
  <el-dialog
    v-model="showDialog"
    :title="isEdit ? '编辑手动资源站' : '创建手动资源站'"
    width="500px"
    custom-class="premium-dialog"
  >
    <div class="space-y-4 py-2">
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">英文标识 (字母/下划线，作为路由唯一标识)</label>
        <input
          v-model="formData.name"
          type="text"
          placeholder="如: c4d_assets"
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary);"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">显示名称</label>
        <input
          v-model="formData.displayName"
          type="text"
          placeholder="如: Cinema 4D 手动资源站"
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary);"
        />
      </div>
      <div v-if="isEdit" class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">状态</label>
        <select
          v-model="formData.status"
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary);"
        >
          <option value="ACTIVE">启用</option>
          <option value="DISABLED">禁用</option>
        </select>
      </div>
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">会员限制</label>
        <select
          v-model="formData.minPlanPriority"
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary);"
        >
          <option :value="0">免费用户及以上 (无限制)</option>
          <option :value="1">标准会员及以上</option>
          <option :value="2">专业会员及以上</option>
          <option :value="3">钻石会员及以上</option>
        </select>
      </div>
      <div class="space-y-1.5">
        <label class="text-xs font-semibold text-slate-500">站点图标 (推荐 1:1 比例)</label>
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
          >
            <img v-if="formData.iconUrl" alt="" :src="getAssetUrl(formData.iconUrl)" class="w-full h-full object-cover" />
            <Database v-else class="w-6 h-6 text-slate-400" />
            
            <label class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
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
              class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
              style="color: var(--text-primary);"
            />
            <p class="text-[10px] text-slate-400 leading-none">
              推荐尺寸 128x128px，支持 PNG/JPG/WebP，大小不超过 5MB
            </p>
          </div>
        </div>
      </div>
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">描述信息</label>
        <textarea
          v-model="formData.description"
          rows="3"
          placeholder="对本资源站点的精品资源做个简要的介绍..."
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary);"
        ></textarea>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="px-4 py-2 border rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-transparent border-slate-200 dark:border-slate-800 cursor-pointer" style="color: var(--text-secondary);" @click="showDialog = false">
          取消
        </button>
        <button type="button" class="px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-500 text-xs font-semibold transition-colors border-none cursor-pointer" @click="saveStation">
          {{ isEdit ? '保存修改' : '创建资源站' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Play, Check, Eye, EyeOff } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import FormDialog from '@/components/FormDialog.vue';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { ElMessage } from '@/utils/feedbackBridge';
import type { StorageConfigForm, AssetTypeOption } from './StorageSettingsTab.types';

interface Props {
  isEdit: boolean;
  assetTypes: AssetTypeOption[];
  submitting: boolean;
  testingConnection: boolean;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', { required: true });
const form = defineModel<StorageConfigForm>('form', { required: true });

const emit = defineEmits<{
  (e: 'submit'): void;
  (e: 'test-connection'): void;
}>();

const loadingRevealedSecrets = ref(false);
const showPlaintextSecrets = ref(false);

const handleRevealSecrets = async () => {
  if (showPlaintextSecrets.value) {
    showPlaintextSecrets.value = false;
    return;
  }

  if (!form.value.id) return;
  loadingRevealedSecrets.value = true;
  try {
    const { data } = await api.get(`/api/admin/storage-configs/${form.value.id}/reveal-secrets`);
    form.value.secretAccessKey = data.secretAccessKey || '';
    form.value.cloudflareApiToken = data.cloudflareApiToken || '';
    showPlaintextSecrets.value = true;
    ElMessage.success('已成功解密并解封显示该云存储的真实密钥与 Token！');
  } catch (err) {
    ElMessage.error(getApiErrorMessage(err, '读取或解密密钥失败'));
  } finally {
    loadingRevealedSecrets.value = false;
  }
};
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="props.isEdit ? '编辑云端存储配置' : '添加云端存储配置'"
    size="xl"
  >
    <div class="space-y-4 py-1">
      <!-- Section: Basic Information -->
      <div class="border-b pb-3" style="border-color: var(--border-base)">
        <h3 class="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">基本信息</h3>
        <div class="grid grid-cols-4 gap-3 mobile-grid">
          <div>
            <Input
              v-model="form.name"
              label="配置别名"
              placeholder="例如：材质仓 R2"
              input-class="!py-2.5"
              required
            />
          </div>
          <div>
            <Input
              v-model="form.remark"
              label="账号备注"
              placeholder="例如：开发环境 / 主账号"
              input-class="!py-2.5"
            />
          </div>
          <div>
            <label
              class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
            >
              应用类型 <span class="text-red-500">*</span>
            </label>
            <Select
              v-model="form.assetType"
              class="w-full custom-dialog-input"
              placeholder="选择类型"
            >
              <SelectOption
                v-for="type in props.assetTypes"
                :key="type.value"
                :label="type.label"
                :value="type.value"
              />
            </Select>
          </div>
          <div>
            <label
              class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
              >提供商</label
            >
            <Select v-model="form.provider" disabled class="w-full custom-dialog-input">
              <SelectOption value="CLOUDFLARE_R2" label="Cloudflare R2" />
            </Select>
          </div>
        </div>
      </div>

      <!-- Section: Credentials -->
      <div class="border-b pb-3" style="border-color: var(--border-base)">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-xs font-bold text-indigo-500 uppercase tracking-wider">连接凭证</h3>
          <button
            v-if="props.isEdit"
            type="button"
            class="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 font-medium transition-colors"
            @click="handleRevealSecrets"
          >
            <component :is="showPlaintextSecrets ? EyeOff : Eye" class="w-3.5 h-3.5" />
            <span>{{
              loadingRevealedSecrets
                ? '正在解密...'
                : showPlaintextSecrets
                  ? '隐藏明文密钥'
                  : '管理员查看已存密钥'
            }}</span>
          </button>
        </div>
        <div class="grid grid-cols-4 gap-3 mobile-grid">
          <div class="col-span-2">
            <Input
              v-model="form.endpoint"
              label="终端节点 (Endpoint URL)"
              placeholder="https://<account_id>.r2.cloudflarestorage.com"
              input-class="!py-2.5 font-mono text-xs"
              required
            />
          </div>
          <div>
            <Input
              v-model="form.accessKeyId"
              label="Access Key ID"
              placeholder="R2 存取密钥 ID"
              input-class="!py-2.5 font-mono text-xs"
              required
            />
          </div>
          <div>
            <Input
              v-model="form.secretAccessKey"
              :type="showPlaintextSecrets ? 'text' : 'password'"
              label="Secret Access Key"
              :placeholder="
                props.isEdit ? '已加密（留空保持原值，点右上角解密查看）' : 'R2 机密存取密钥'
              "
              input-class="!py-2.5 font-mono text-xs"
              :required="!props.isEdit"
            />
          </div>
          <div class="col-span-4">
            <Input
              v-model="form.cloudflareApiToken"
              :type="showPlaintextSecrets ? 'text' : 'password'"
              label="Cloudflare API Token（可选，推荐）"
              :placeholder="
                props.isEdit
                  ? '已加密（留空保持原值，点右上角解密查看）'
                  : '此 Cloudflare 账号的 R2 只读 API Token'
              "
              input-class="!py-2.5 font-mono text-xs"
            />
            <p class="text-[9px] leading-relaxed mt-1" style="color: var(--text-secondary)">
              配置 Token 后可直接读取 Cloudflare Metrics 接口，展示与官网一致的物理占用。
            </p>
          </div>
        </div>
      </div>

      <!-- Section: Bucket & Storage Config -->
      <div>
        <h3 class="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
          Bucket & 存储属性
        </h3>
        <div class="grid grid-cols-3 gap-3 mobile-grid">
          <div>
            <Input
              v-model="form.bucketName"
              label="存储桶名称"
              placeholder="例如: materials-bucket"
              input-class="!py-2.5"
              required
            />
          </div>
          <div>
            <Input
              v-model="form.publicUrl"
              label="公共访问域名 (Public URL)"
              placeholder="https://pub-xxxx.r2.dev 或自定义域名"
              input-class="!py-2.5 font-mono text-xs"
              required
            />
          </div>
          <div>
            <Input
              v-model.number="form.priority"
              type="number"
              label="匹配优先级"
              input-class="!py-2.5"
            />
          </div>
          <div>
            <Input
              v-model.number="form.limitGb"
              type="number"
              label="配额限制 (GB)"
              input-class="!py-2.5"
              required
            />
          </div>
          <div>
            <Input
              v-model.number="form.usedBytes"
              type="number"
              label="已用存储空间 (Bytes)"
              input-class="!py-2.5"
              required
            />
          </div>
          <div class="flex items-center pl-2 pt-5">
            <Checkbox
              :model-value="form.status === 'ACTIVE'"
              @change="(val: boolean) => (form.status = val ? 'ACTIVE' : 'INACTIVE')"
            >
              启用此云存储账号
            </Checkbox>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <Button
          variant="secondary"
          size="sm"
          :loading="props.testingConnection"
          :icon="props.testingConnection ? undefined : Play"
          @click="emit('test-connection')"
        >
          测试连接
        </Button>

        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="visible = false"> 取消 </Button>
          <Button
            variant="primary"
            size="sm"
            :loading="props.submitting"
            :icon="props.submitting ? undefined : Check"
            @click="emit('submit')"
          >
            保存配置
          </Button>
        </div>
      </div>
    </template>
  </FormDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Lock } from 'lucide-vue-next';
import api from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  encryptedJson: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'imported'): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const importForm = ref({
  password: ''
});

const isLoading = ref(false);

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    importForm.value.password = '';
  }
});

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function decryptData(encryptedJsonStr: string, password: string): Promise<string> {
  const payload = JSON.parse(encryptedJsonStr);
  if (!payload.encrypted || !payload.salt || !payload.iv || !payload.ciphertext) {
    throw new Error('无效的加密备份格式');
  }

  const salt = new Uint8Array(base64ToArrayBuffer(payload.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);

  const key = await getEncryptionKey(password, salt);
  const dec = new TextDecoder();
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    ciphertext
  );
  return dec.decode(decryptedBuffer);
}

async function submitDecryptAndImport() {
  if (!importForm.value.password) {
    ElMessage.warning('请输入解密密码');
    return;
  }

  try {
    isLoading.value = true;
    const decryptedStr = await decryptData(props.encryptedJson, importForm.value.password);
    const parsed = JSON.parse(decryptedStr);
    if (!Array.isArray(parsed)) {
      throw new Error('解密后的数据格式有误');
    }
    
    const res = await api.post('/api/two-factor/accounts/import', { accounts: parsed });
    if (res.data && res.data.success) {
      ElMessage.success(`成功导入 ${res.data.count} 个 2FA 账号！`);
      emit('imported');
      visible.value = false;
    }
  } catch (err: any) {
    ElMessage.error('解密失败：解密密码错误或数据文件已损坏');
    console.error(err);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="解密并导入备份"
    width="90%"
    style="max-width: 380px"
    destroy-on-close
    class="custom-el-dialog"
    :close-on-click-modal="false"
  >
    <div class="space-y-4">
      <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
        <Lock class="h-4.5 w-4.5 text-amber-400 shrink-0 mt-0.5" />
        <p class="text-xs leading-normal text-slate-300">
          检测到该备份文件已被高强度加密保护。请输入正确的解密密码以还原 2FA 凭据列表。
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-bold" style="color: var(--text-secondary)">解密密码</label>
        <el-input
          v-model="importForm.password"
          type="password"
          show-password
          placeholder="请输入备份文件密码"
          class="custom-dialog-input"
          :disabled="isLoading"
          @keyup.enter="submitDecryptAndImport"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3 pt-2">
        <el-button
          style="background-color: var(--bg-app); border: 1px solid var(--border-base); color: var(--text-secondary)"
          class="px-4 py-2 rounded-xl"
          :disabled="isLoading"
          @click="visible = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          class="bg-indigo-600 hover:bg-indigo-500 border-none font-semibold px-5 py-2.5 rounded-xl transition-all"
          :loading="isLoading"
          @click="submitDecryptAndImport"
        >
          解密导入
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

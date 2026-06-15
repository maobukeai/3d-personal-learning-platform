<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Shield } from 'lucide-vue-next';
import type { TwoFactorAccount } from '@/types';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps<{
  modelValue: boolean;
  accounts: TwoFactorAccount[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'exported', dateStr: string): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const exportForm = ref({
  encrypt: false,
  password: '',
  confirmPassword: '',
});

const isLoading = ref(false);

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      exportForm.value = {
        encrypt: false,
        password: '',
        confirmPassword: '',
      };
    }
  },
);

// WebCrypto Helper Functions (AES-GCM Encryption)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

async function getEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey'],
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptData(data: string, password: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey(password, salt);
  const enc = new TextEncoder();
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    enc.encode(data),
  );

  const payload = {
    encrypted: true,
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
  };
  return JSON.stringify(payload, null, 2);
}

async function submitExportBackup() {
  if (props.accounts.length === 0) {
    ElMessage.warning('没有可导出的2FA账号');
    return;
  }

  if (exportForm.value.encrypt) {
    if (!exportForm.value.password) {
      ElMessage.warning('请输入加密密码');
      return;
    }
    if (exportForm.value.password !== exportForm.value.confirmPassword) {
      ElMessage.warning('两次输入的密码不一致');
      return;
    }
  }

  const backupData = props.accounts.map((acc) => ({
    label: acc.label,
    email: acc.email,
    secret: acc.secret,
    note: acc.note,
    category: acc.category,
  }));

  const jsonString = JSON.stringify(backupData, null, 2);
  let finalContent = jsonString;
  let filename = `2fa_accounts_backup_${new Date().toISOString().slice(0, 10)}.json`;

  if (exportForm.value.encrypt) {
    try {
      isLoading.value = true;
      finalContent = await encryptData(jsonString, exportForm.value.password);
      filename = `2fa_accounts_encrypted_${new Date().toISOString().slice(0, 10)}.json`;
      ElMessage.success('已成功生成高强度加密备份');
    } catch (err) {
      console.error(err);
      ElMessage.error('加密备份失败');
      isLoading.value = false;
      return;
    } finally {
      isLoading.value = false;
    }
  } else {
    ElMessage.success('已成功导出明文备份 JSON');
  }

  const blob = new Blob([finalContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  const nowStr = new Date().toISOString();
  localStorage.setItem('two_factor_last_backup', nowStr);
  emit('exported', nowStr);
  visible.value = false;
}
</script>

<template>
  <Modal :show="visible" title="导出安全备份" size="sm" @close="visible = false">
    <div class="space-y-4">
      <div
        class="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3.5 flex items-start gap-2"
      >
        <Shield class="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <p class="text-xs leading-normal text-slate-300">
          导出您的 2FA 账户数据。为了数据安全，强烈建议启用密码加密，防止密钥在本地或传输中泄漏。
        </p>
      </div>

      <div
        class="flex items-center justify-between border-b pb-3"
        style="border-color: var(--border-base)"
      >
        <span class="text-xs font-bold text-slate-300">启用密码加密</span>
        <el-switch v-model="exportForm.encrypt" active-color="#6366f1" />
      </div>

      <div v-if="exportForm.encrypt" class="space-y-3 animate-fade-in">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold text-slate-400">设置加密密码</label>
          <el-input
            v-model="exportForm.password"
            type="password"
            show-password
            placeholder="请输入加密密码"
            class="custom-dialog-input"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold text-slate-400">确认加密密码</label>
          <el-input
            v-model="exportForm.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入密码"
            class="custom-dialog-input"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <el-button
        style="
          background-color: var(--bg-app);
          border: 1px solid var(--border-base);
          color: var(--text-secondary);
        "
        class="px-4 py-2 rounded-xl text-xs font-semibold"
        @click="visible = false"
      >
        取消
      </el-button>
      <el-button
        type="primary"
        class="bg-indigo-600 hover:bg-indigo-500 border-none font-semibold px-5 py-2.5 rounded-xl transition-all"
        :loading="isLoading"
        @click="submitExportBackup"
      >
        开始导出
      </el-button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Shield, Clock, ShieldCheck, Download, Upload, Lock, RefreshCw } from 'lucide-vue-next';
import api from '@/utils/api';
import type { TwoFactorAccount } from '@/types';

const visible = defineModel<boolean>({ default: false });

const props = defineProps<{
  accounts: TwoFactorAccount[];
  initialTab?: 'calibration' | 'export' | 'import';
}>();

const emit = defineEmits<{
  (e: 'exported', dateStr: string): void;
  (e: 'imported'): void;
}>();

const activeTab = ref<'calibration' | 'export' | 'import'>('calibration');

watch(visible, (newVal) => {
  if (newVal) {
    activeTab.value = props.initialTab || 'calibration';
    // Reset drift status when opening
    checkClockSync();
  }
});

// --- Tab 1: Time Calibration Logic ---
const clockDrift = ref<number | null>(null);
const isCalibrating = ref(false);

const clockSyncStatus = computed(() => {
  if (clockDrift.value === null)
    return { text: '未检测', color: 'text-slate-400', status: 'unknown' };
  const absDrift = Math.abs(clockDrift.value);
  if (absDrift < 1500)
    return { text: '时间同步: 良好', color: 'text-emerald-400', status: 'perfect' };
  if (absDrift < 3000)
    return {
      text: `时间微偏 (${(absDrift / 1000).toFixed(1)}秒)`,
      color: 'text-amber-400',
      status: 'warning',
    };
  return {
    text: `时间漂移 (${(absDrift / 1000).toFixed(1)}秒)`,
    color: 'text-rose-400',
    status: 'critical',
  };
});

async function checkClockSync() {
  isCalibrating.value = true;
  try {
    const startTime = Date.now();
    const res = await api.get('/api/two-factor/accounts', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    const endTime = Date.now();
    const roundTripTime = endTime - startTime;
    const serverDateHeader = res.headers?.date || res.headers?.Date;
    if (serverDateHeader) {
      const serverTime = new Date(serverDateHeader).getTime();
      const estimatedServerTime = serverTime + roundTripTime / 2;
      clockDrift.value = endTime - estimatedServerTime;
    } else {
      clockDrift.value = 0;
    }
  } catch (e) {
    console.error('Time sync check failed:', e);
    clockDrift.value = null;
  } finally {
    isCalibrating.value = false;
  }
}

// --- Tab 2: Export Backup Logic ---
const exportForm = ref({
  encrypt: false,
  password: '',
  confirmPassword: '',
});
const isExporting = ref(false);

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
      isExporting.value = true;
      finalContent = await encryptData(jsonString, exportForm.value.password);
      filename = `2fa_accounts_encrypted_${new Date().toISOString().slice(0, 10)}.json`;
      ElMessage.success('已成功生成高强度加密备份');
    } catch (err) {
      console.error(err);
      ElMessage.error('加密备份失败');
      isExporting.value = false;
      return;
    } finally {
      isExporting.value = false;
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

// --- Tab 3: Import Backup Logic ---
const fileInput = ref<HTMLInputElement | null>(null);
const importedFileName = ref('');
const tempImportedJson = ref('');
const isFileEncrypted = ref(false);
const decryptPassword = ref('');
const isImporting = ref(false);

function triggerFileInput() {
  fileInput.value?.click();
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
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
      iv: iv,
    },
    key,
    ciphertext,
  );
  return dec.decode(decryptedBuffer);
}

function handleImportFile(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const file = target.files[0];
  importedFileName.value = file.name;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target?.result as string;
    try {
      const parsed = JSON.parse(content);
      tempImportedJson.value = content;
      if (parsed.encrypted && parsed.ciphertext) {
        isFileEncrypted.value = true;
        decryptPassword.value = '';
      } else {
        isFileEncrypted.value = false;
      }
    } catch (err: any) {
      ElMessage.error(`读取备份失败: ${err.message || '文件格式不正确'}`);
    } finally {
      target.value = '';
    }
  };
  reader.readAsText(file);
}

async function submitImport() {
  if (!tempImportedJson.value) {
    ElMessage.warning('请先选择备份文件');
    return;
  }

  let accountsList: any[];
  try {
    isImporting.value = true;
    if (isFileEncrypted.value) {
      if (!decryptPassword.value) {
        ElMessage.warning('请输入解密密码');
        isImporting.value = false;
        return;
      }
      const decryptedStr = await decryptData(tempImportedJson.value, decryptPassword.value);
      accountsList = JSON.parse(decryptedStr);
    } else {
      accountsList = JSON.parse(tempImportedJson.value);
    }

    if (!Array.isArray(accountsList)) {
      throw new Error('备份数据格式有误，必须为账号数组');
    }

    const res = await api.post('/api/two-factor/accounts/import', { accounts: accountsList });
    if (res.data && res.data.success) {
      ElMessage.success(`成功导入 ${res.data.count} 个 2FA 账号！`);
      emit('imported');
      visible.value = false;
      // Reset local import state
      importedFileName.value = '';
      tempImportedJson.value = '';
      isFileEncrypted.value = false;
      decryptPassword.value = '';
    }
  } catch (err: any) {
    ElMessage.error(
      isFileEncrypted.value ? '解密失败：密码错误或文件损坏' : '导入失败，文件格式有误',
    );
    console.error(err);
  } finally {
    isImporting.value = false;
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="2FA 安全中心"
    width="90%"
    style="max-width: 440px"
    destroy-on-close
    class="custom-el-dialog"
  >
    <!-- Tab Navigation -->
    <div class="flex border-b mb-4" style="border-color: var(--border-base)">
      <button
        type="button"
        class="flex-1 pb-2 text-xs font-bold transition-all border-b-2"
        :class="
          activeTab === 'calibration'
            ? 'text-indigo-500 border-indigo-500'
            : 'text-slate-400 border-transparent hover:text-slate-200'
        "
        @click="activeTab = 'calibration'"
      >
        时钟校准
      </button>
      <button
        type="button"
        class="flex-1 pb-2 text-xs font-bold transition-all border-b-2"
        :class="
          activeTab === 'export'
            ? 'text-indigo-500 border-indigo-500'
            : 'text-slate-400 border-transparent hover:text-slate-200'
        "
        @click="activeTab = 'export'"
      >
        备份导出
      </button>
      <button
        type="button"
        class="flex-1 pb-2 text-xs font-bold transition-all border-b-2"
        :class="
          activeTab === 'import'
            ? 'text-indigo-500 border-indigo-500'
            : 'text-slate-400 border-transparent hover:text-slate-200'
        "
        @click="activeTab = 'import'"
      >
        备份导入
      </button>
    </div>

    <!-- Tab 1: Time Calibration -->
    <div v-if="activeTab === 'calibration'" class="space-y-4 py-1">
      <div
        class="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2"
      >
        <Clock class="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
        <p class="text-xs leading-normal text-slate-350">
          2FA 基于时间生成动态验证码，如果您的系统本地时间与服务器相差超过 30
          秒，生成的验证码会失效导致校验失败。
        </p>
      </div>

      <div
        class="flex items-center justify-between p-3 rounded-xl border"
        style="background-color: var(--bg-app); border-color: var(--border-base)"
      >
        <div>
          <p class="text-xs text-slate-400">本地时间状态</p>
          <p class="text-sm font-bold mt-1" :class="clockSyncStatus.color">
            {{ clockSyncStatus.text }}
          </p>
        </div>
        <el-button
          type="primary"
          class="bg-indigo-600 hover:bg-indigo-500 border-none font-semibold px-4 rounded-lg text-xs"
          :loading="isCalibrating"
          @click="checkClockSync"
        >
          <RefreshCw class="h-3 w-3 mr-1" :class="{ 'animate-spin': isCalibrating }" />
          校准时间
        </el-button>
      </div>
    </div>

    <!-- Tab 2: Export Backup -->
    <div v-if="activeTab === 'export'" class="space-y-4 py-1">
      <div
        class="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3.5 flex items-start gap-2"
      >
        <Shield class="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <p class="text-xs leading-normal text-slate-350">
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

      <div v-if="exportForm.encrypt" class="space-y-3">
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

      <div class="flex justify-end gap-3 pt-2">
        <el-button
          type="primary"
          class="bg-indigo-600 hover:bg-indigo-500 border-none font-semibold w-full py-2 rounded-xl transition-all"
          :loading="isExporting"
          @click="submitExportBackup"
        >
          <Download class="h-3.5 w-3.5 mr-1" />
          开始导出
        </el-button>
      </div>
    </div>

    <!-- Tab 3: Import Backup -->
    <div v-if="activeTab === 'import'" class="space-y-4 py-1">
      <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImportFile" />

      <div
        class="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2"
      >
        <Upload class="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
        <p class="text-xs leading-normal text-slate-350">
          从备份的 JSON 文件导入 2FA 账户数据，系统会自动还原所有账号、分组及备注。
        </p>
      </div>

      <div
        class="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-5 cursor-pointer bg-slate-900/10 transition-colors"
        @click="triggerFileInput"
      >
        <Upload class="h-8 w-8 text-slate-500 mb-2" />
        <p class="text-xs text-slate-400">{{ importedFileName || '点击选择 JSON 备份文件' }}</p>
      </div>

      <div v-if="isFileEncrypted" class="space-y-3">
        <div
          class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2"
        >
          <Lock class="h-4.5 w-4.5 text-amber-400 shrink-0 mt-0.5" />
          <p class="text-xs leading-normal text-slate-300">
            该备份文件已被高强度密码加密保护。请输入密码以解密数据。
          </p>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold text-slate-400">解密密码</label>
          <el-input
            v-model="decryptPassword"
            type="password"
            show-password
            placeholder="请输入备份文件密码"
            class="custom-dialog-input"
          />
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <el-button
          type="primary"
          class="bg-emerald-600 hover:bg-emerald-500 border-none font-semibold w-full py-2 rounded-xl transition-all"
          :loading="isImporting"
          :disabled="!tempImportedJson"
          @click="submitImport"
        >
          <ShieldCheck class="h-3.5 w-3.5 mr-1" />
          解密并导入备份
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

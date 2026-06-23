<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Info } from 'lucide-vue-next';
import QRCode from 'qrcode';
import { logError } from '@/utils/error';
import type { TwoFactorAccount } from '@/types';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps<{
  modelValue: boolean;
  account: TwoFactorAccount | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const qrCodeDataUrl = ref<string>('');

watch(
  () => props.modelValue,
  async (newVal) => {
    if (newVal && props.account) {
      const label = props.account.label;
      const email = props.account.email || 'account';
      const secret = props.account.secret;

      // Format: otpauth://totp/Label:email?secret=Secret&issuer=3DPlatform
      const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent('3D Learning Platform')}`;

      try {
        qrCodeDataUrl.value = await QRCode.toDataURL(otpauthUrl, {
          width: 250,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff',
          },
        });
      } catch (err) {
        logError(err, { operation: 'twoFactor.generateQrCode', component: 'TwoFactorQrDialog' });
        ElMessage.error('生成二维码失败');
        qrCodeDataUrl.value = '';
      }
    } else {
      qrCodeDataUrl.value = '';
    }
  },
);
</script>

<template>
  <Modal :show="visible" title="手机扫码导入" size="sm" glass-card @close="visible = false">
    <div class="mobile-adaptive flex flex-col items-center justify-center p-2 text-center">
      <!-- Big title info -->
      <h4 class="text-base font-bold mb-1" style="color: var(--text-primary)">
        {{ account?.label }}
      </h4>
      <p class="text-xs mb-4 truncate w-full max-w-[240px]" style="color: var(--text-secondary)">
        {{ account?.email || '无邮箱/用户名绑定' }}
      </p>

      <!-- QR Code Rendering Image Canvas Box -->
      <div
        v-if="qrCodeDataUrl"
        class="bg-white p-3 rounded-2xl shadow-inner mb-4 flex items-center justify-center border border-slate-200/10"
      >
        <img :src="qrCodeDataUrl" alt="Two-Factor Authenticator QR Code" class="w-48 h-48 block" />
      </div>

      <!-- Instructions -->
      <div
        class="text-[11px] leading-normal max-w-[250px] rounded-xl p-3 flex gap-2 items-start text-left border"
        style="
          color: var(--text-secondary);
          background-color: var(--bg-app);
          border-color: var(--border-base);
        "
      >
        <Info class="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
        <span
          >请使用手机端常用的两步验证 App（如 **谷歌身份验证器 (Google Authenticator)** 或 **微软
          Authenticator**）的扫码功能，扫描上方二维码直接导入该安全账号。</span
        >
      </div>
    </div>
  </Modal>
</template>

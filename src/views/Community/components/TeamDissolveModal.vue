<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useCommunityI18n } from '@/composables/useCommunityI18n';
import { Trash2 } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { getApiErrorMessage } from '@/utils/error';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import SafeHtml from '@/components/SafeHtml.vue';
import api from '@/utils/api';

const props = defineProps<{
  show: boolean;
  teamId: string;
  teamName?: string | null;
  twoFactorEnabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'dissolved'): void;
}>();

const { t } = useCommunityI18n();

const dissolveCode = ref('');
const isDissolving = ref(false);
const dissolveCountdown = ref(0);
let dissolveTimer: ReturnType<typeof setInterval> | null = null;

const startDissolveCountdown = () => {
  dissolveCountdown.value = 60;
  dissolveTimer = setInterval(() => {
    if (dissolveCountdown.value > 0) {
      dissolveCountdown.value--;
    } else {
      if (dissolveTimer) clearInterval(dissolveTimer);
    }
  }, 1000);
};

const sendDissolveCode = async () => {
  if (dissolveCountdown.value > 0) return;
  try {
    await api.post('/api/auth/email/send-code');
    ElMessage.success(t('teamDetail.verifyCodeSent'));
    startDissolveCountdown();
  } catch {
    ElMessage.error(t('teamDetail.inviteFailed'));
  }
};

watch(
  () => props.show,
  (isOpen) => {
    if (!isOpen) {
      dissolveCode.value = '';
      if (dissolveTimer) clearInterval(dissolveTimer);
      dissolveCountdown.value = 0;
    }
  },
);

onUnmounted(() => {
  if (dissolveTimer) clearInterval(dissolveTimer);
});

const confirmDeleteTeam = async () => {
  if (!dissolveCode.value) {
    return ElMessage.warning(t('teamDetail.enterCodeWarning'));
  }
  try {
    isDissolving.value = true;
    await api.delete(`/api/teams/${props.teamId}`, {
      data: { code: dissolveCode.value },
    });
    ElMessage.success(t('teamDetail.dissolveSuccess'));
    emit('dissolved');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('teamDetail.dissolveFailed')));
  } finally {
    isDissolving.value = false;
  }
};
</script>

<template>
  <Modal :show="show" size="sm" glass-card @close="$emit('close')">
    <template #header>
      <div class="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl text-rose-500 w-fit">
        <Trash2 class="w-6 h-6" />
      </div>
    </template>

    <div class="space-y-6">
      <div>
        <h3 class="text-2xl font-black text-rose-600">
          {{ t('teamDetail.dissolveConfirmTitle') }}
        </h3>
        <SafeHtml
          class="text-xs text-slate-400 font-medium mt-1 leading-relaxed"
          tag="p"
          :html="t('teamDetail.dissolveWarning', { name: teamName })"
        />
      </div>

      <div class="space-y-4">
        <div v-if="twoFactorEnabled" class="space-y-2">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{{
            t('teamDetail.twoFactorLabel')
          }}</label>
          <input
            v-model="dissolveCode"
            type="text"
            maxlength="6"
            placeholder="000000"
            class="w-full px-6 py-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-center text-2xl font-black tracking-[0.5em] focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
            style="color: var(--text-primary)"
          />
        </div>
        <div v-else class="space-y-2">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{{
            t('teamDetail.emailCodeLabel')
          }}</label>
          <div class="flex gap-3">
            <input
              v-model="dissolveCode"
              type="text"
              maxlength="6"
              placeholder="000000"
              class="flex-1 px-6 py-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-center text-xl font-black tracking-[0.2em] focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
              style="color: var(--text-primary)"
            />
            <Button
              variant="secondary"
              size="lg"
              :disabled="dissolveCountdown > 0"
              class="!rounded-2xl shrink-0"
              @click="sendDissolveCode"
            >
              {{ dissolveCountdown > 0 ? `${dissolveCountdown}s` : t('teamDetail.getCodeBtn') }}
            </Button>
          </div>
        </div>
      </div>

      <Button
        variant="danger"
        size="lg"
        full-width
        :disabled="isDissolving || dissolveCode.length !== 6"
        :loading="isDissolving"
        :icon="Trash2"
        @click="confirmDeleteTeam"
      >
        {{ t('teamDetail.confirmDissolveBtn') }}
      </Button>
    </div>
  </Modal>
</template>

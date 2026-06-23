<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, Sliders } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import type { ImportForm } from './email-types';

interface Props {
  show: boolean;
  modelValue: ImportForm;
  isLoading: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ImportForm): void;
  (e: 'close'): void;
  (e: 'submit'): void;
}>();

const form = computed({
  get: () => props.modelValue,
  set: (val: ImportForm) => emit('update:modelValue', val),
});
</script>

<template>
  <Modal
    :show="show"
    :title="$t('tools.email.batch_import')"
    size="lg"
    glass-card
    @close="$emit('close')"
  >
    <div class="flex flex-col gap-4 text-left">
      <div
        class="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-950 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed"
      >
        <AlertTriangle class="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
        <div>
          <p class="font-semibold">{{ $t('tools.email.import_instructions') }}</p>
          <p class="mt-1 font-mono text-[11px]">{{ $t('tools.email.import_format_p1') }}</p>
          <p class="mt-1">
            {{ $t('tools.email.import_format_p2')
            }}<code
              class="font-mono bg-amber-100 dark:bg-amber-950/80 px-1 py-0.5 rounded text-[10px]"
              >{{ $t('tools.email.import_format_p3') }}</code
            >
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold text-slate-400">导入文本框</label>
        <textarea
          v-model="form.text"
          placeholder="example@outlook.com----mypassword----00000000-0000-0000-0000-000000000000----MC...3u
example2@hotmail.com----00000000-0000-0000-0000-000000000000----MC...9a"
          class="w-full h-44 text-xs font-mono px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white resize-none transition-all duration-200"
        ></textarea>
      </div>

      <!-- Extra safe configs associated with this batch -->
      <div class="border-t border-slate-100 dark:border-slate-900 pt-4">
        <div class="px-1 mb-3 text-xs font-bold text-slate-500 flex items-center gap-1.5">
          <Sliders class="w-4 h-4 text-indigo-500" />
          <span>批量账号防封安全初始配置</span>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-[11px] font-semibold text-slate-400">{{
              $t('tools.email.default_proxy_label')
            }}</label>
            <input
              v-model="form.proxy"
              type="text"
              placeholder="http://username:password@proxy_ip:port"
              class="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 transition-all duration-200"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-[11px] font-semibold text-slate-400">{{
              $t('tools.email.daily_limit_label')
            }}</label>
            <el-input-number
              v-model="form.dailyLimit"
              :min="1"
              :max="1000"
              size="small"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-[11px] font-semibold text-slate-400">{{
              $t('tools.email.min_delay_label')
            }}</label>
            <el-input-number
              v-model="form.minDelay"
              :min="1"
              :max="120"
              size="small"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-[11px] font-semibold text-slate-400">{{
              $t('tools.email.max_delay_label')
            }}</label>
            <el-input-number
              v-model="form.maxDelay"
              :min="5"
              :max="300"
              size="small"
              class="w-full"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" @click="$emit('close')">取消</Button>
        <Button variant="primary" :loading="isLoading" size="sm" @click="$emit('submit')">{{
          $t('tools.email.confirm_parse_btn')
        }}</Button>
      </div>
    </template>
  </Modal>
</template>

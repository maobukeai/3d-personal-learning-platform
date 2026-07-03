<script setup lang="ts">
import { ref, watch } from 'vue';
import { RefreshCw } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';

const label = useLabel();

const props = defineProps<{
  show: boolean;
  isSubmitting: boolean;
  modalTitle: string;
  titlePlaceholder: string;
  descPlaceholder: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', form: { title: string; description: string }): void;
}>();

const form = ref({ title: '', description: '' });

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      form.value = { title: '', description: '' };
    }
  },
);

const handleSubmit = () => {
  if (!form.value.title.trim() || !form.value.description.trim()) return;
  emit('submit', {
    title: form.value.title.trim(),
    description: form.value.description.trim(),
  });
};
</script>

<template>
  <Modal :show="show" size="md" @close="emit('close')">
    <template #header>
      <h3 class="text-sm font-bold text-[var(--text-primary)]">
        {{ modalTitle }}
      </h3>
    </template>

    <div class="flex flex-col gap-4 text-left">
      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
          {{ label('求助标题', 'Title') }}
        </label>
        <Input
          v-model="form.title"
          type="text"
          :placeholder="titlePlaceholder"
          required
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
          {{ label('求助详情描述', 'Description') }}
        </label>
        <textarea
          v-model="form.description"
          rows="5"
          class="w-full rounded-xl bg-white/[0.01] border border-white/10 focus:border-indigo-500/50 p-3 text-xs text-[var(--text-primary)] outline-none resize-none focus:ring-1 focus:ring-indigo-500/20"
          :placeholder="descPlaceholder"
          required
        ></textarea>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <Button variant="secondary" size="sm" @click="emit('close')">
          {{ label('取消', 'Cancel') }}
        </Button>
        <Button
          variant="primary"
          size="sm"
          :disabled="isSubmitting || !form.title.trim() || !form.description.trim()"
          class="flex items-center gap-1 cursor-pointer"
          @click="handleSubmit"
        >
          <RefreshCw v-if="isSubmitting" class="w-3 h-3 animate-spin" />
          <span>{{ label('发布', 'Post') }}</span>
        </Button>
      </div>
    </div>
  </Modal>
</template>

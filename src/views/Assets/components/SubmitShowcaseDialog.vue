<script setup lang="ts">
import { computed } from 'vue';
import Input from '@/components/ui/Input.vue';

interface ShowcaseForm {
  assetId: string;
  title: string;
  description: string;
  tags: string;
}

const show = defineModel<boolean>('show', { required: true });
const form = defineModel<ShowcaseForm>('form', { required: true });

defineProps<{
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [];
}>();

const title = computed({
  get: () => form.value.title,
  set: (v) => emitUpdate({ title: v }),
});
const description = computed({
  get: () => form.value.description,
  set: (v) => emitUpdate({ description: v }),
});
const tags = computed({
  get: () => form.value.tags,
  set: (v) => emitUpdate({ tags: v }),
});

function emitUpdate(patch: Partial<ShowcaseForm>) {
  form.value = { ...form.value, ...patch };
}
</script>

<template>
  <Modal :show="show" size="lg" glass-card @close="show = false">
    <template #header>
      <div>
        <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">
          发布到作品展示
        </h3>
        <p class="text-xs text-[var(--text-muted)] mt-1">用已审核资源生成展示作品。</p>
      </div>
    </template>

    <div class="space-y-4">
      <Input v-model="title" type="text" label="展示标题" required />
      <label class="flex flex-col">
        <span
          class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]"
          >展示说明</span
        >
        <textarea
          v-model="description"
          rows="4"
          class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
        ></textarea>
      </label>
      <Input v-model="tags" type="text" label="标签" />
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" @click="show = false"> 取消 </Button>
        <Button variant="primary" size="sm" :loading="isSubmitting" @click="emit('submit')">
          提交审核
        </Button>
      </div>
    </template>
  </Modal>
</template>

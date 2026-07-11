<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import FormDialog from '@/components/FormDialog.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import Switch from '@/components/ui/Switch.vue';
import DatePicker from '@/components/ui/DatePicker.vue';
import type { AdminFormField } from './types';
interface Props {
  visible: boolean;
  title: string;
  fields: AdminFormField[];
  initialData?: Record<string, unknown>;
  loading?: boolean;
}
const props = withDefaults(defineProps<Props>(), { initialData: () => ({}), loading: false });
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'submit', data: Record<string, unknown>): void;
}>();
const form = reactive<Record<string, unknown>>({});
const errors = ref<Record<string, string>>({});
const defaultForType = (field: AdminFormField): unknown => {
  if (field.defaultValue !== undefined) return field.defaultValue;
  switch (field.type) {
    case 'multiselect':
      return [];
    case 'switch':
      return false;
    case 'number':
      return '';
    default:
      return '';
  }
};
const resetForm = () => {
  for (const field of props.fields) {
    const fromInitial = props.initialData?.[field.key];
    form[field.key] = fromInitial !== undefined ? fromInitial : defaultForType(field);
  }
  errors.value = {};
};
watch(
  () => props.visible,
  (open) => {
    if (open) resetForm();
  },
); // Also reset when fields change (e.g. switching between create/edit configs).
watch(
  () => props.fields,
  () => {
    if (props.visible) resetForm();
  },
);
const validate = (): boolean => {
  const next: Record<string, string> = {};
  for (const field of props.fields) {
    if (!field.required) continue;
    const v = form[field.key];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) {
      next[field.key] = `${field.label} is required`;
    }
  }
  errors.value = next;
  return Object.keys(next).length === 0;
};
const isValid = computed(() => {
  for (const field of props.fields) {
    if (!field.required) continue;
    const v = form[field.key];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) return false;
  }
  return true;
});
const handleSubmit = () => {
  if (!validate()) return;
  const payload: Record<string, unknown> = {};
  for (const field of props.fields) {
    payload[field.key] = form[field.key];
  }
  emit('submit', payload);
};
const handleClose = () => {
  emit('update:visible', false);
};
const fieldSpanClass = (field: AdminFormField): string => (field.span === 2 ? 'sm:col-span-2' : '');
const updateField = (key: string, value: unknown) => {
  form[key] = value;
  if (errors.value[key]) {
    const next = { ...errors.value };
    delete next[key];
    errors.value = next;
  }
};
</script>
<template>
  <FormDialog
    :visible="visible"
    :title="title"
    :loading="loading"
    size="lg"
    :confirm-disabled="!isValid"
    submit-label="Save"
    @update:visible="handleClose"
    @cancel="handleClose"
    @submit="handleSubmit"
  >
    <div class="crud-grid grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 py-1">
      <template v-for="field in fields" :key="field.key">
        <!-- text / number -->
        <div v-if="field.type === 'text' || field.type === 'number'" :class="fieldSpanClass(field)">
          <Input
            :model-value="String(form[field.key] ?? '')"
            :type="field.type === 'number' ? 'number' : 'text'"
            :label="field.label"
            :placeholder="field.placeholder ?? ''"
            :required="field.required"
            :error="errors[field.key] ?? ''"
            @update:model-value="
              (v: string) =>
                updateField(field.key, field.type === 'number' ? (v === '' ? '' : Number(v)) : v)
            "
          />
          <p v-if="field.help" class="crud-help typo-caption mt-1 ml-1">{{ field.help }}</p>
        </div>
        <!-- textarea -->
        <div v-else-if="field.type === 'textarea'" :class="fieldSpanClass(field)">
          <label
            class="crud-label block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-muted-foreground"
          >
            {{ field.label }} <span v-if="field.required" class="text-destructive ml-0.5">*</span>
          </label>
          <textarea
            :value="String(form[field.key] ?? '')"
            :placeholder="field.placeholder ?? ''"
            rows="3"
            class="crud-textarea w-full text-sm font-medium border border-border bg-background text-foreground px-4 py-3 outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-accent resize-y"
            :class="errors[field.key] ? '!border-destructive/50' : ''"
            @input="updateField(field.key, ($event.target as HTMLTextAreaElement).value)"
          />
          <p v-if="errors[field.key]" class="text-xs font-semibold text-destructive mt-1.5 ml-1">
            {{ errors[field.key] }}
          </p>
          <p v-else-if="field.help" class="crud-help typo-caption mt-1 ml-1">{{ field.help }}</p>
        </div>
        <!-- select -->
        <div v-else-if="field.type === 'select'" :class="fieldSpanClass(field)">
          <label
            class="crud-label block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-muted-foreground"
          >
            {{ field.label }} <span v-if="field.required" class="text-destructive ml-0.5">*</span>
          </label>
          <Select
            :model-value="form[field.key]"
            :options="field.options"
            :placeholder="field.placeholder ?? 'Select...'"
            @update:model-value="(v: unknown) => updateField(field.key, v)"
          />
          <p v-if="errors[field.key]" class="text-xs font-semibold text-destructive mt-1.5 ml-1">
            {{ errors[field.key] }}
          </p>
          <p v-else-if="field.help" class="crud-help typo-caption mt-1 ml-1">{{ field.help }}</p>
        </div>
        <!-- multiselect -->
        <div v-else-if="field.type === 'multiselect'" :class="fieldSpanClass(field)">
          <label
            class="crud-label block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-muted-foreground"
          >
            {{ field.label }} <span v-if="field.required" class="text-destructive ml-0.5">*</span>
          </label>
          <Select
            :model-value="form[field.key]"
            :options="field.options"
            :placeholder="field.placeholder ?? 'Select...'"
            multiple
            @update:model-value="(v: unknown) => updateField(field.key, v)"
          >
            <SelectOption
              v-for="opt in field.options"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </Select>
          <p v-if="errors[field.key]" class="text-xs font-semibold text-destructive mt-1.5 ml-1">
            {{ errors[field.key] }}
          </p>
          <p v-else-if="field.help" class="crud-help typo-caption mt-1 ml-1">{{ field.help }}</p>
        </div>
        <!-- switch -->
        <div v-else-if="field.type === 'switch'" :class="fieldSpanClass(field)">
          <label
            class="crud-label block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-muted-foreground"
          >
            {{ field.label }}
          </label>
          <Switch
            :model-value="Boolean(form[field.key])"
            @update:model-value="(v: boolean) => updateField(field.key, v)"
          />
          <p v-if="field.help" class="crud-help typo-caption mt-1 ml-1">{{ field.help }}</p>
        </div>
        <!-- date -->
        <div v-else-if="field.type === 'date'" :class="fieldSpanClass(field)">
          <label
            class="crud-label block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-muted-foreground"
          >
            {{ field.label }} <span v-if="field.required" class="text-destructive ml-0.5">*</span>
          </label>
          <DatePicker
            :model-value="(form[field.key] as string | Date | null) ?? null"
            :placeholder="field.placeholder ?? 'Pick a date'"
            @update:model-value="(v: any) => updateField(field.key, v)"
          />
          <p v-if="errors[field.key]" class="text-xs font-semibold text-destructive mt-1.5 ml-1">
            {{ errors[field.key] }}
          </p>
          <p v-else-if="field.help" class="crud-help typo-caption mt-1 ml-1">{{ field.help }}</p>
        </div>
      </template>
    </div>
  </FormDialog>
</template>
<style scoped>
.crud-grid {
  min-width: 0;
}
.crud-textarea {
  min-width: 0;
  border-radius: var(--radius-field);
}
</style>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import { Eye, EyeOff, X } from 'lucide-vue-next';

interface Props {
  modelValue?: string | number;
  type?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  icon?: Component | null;
  iconPosition?: 'left' | 'right';
  clearable?: boolean;
  glass?: boolean;
  required?: boolean;
  id?: string;
  inputClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  label: '',
  placeholder: '',
  disabled: false,
  error: '',
  icon: null,
  iconPosition: 'left',
  clearable: false,
  glass: true,
  required: false,
  id: () => `input-${Math.random().toString(36).substring(2, 9)}`,
  inputClass: '',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'clear'): void;
}>();

const isFocused = ref(false);
const showPassword = ref(false);

const inputType = computed(() => {
  if (props.type === 'password') {
    return showPassword.value ? 'text' : 'password';
  }
  return props.type;
});

const hasValue = computed(() => {
  return props.modelValue !== undefined && props.modelValue !== null && props.modelValue !== '';
});

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
};

const handleFocus = (event: FocusEvent) => {
  isFocused.value = true;
  emit('focus', event);
};

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false;
  emit('blur', event);
};

const handleClear = () => {
  emit('update:modelValue', '');
  emit('clear');
};
</script>

<template>
  <div class="flex flex-col w-full text-left font-sans">
    <!-- Top Label (Non-floating) -->
    <label
      v-if="label"
      :for="id"
      class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 transition-colors duration-200"
      :class="[error ? 'text-red-500' : isFocused ? 'text-accent' : 'text-[var(--text-secondary)]']"
    >
      {{ label }}
      <span v-if="required" class="text-red-500 ml-0.5">*</span>
    </label>

    <div class="relative w-full group">
      <!-- Prefix Slot or Icon -->
      <div
        v-if="$slots.prefix || (icon && iconPosition === 'left')"
        class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10 text-[var(--text-secondary)] transition-colors duration-200"
        :class="{ 'text-accent': isFocused, 'text-red-500': error }"
      >
        <slot name="prefix">
          <component :is="icon" class="w-4 h-4 shrink-0" />
        </slot>
      </div>

      <!-- Main Input element -->
      <input
        :id="id"
        :type="inputType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        :class="[
          glass
            ? 'glass-input'
            : 'bg-card border border-base text-[var(--text-primary)] focus:border-accent',
          error
            ? '!border-red-500/50 focus:!ring-red-500/20 focus:!border-red-500'
            : 'focus:ring-2 focus:ring-accent/20 focus:border-accent',
          $slots.prefix || (icon && iconPosition === 'left') ? '!pl-10' : '!pl-4',
          $slots.suffix || type === 'password' || clearable || (icon && iconPosition === 'right')
            ? '!pr-12'
            : '!pr-4',
          '!py-3',
          inputClass,
        ]"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
      />

      <!-- Suffix Controls (Clear, Password View, Suffix Slot) -->
      <div
        class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10 text-[var(--text-secondary)]"
      >
        <!-- Clearable Button -->
        <button
          v-if="clearable && hasValue && !disabled"
          type="button"
          class="p-0.5 hover:text-accent rounded-full hover:bg-[var(--bg-hover)] transition-colors"
          @click="handleClear"
        >
          <X class="w-3.5 h-3.5" />
        </button>

        <!-- Password Visibility Switcher -->
        <button
          v-if="type === 'password' && !disabled"
          type="button"
          class="p-0.5 hover:text-accent rounded-full hover:bg-[var(--bg-hover)] transition-colors"
          @click="showPassword = !showPassword"
        >
          <Eye v-if="!showPassword" class="w-4.5 h-4.5" />
          <EyeOff v-else class="w-4.5 h-4.5" />
        </button>

        <!-- Suffix Slot -->
        <slot name="suffix">
          <component
            :is="icon"
            v-if="icon && iconPosition === 'right' && type !== 'password'"
            class="w-4.5 h-4.5"
            :class="{ 'text-accent': isFocused, 'text-red-500': error }"
          />
        </slot>
      </div>
    </div>

    <!-- Error message display -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-1 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-1 opacity-0"
    >
      <span v-if="error" class="text-xs font-semibold text-red-500 mt-1.5 ml-1">
        {{ error }}
      </span>
    </transition>
  </div>
</template>

import type { InjectionKey, ComputedRef } from 'vue';
export interface RadioGroupContext {
  modelValue: ComputedRef<string | number | boolean>;
  size: ComputedRef<'large' | 'default' | 'small'>;
  disabled: ComputedRef<boolean>;
  changeValue: (val: string | number | boolean) => void;
}
export const radioGroupKey: InjectionKey<RadioGroupContext> = Symbol('radioGroup');

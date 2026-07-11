import type { InjectionKey, ComputedRef } from 'vue';
export interface CheckboxGroupContext {
  modelValue: ComputedRef<(string | number | boolean)[]>;
  disabled: ComputedRef<boolean>;
  toggleValue: (val: string | number | boolean) => void;
  isChecked: (val: string | number | boolean) => boolean;
}
export const checkboxGroupKey: InjectionKey<CheckboxGroupContext> = Symbol('checkboxGroup');

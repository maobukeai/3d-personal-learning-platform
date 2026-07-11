import type { InjectionKey } from 'vue';

export interface DropdownContext {
  select: (command: string | number | undefined) => void;
}

export const dropdownContextKey: InjectionKey<DropdownContext> = Symbol('dropdown-context');

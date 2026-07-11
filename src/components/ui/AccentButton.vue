<script setup lang="ts">
import { computed } from 'vue';
import { Loader2 } from 'lucide-vue-next'; /** * AccentButton — accent 渐变/实色按钮原语。 * 用于消除 AISprite / SpriteChatArea 中 .ai-logo / .ai-trigger / .ai-send-btn * 重复定义的 accent 渐变 + box-shadow accent 阴影。 * 不使用；全部样式消费 tokens.css 中的 token。 */
interface Props {
  /** 渐变（135deg accent-light → accent）或实色 accent 底 */ variant?: 'gradient' | 'solid';
  /** accent 主色或 neutral 中性色 */ tone?: 'accent' | 'neutral';
  /** Canonical sizes: sm/md/lg (same as Button). Legacy aliases small/default/large * are accepted for backward compatibility and normalized to the matching tier. */ size?:
    | 'sm'
    | 'md'
    | 'lg'
    | 'small'
    | 'default'
    | 'large';
  /** 图标按钮模式：圆形、无 padding，必须提供 ariaLabel */ icon?: boolean;
  /** 禁用 */ disabled?: boolean;
  /** 加载中（显示 spinner，不可点击） */ loading?: boolean;
  /** 原生 button type */ type?: 'button' | 'submit' | 'reset';
  /** 撑满父容器宽度 */ fullWidth?: boolean;
  /** 无障碍标签，icon 模式下必须提供 */ ariaLabel?: string;
}
const props = withDefaults(defineProps<Props>(), {
  variant: 'gradient',
  tone: 'accent',
  size: 'md',
  icon: false,
  disabled: false,
  loading: false,
  type: 'button',
  fullWidth: false,
  ariaLabel: undefined,
});
const emit = defineEmits<{ (e: 'click', event: MouseEvent): void }>(); // icon 模式必须提供 ariaLabel —— 开发环境给出提示
if (import.meta.env?.DEV && props.icon && !props.ariaLabel) {
  console.warn('[AccentButton] icon 模式必须提供 ariaLabel 以满足无障碍要求。');
}
const handleClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  emit('click', event);
};
const normalizedSize = computed<'sm' | 'md' | 'lg'>(() => {
  switch (props.size) {
    case 'small':
      return 'sm';
    case 'default':
      return 'md';
    case 'large':
      return 'lg';
    default:
      return props.size;
  }
});
const classes = computed(() => [
  'accent-btn',
  `accent-btn--${props.variant}`,
  `accent-btn--tone-${props.tone}`,
  `accent-btn--${normalizedSize.value}`,
  { 'accent-btn--icon': props.icon, 'accent-btn--full': props.fullWidth },
]);
const iconSize = computed(() => {
  switch (normalizedSize.value) {
    case 'sm':
      return 'w-3.5 h-3.5';
    case 'lg':
      return 'w-5 h-5';
    case 'md':
    default:
      return 'w-4 h-4';
  }
});
</script>
<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-label="icon ? ariaLabel : undefined"
    :aria-disabled="disabled || undefined"
    :aria-busy="loading || undefined"
    :class="classes"
    @click="handleClick"
  >
    <!-- Loading spinner -->
    <Loader2 v-if="loading" class="animate-spin shrink-0" :class="iconSize" />
    <!-- 图标插槽（loading 时不渲染） -->
    <span
      v-else-if="$slots.icon"
      class="accent-btn__icon inline-flex items-center justify-center shrink-0"
      :class="iconSize"
    >
      <slot name="icon" />
    </span>
    <!-- 默认插槽（按钮内容） -->
    <span
      v-if="$slots.default"
      class="accent-btn__content inline-flex items-center justify-center gap-1.5 truncate"
    >
      <slot></slot>
    </span>
  </button>
</template>
<style scoped>
.accent-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-weight: var(--font-semibold);
  line-height: 1;
  border-radius: var(--radius-md); /* 8px 按钮规范 */
  border: 1px solid transparent;
  cursor: pointer;
  outline: none;
  user-select: none;
  white-space: nowrap;
  transition:
    background var(--duration-base) var(--ease-standard),
    box-shadow var(--duration-base) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard),
    opacity var(--duration-base) var(--ease-standard),
    border-color var(--duration-base) var(--ease-standard);
}
.accent-btn:focus-visible {
  box-shadow:
    0 4px 12px rgba(var(--accent-rgb), 0.3),
    0 0 0 2px var(--bg-app),
    0 0 0 4px rgba(var(--accent-rgb), 0.5);
}
.accent-btn:active:not(:disabled) {
  transform: scale(0.98);
} /* ============================================================ 尺寸 ============================================================ */
.accent-btn--sm {
  padding: 0 var(--space-3);
  font-size: var(--text-xs);
  height: 32px;
}
.accent-btn--md {
  padding: 0 var(--space-4);
  font-size: var(--text-sm);
  height: 38px;
}
.accent-btn--lg {
  padding: 0 var(--space-5);
  font-size: var(--text-lg);
  height: 44px;
} /* 图标模式：圆形、无 padding */
.accent-btn--icon {
  padding: 0;
  border-radius: 9999px;
}
.accent-btn--icon.accent-btn--sm {
  width: 32px;
  height: 32px;
}
.accent-btn--icon.accent-btn--md {
  width: 38px;
  height: 38px;
}
.accent-btn--icon.accent-btn--lg {
  width: 44px;
  height: 44px;
}
.accent-btn--full {
  width: 100%;
} /* 图标插槽尺寸传递：slotted svg 填满 wrapper */
.accent-btn__icon :deep(svg) {
  width: 100%;
  height: 100%;
} /* ============================================================ Accent tone ============================================================ */ /* —— gradient 变体 —— */
.accent-btn--tone-accent.accent-btn--gradient {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 70%, white 30%),
    var(--accent)
  );
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.3);
}
.accent-btn--tone-accent.accent-btn--gradient:hover:not(:disabled) {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 80%, white 20%),
    var(--accent-hover)
  );
  box-shadow: 0 6px 18px rgba(var(--accent-rgb), 0.45);
  transform: translateY(-1px);
} /* —— solid 变体 —— */
.accent-btn--tone-accent.accent-btn--solid {
  background: var(--accent);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.3);
}
.accent-btn--tone-accent.accent-btn--solid:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: 0 6px 18px rgba(var(--accent-rgb), 0.45);
  transform: translateY(-1px);
} /* —— dark 主题：提亮渐变以保证对比度 —— */
.dark .accent-btn--tone-accent.accent-btn--gradient {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 78%, white 22%),
    var(--accent)
  );
}
.dark .accent-btn--tone-accent.accent-btn--gradient:hover:not(:disabled) {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 86%, white 14%),
    var(--accent-hover)
  );
} /* ============================================================ Neutral tone ============================================================ */
.accent-btn--tone-neutral {
  color: var(--text-secondary);
  border-color: var(--border-base);
  box-shadow: none;
}
.accent-btn--tone-neutral.accent-btn--solid {
  background: var(--bg-subtle);
}
.accent-btn--tone-neutral.accent-btn--gradient {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bg-subtle) 80%, white 20%),
    var(--bg-subtle)
  );
}
.accent-btn--tone-neutral:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.dark .accent-btn--tone-neutral:hover:not(:disabled) {
  color: var(--text-primary);
} /* ============================================================ 状态：disabled / loading ============================================================ */
.accent-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}
.accent-btn[aria-busy='true'] {
  cursor: progress;
}
</style>

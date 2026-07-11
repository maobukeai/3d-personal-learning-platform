<script setup lang="ts">
import { ref, watch } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
type SurfaceVariant = 'solid' | 'glass' | 'plain';
interface Props {
  title?: string;
  count?: number;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** * Surface treatment. Defaults to `solid` — the mandatory opaque surface * for cards / tables / forms / resource cards. Use `glass` ONLY for nav / * overlays / 3D overlays. `plain` renders no surface (transparent) for * nested groupings that already sit inside a surfaced parent. */ surface?: SurfaceVariant;
  /** Optional description rendered under the title (typography level 3). */ description?: string;
}
const props = withDefaults(defineProps<Props>(), {
  title: '',
  count: undefined,
  collapsible: false,
  defaultOpen: true,
  surface: 'solid',
  description: '',
});
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();
const isOpen = ref(props.defaultOpen);
watch(isOpen, (next) => {
  emit('update:open', next);
});
const toggle = () => {
  if (!props.collapsible) return;
  isOpen.value = !isOpen.value;
};
const hasHeader =
  !!props.title || props.count !== undefined || props.collapsible || !!props.description;
</script>
<template>
  <section
    class="content-section"
    :class="[`is-surface-${surface}`, { 'is-collapsible': collapsible }]"
  >
    <header v-if="hasHeader" class="content-section__header">
      <div
        class="content-section__title-group"
        :class="{ 'is-clickable': collapsible }"
        @click="toggle"
      >
        <button
          v-if="collapsible"
          type="button"
          class="content-section__chevron"
          :class="{ 'is-open': isOpen }"
          :aria-expanded="isOpen"
          aria-label="Toggle section"
        >
          <ChevronDown class="w-4 h-4" />
        </button>
        <div class="content-section__title-text">
          <h2 v-if="title" class="content-section__title">{{ title }}</h2>
          <p v-if="description" class="content-section__description">{{ description }}</p>
        </div>
        <span v-if="count !== undefined" class="content-section__count"> {{ count }} </span>
      </div>
      <div v-if="$slots.actions" class="content-section__actions shrink-0">
        <slot name="actions" />
      </div>
    </header>
    <div v-show="!collapsible || isOpen" class="content-section__body"><slot /></div>
  </section>
</template>
<style scoped>
/* ── Surface variants ── `solid` (default) = opaque content surface for tables/forms/cards. `glass` = translucent (nav / overlays / 3D ONLY). `plain` = no surface, for nested groupings. All values come from CSS variables; no glass on content surfaces. */
.content-section {
  margin-block-start: var(--space-6);
  border-radius: var(--surface-solid-radius);
}
.content-section.is-surface-solid {
  background-color: var(--surface-solid);
  border: 1px solid var(--surface-solid-border);
  color: var(--text-on-solid-primary);
}
.content-section.is-surface-glass {
  background-color: var(--surface-glass);
  border: 1px solid var(--surface-glass-border);
}
.content-section.is-surface-plain {
  background: transparent;
  border: none;
} /* Single-channel card feedback: when the whole section is collapsible (interactive), signal affordance via the border channel only — never combine border + background + shadow. */
.content-section.is-collapsible.is-surface-solid {
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.content-section.is-collapsible.is-surface-solid:hover {
  border-color: var(--card-border-hover);
}
.content-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
}
.content-section.is-surface-plain .content-section__header {
  padding-block: var(--space-2);
  padding-inline: 0;
}
.content-section__title-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.content-section__title-group.is-clickable {
  cursor: pointer;
  user-select: none;
}
.content-section__title-group.is-clickable:hover .content-section__title {
  color: var(--text-on-solid-primary);
}
.content-section__title-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.content-section__chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-on-solid-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    background 0.15s ease;
  flex-shrink: 0;
}
.content-section__chevron.is-open {
  transform: rotate(180deg);
}
.content-section__chevron:hover {
  background: var(--bg-hover);
} /* Section title = typography Level 2. Long text never truncates. */
.content-section__title {
  margin: 0;
  font-size: var(--typo-h2-font-size);
  line-height: var(--typo-h2-line-height);
  font-weight: var(--typo-h2-font-weight);
  letter-spacing: var(--typo-h2-letter-spacing);
  color: var(--text-on-solid-secondary);
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  transition: color 0.15s ease;
} /* Description = typography Level 3. */
.content-section__description {
  margin: 0;
  font-size: var(--typo-h3-font-size);
  line-height: var(--typo-h3-line-height);
  font-weight: var(--typo-h3-font-weight);
  color: var(--text-on-solid-muted);
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
} /* Count badge = caption level. */
.content-section__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-2);
  border-radius: 9999px;
  background: var(--bg-subtle);
  color: var(--text-on-solid-muted);
  font-size: var(--typo-caption-font-size);
  font-weight: 600;
  line-height: 1;
  flex-shrink: 0;
}
.content-section__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.content-section__body {
  padding: var(--space-4);
  padding-block-start: 0;
}
.content-section.is-surface-plain .content-section__body {
  padding: 0;
}
</style>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
interface Props {
  /** Max content width. Defaults to the --page-max-width token (1440px). */ maxWidth?: string;
  /** Apply the desktop/mobile horizontal gutter (--page-gutter). */ gutter?: boolean;
  /** Make the content area scrollable (default true). */ scroll?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  maxWidth: 'var(--page-max-width)',
  gutter: true,
  scroll: true,
});
const slots = useSlots();
const frameStyles = computed(() => ({
  maxWidth: props.maxWidth,
})); /** * Structured rhythm mode is opt-in: when a page provides the `#header` or * `#toolbar` named slot, the frame pins Header → Toolbar above a scrolling * Content area (the default slot). When neither is supplied, the frame falls * back to a single flat scroll container so all existing call sites keep * working unchanged. */
const structured = computed(() => !!(slots.header || slots.toolbar));
</script>
<template>
  <div
    class="page-frame"
    :class="{
      'has-gutter': gutter,
      'is-scrollable': scroll && !structured,
      'is-structured': structured,
    }"
    :style="frameStyles"
  >
    <!-- Structured vertical rhythm: Header → Toolbar → Content -->
    <template v-if="structured">
      <div v-if="$slots.header" class="page-frame__region page-frame__header">
        <slot name="header" />
      </div>
      <div v-if="$slots.toolbar" class="page-frame__region page-frame__toolbar">
        <slot name="toolbar" />
      </div>
      <div class="page-frame__region page-frame__content" :class="{ 'is-scrollable': scroll }">
        <slot />
      </div>
    </template>
    <!-- Backward-compatible flat mode -->
    <template v-else> <slot /> </template>
  </div>
</template>
<style scoped>
.page-frame {
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.page-frame.has-gutter {
  padding-inline: var(--page-gutter);
}
.page-frame.is-scrollable {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
} /* ── Structured rhythm ── All spacing sourced from CSS variables. Header and Toolbar are pinned (shrink: 0); Content fills the remainder and scrolls independently. */
.page-frame.is-structured {
  flex: 1;
  overflow: hidden;
  gap: var(--page-rhythm-gap);
  padding-block: var(--space-4);
}
.page-frame__region {
  min-width: 0;
}
.page-frame__header,
.page-frame__toolbar {
  flex-shrink: 0;
}
.page-frame__content {
  flex: 1;
  min-height: 0;
}
.page-frame__content.is-scrollable {
  overflow-y: auto;
  overflow-x: hidden;
}
@media (max-width: 768px) {
  .page-frame.has-gutter {
    padding-inline: var(--page-gutter-mobile);
  }
  .page-frame.is-structured {
    gap: var(--space-3);
    padding-block: var(--space-3);
  }
}
</style>

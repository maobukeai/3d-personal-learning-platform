<script setup lang="ts">
import { computed, useSlots } from 'vue';
interface Props {
  /** Page title rendered with the typography Level 1 token. */ title: string;
  /** Optional description rendered under the title (typography Level 3). */ description?: string;
  /** Max content width. Defaults to the --page-max-width token (1440px). */ maxWidth?: string;
  /** Apply the desktop/mobile horizontal gutter (--page-gutter). */ gutter?: boolean;
  /** Make the content area scroll independently (default true). */ scroll?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  description: '',
  maxWidth: 'var(--page-max-width)',
  gutter: true,
  scroll: true,
});
const slots = useSlots();
const hasToolbar = computed(() => !!slots.toolbar);
const hasDescription = computed(() => !!props.description);
const shellStyles = computed(() => ({ maxWidth: props.maxWidth }));
</script>
<template>
  <div
    class="workbench-shell"
    :class="{ 'has-gutter': gutter, 'is-scrollable': scroll }"
    :style="shellStyles"
  >
    <header class="workbench-shell__header">
      <div class="workbench-shell__heading">
        <h1 class="workbench-shell__title typo-h1">{{ title }}</h1>
        <p v-if="hasDescription" class="workbench-shell__description typo-h3">{{ description }}</p>
      </div>
      <div v-if="hasToolbar" class="workbench-shell__toolbar"><slot name="toolbar" /></div>
    </header>
    <div class="workbench-shell__content" :class="{ 'is-scrollable': scroll }"><slot /></div>
  </div>
</template>
<style scoped>
.workbench-shell {
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.workbench-shell.has-gutter {
  padding-inline: var(--page-gutter);
}
.workbench-shell.is-scrollable {
  overflow-y: auto;
  overflow-x: hidden;
} /* Header: title + description on the left, toolbar actions on the right. Pinned (shrink: 0) so the content area scrolls independently. */
.workbench-shell__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex-shrink: 0;
  padding-block: var(--space-4);
}
@media (min-width: 768px) {
  .workbench-shell__header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }
}
.workbench-shell__heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.workbench-shell__title {
  margin: 0;
}
.workbench-shell__description {
  margin: 0;
}
.workbench-shell__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  flex-wrap: wrap;
} /* Content area: fills the remainder and scrolls independently. */
.workbench-shell__content {
  flex: 1;
  min-height: 0;
}
.workbench-shell__content.is-scrollable {
  overflow-y: auto;
  overflow-x: hidden;
}
@media (max-width: 768px) {
  .workbench-shell.has-gutter {
    padding-inline: var(--page-gutter-mobile);
  }
  .workbench-shell__header {
    padding-block: var(--space-3);
  }
}
@media (max-width: 390px) {
  .workbench-shell__toolbar {
    width: 100%;
  }
}
</style>

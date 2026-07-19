<script setup lang="ts">
import type { PreviewImage } from '@/components/tutorialPreview';

interface Props {
  image: PreviewImage;
  index: number;
  total: number;
}

defineProps<Props>();
</script>

<template>
  <footer class="tutorial-image-caption bg-slate-900 text-slate-100">
    <div class="tutorial-image-caption-meta text-slate-400">
      <span>{{ image.sectionTitle || '教程步骤' }}</span>
      <span>第 {{ index + 1 }} / {{ total }} 个图解步骤</span>
    </div>

    <div class="tutorial-image-caption-title">
      <h3>{{ image.title }}</h3>
      <time v-if="image.timeRange" class="text-slate-400">{{ image.timeRange }}</time>
    </div>

    <p v-if="image.description" class="tutorial-image-description text-slate-300">
      {{ image.description }}
    </p>

    <div v-if="image.shortcuts.length" class="tutorial-step-detail">
      <span class="tutorial-step-detail-label text-slate-400">快捷键</span>
      <div class="tutorial-shortcuts">
        <kbd
          v-for="shortcut in image.shortcuts"
          :key="shortcut"
          class="border border-white/15 bg-white/10 text-slate-100"
        >
          {{ shortcut }}
        </kbd>
      </div>
    </div>

    <div v-if="image.parameters.length" class="tutorial-step-detail">
      <span class="tutorial-step-detail-label text-slate-400">参数设置</span>
      <dl class="tutorial-parameters">
        <div v-for="parameter in image.parameters" :key="parameter.name">
          <dt class="text-slate-400">{{ parameter.name }}</dt>
          <dd>{{ parameter.value }}</dd>
        </div>
      </dl>
    </div>

    <div v-if="image.warnings.length" class="tutorial-warnings">
      <div
        v-for="warning in image.warnings"
        :key="warning"
        class="border border-amber-400/35 bg-amber-400/10 text-amber-100"
        role="note"
      >
        {{ warning }}
      </div>
    </div>

    <p
      v-if="
        !image.description &&
        !image.shortcuts.length &&
        !image.parameters.length &&
        !image.warnings.length
      "
      class="text-xs text-slate-300"
    >
      可使用左右方向键或滑动切换图片
    </p>
  </footer>
</template>

<style scoped>
.tutorial-image-caption {
  box-sizing: border-box;
  flex: 0 0 clamp(180px, 22dvh, 220px);
  height: clamp(180px, 22dvh, 220px);
  padding: 1rem 1.25rem 1.15rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.tutorial-image-caption-meta,
.tutorial-image-caption-title {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.tutorial-image-caption-meta {
  margin-bottom: 0.45rem;
  font-size: 0.75rem;
}

.tutorial-image-caption-title {
  align-items: flex-start;
}

.tutorial-image-caption h3 {
  margin: 0;
  color: inherit;
  font-size: 1rem;
  line-height: 1.5;
}

.tutorial-image-caption time {
  flex: 0 0 auto;
  font-size: 0.75rem;
  line-height: 1.5rem;
}

.tutorial-image-description {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  line-height: 1.55;
}

.tutorial-step-detail {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: 0.6rem;
  margin-top: 0.7rem;
  font-size: 0.8rem;
}

.tutorial-step-detail-label {
  font-weight: 600;
}

.tutorial-shortcuts,
.tutorial-parameters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
}

.tutorial-shortcuts kbd {
  padding: 0.12rem 0.45rem;
  border-radius: var(--radius-md);
  font-family: inherit;
}

.tutorial-parameters > div {
  display: flex;
  gap: 0.3rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-md);
  background: var(--bg-card);
}

.tutorial-parameters dt,
.tutorial-parameters dd {
  margin: 0;
}

.tutorial-warnings {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.8rem;
}

.tutorial-warnings > div {
  padding: 0.5rem 0.7rem;
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  line-height: 1.45;
}

@media (max-width: 640px) {
  .tutorial-image-caption {
    flex-basis: clamp(200px, 34dvh, 280px);
    height: clamp(200px, 34dvh, 280px);
    padding: 0.85rem 1rem 1rem;
  }

  .tutorial-image-caption-meta,
  .tutorial-image-caption-title {
    flex-direction: column;
    gap: 0.15rem;
  }

  .tutorial-step-detail {
    grid-template-columns: 1fr;
    gap: 0.3rem;
  }
}
</style>

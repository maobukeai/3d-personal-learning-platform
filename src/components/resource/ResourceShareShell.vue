<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { Share2, Download, Copy, Check, Lock, Link } from 'lucide-vue-next';
import PageFrame from '@/components/skeleton/PageFrame.vue';
import ErrorState from '@/components/skeleton/ErrorState.vue';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import Skeleton from '@/components/ui/Skeleton.vue';

interface Props {
  resourceType: string;
  title: string;
  loading?: boolean;
  error?: string;
  isOwner?: boolean;
  permission?: 'view' | 'comment' | 'edit';
  shareable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: '',
  isOwner: false,
  permission: 'view',
  shareable: true,
});

const emit = defineEmits<{
  (e: 'retry'): void;
  (e: 'copy-link'): void;
  (e: 'share'): void;
  (e: 'download'): void;
  (e: 'request-access'): void;
}>();

const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const clearCopyTimer = () => {
  if (copyTimer !== null) {
    clearTimeout(copyTimer);
    copyTimer = null;
  }
};

const handleCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copied.value = true;
    clearCopyTimer();
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Clipboard API unavailable (non-secure context or unsupported); skip visual feedback.
  }
  emit('copy-link');
};

onBeforeUnmount(clearCopyTimer);

const permissionLabel: Record<'view' | 'comment' | 'edit', string> = {
  view: 'View only',
  comment: 'Can comment',
  edit: 'Can edit',
};
</script>
<template>
  <PageFrame class="resource-share-shell">
    <!-- Error state (full frame) -->
    <ErrorState
      v-if="props.error"
      :message="props.error"
      class="share-shell__fullstate"
      @retry="emit('retry')"
    />
    <!-- Loading skeleton (full frame) -->
    <div v-else-if="props.loading" class="share-shell__fullstate">
      <div class="share-shell__skeleton-grid">
        <div class="share-shell__skeleton-main">
          <div class="share-shell__skeleton-media"><Skeleton width="100%" height="100%" /></div>
          <Skeleton width="55%" height="1.5rem" /> <Skeleton width="100%" height="0.75rem" />
          <Skeleton width="85%" height="0.75rem" />
        </div>
        <div class="share-shell__skeleton-side">
          <Skeleton width="100%" height="2.5rem" /> <Skeleton width="100%" height="2.5rem" />
          <Skeleton width="100%" height="6rem" />
        </div>
      </div>
    </div>
    <!-- Access denied (not shareable and not owner) -->
    <div
      v-else-if="!props.shareable && !props.isOwner"
      class="share-shell__fullstate share-shell__denied"
    >
      <div class="share-shell__denied-icon"><Lock class="w-7 h-7" /></div>
      <h2 class="share-shell__denied-title">Access restricted</h2>
      <p class="share-shell__denied-text">
        This {{ props.resourceType }} is no longer publicly shared. Request access from the owner to
        continue.
      </p>
      <Button variant="primary" size="md" :icon="Lock" @click="emit('request-access')">
        Request access
      </Button>
    </div>
    <!-- Loaded content -->
    <div v-else class="share-shell__content">
      <div class="share-shell__main">
        <!-- Media preview -->
        <div v-if="$slots.media" class="share-shell__media"><slot name="media" /></div>
        <!-- Title + resource info -->
        <div class="share-shell__info">
          <h1 v-if="props.title" class="share-shell__title">{{ props.title }}</h1>
          <slot name="info" />
        </div>
        <!-- Comments -->
        <div v-if="$slots.comments" class="share-shell__comments"><slot name="comments" /></div>
      </div>
      <aside class="share-shell__sidebar">
        <!-- Action card: standard share / download / copy-link + custom actions -->
        <Card padding="md" class="share-shell__action-card">
          <div class="share-shell__action-stack">
            <Button variant="primary" size="md" :icon="Share2" full-width @click="emit('share')">
              Share
            </Button>
            <Button
              variant="secondary"
              size="md"
              :icon="Download"
              full-width
              @click="emit('download')"
            >
              Download
            </Button>
            <Button
              variant="secondary"
              size="md"
              :icon="copied ? Check : Copy"
              full-width
              @click="handleCopyLink"
            >
              {{ copied ? 'Copied!' : 'Copy link' }}
            </Button>
            <p class="share-shell__link-hint"><Link class="w-3 h-3" /> Public shareable link</p>
            <div v-if="$slots.actions" class="share-shell__actions"><slot name="actions" /></div>
          </div>
        </Card>
        <!-- Metadata card -->
        <Card v-if="$slots.meta" padding="md"> <slot name="meta" /> </Card>
        <!-- Owner / access info -->
        <Card padding="md" class="share-shell__access-card">
          <div class="share-shell__access-row">
            <span class="share-shell__access-label">Your access</span>
            <span class="share-shell__access-badge" :class="{ 'is-owner': props.isOwner }">
              {{ props.isOwner ? 'Owner' : permissionLabel[props.permission] }}
            </span>
          </div>
        </Card>
      </aside>
    </div>
  </PageFrame>
</template>
<style scoped>
.resource-share-shell {
  padding-block: 1.5rem;
} /* Full-frame states (error / loading / access denied) fill the page area. */
.share-shell__fullstate {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-block: 4rem 6rem;
} /* Loading skeleton */
.share-shell__skeleton-grid {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}
@media (min-width: 1024px) {
  .share-shell__skeleton-grid {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
}
.share-shell__skeleton-main {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.share-shell__skeleton-media {
  aspect-ratio: 16 / 9;
  width: 100%;
}
.share-shell__skeleton-side {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
} /* Access denied */
.share-shell__denied {
  flex-direction: column;
  text-align: center;
}
.share-shell__denied-icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
  background-color: color-mix(in srgb, var(--warning) 10%, transparent);
  color: var(--warning);
}
.share-shell__denied-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}
.share-shell__denied-text {
  font-size: var(--text-sm);
  color: var(--text-muted);
  max-width: 28rem;
  margin: 0 0 1.5rem;
  line-height: var(--leading-normal);
} /* Content two-column layout (sidebar moves below on < 1024px) */
.share-shell__content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}
@media (min-width: 1024px) {
  .share-shell__content {
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 2rem;
    align-items: start;
  }
}
.share-shell__main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
} /* Media preview: 16/9 container, overflow hidden, centered content */
.share-shell__media {
  aspect-ratio: 16 / 9;
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-base);
  background-color: var(--bg-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
}
.share-shell__media > :deep(*) {
  max-width: 100%;
  max-height: 100%;
}
.share-shell__info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.share-shell__title {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  line-height: var(--leading-tight);
}
.share-shell__comments {
  margin-top: 0.5rem;
} /* Sidebar */
.share-shell__sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}
.share-shell__action-stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.share-shell__link-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  margin-top: 0.25rem;
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.share-shell__actions {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-base);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.share-shell__access-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.share-shell__access-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.share-shell__access-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
  border: 1px solid var(--border-base);
}
.share-shell__access-badge.is-owner {
  background-color: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 25%, transparent);
}
</style>

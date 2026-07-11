<script setup lang="ts">
import { Check, Image as ImageIcon, MoreHorizontal } from 'lucide-vue-next';
import Skeleton from '@/components/ui/Skeleton.vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import DropdownMenu from '@/components/ui/DropdownMenu.vue';
import DropdownItem from '@/components/ui/DropdownItem.vue';
import type { ResourceAction, ResourceCardConfig, ResourceItem } from './types';
const props = defineProps<{
  items: ResourceItem[];
  card: ResourceCardConfig;
  loading?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string | number>;
  cardClass?: string;
  actions?: ResourceAction[];
  /** Display density. 'grid' = card grid, 'list' = row list. */ viewMode?: 'grid' | 'list';
}>();
const emit = defineEmits<{
  (e: 'item-click', item: ResourceItem): void;
  (e: 'toggle-select', id: string | number): void;
  (e: 'item-action', item: ResourceItem, actionId: string): void;
}>();
const skeletonCount = 8;
const view = () => props.viewMode ?? 'grid';
const isSelected = (item: ResourceItem): boolean =>
  props.selectable ? (props.selectedIds?.has(item.id) ?? false) : false;
const getTitle = (item: ResourceItem): string => {
  if (!props.card.titleKey) return '---';
  const v = item[props.card.titleKey];
  return v == null || v === '' ? '---' : String(v);
};
const getSubtitle = (item: ResourceItem): string => {
  if (!props.card.subtitleKey) return '';
  const v = item[props.card.subtitleKey];
  return v == null || v === '' ? '' : String(v);
};
const getImageUrl = (item: ResourceItem): string => {
  if (!props.card.imageKey) return '';
  const v = item[props.card.imageKey];
  return typeof v === 'string' ? v : '';
};
const getStatus = (item: ResourceItem): string | undefined => {
  if (!props.card.statusKey) return undefined;
  const v = item[props.card.statusKey];
  return v == null || v === '' ? undefined : String(v);
};
const getMetric = (item: ResourceItem): string | undefined => {
  if (!props.card.metricKey) return undefined;
  const v = item[props.card.metricKey];
  return v == null ? undefined : String(v);
};
const getTags = (item: ResourceItem): string[] => {
  if (!props.card.tagsKey) return [];
  const v = item[props.card.tagsKey];
  if (Array.isArray(v)) return v.map((t) => String(t)).filter(Boolean);
  if (typeof v === 'string')
    return v
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  return [];
};
const formatValue = (v: unknown): string => {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};
const statusTone = (status: string): string => {
  const s = status.toUpperCase();
  if (['APPROVED', 'PUBLISHED', 'DONE', 'ACTIVE', 'COMPLETED'].includes(s)) return 'success';
  if (['PENDING', 'DRAFT', 'REVIEW', 'PROCESSING'].includes(s)) return 'warning';
  if (['REJECTED', 'ARCHIVED', 'FAILED', 'DELETED'].includes(s)) return 'danger';
  return 'neutral';
};
const hasActions = (): boolean =>
  Boolean(
    props.actions?.length,
  ); /** Keyboard activation for the card (treated as a button per a11y spec). */
const onCardKeydown = (item: ResourceItem, event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    emit('item-click', item);
  }
};
const cardAriaLabel = (item: ResourceItem): string => {
  const title = getTitle(item);
  const sub = getSubtitle(item);
  return sub ? `${title} — ${sub}` : title;
};
</script>
<template>
  <div class="resource-grid-root">
    <!-- ── Loading: grid skeletons ── -->
    <div v-if="loading && view() === 'grid'" class="resource-grid">
      <div v-for="n in skeletonCount" :key="n" class="skeleton-card">
        <Skeleton width="100%" height="140px" />
        <div class="skeleton-body">
          <Skeleton width="60%" height="0.9375rem" /> <Skeleton width="85%" height="0.75rem" />
          <Skeleton width="40%" height="0.75rem" />
        </div>
      </div>
    </div>
    <!-- ── Loading: list skeletons ── -->
    <ul v-else-if="loading && view() === 'list'" class="resource-list" aria-hidden="true">
      <li v-for="n in skeletonCount" :key="n" class="list-row list-row--skeleton">
        <Skeleton width="64px" height="64px" />
        <div class="list-row__body">
          <Skeleton width="40%" height="0.9375rem" /> <Skeleton width="70%" height="0.75rem" />
        </div>
      </li>
    </ul>
    <!-- ── Empty state ── -->
    <div v-else-if="!items.length" class="resource-empty">
      <slot name="empty">
        <div class="empty-default">
          <ImageIcon class="empty-icon" />
          <p class="empty-text typo-body">No items found</p>
        </div>
      </slot>
    </div>
    <!-- ── Grid view ── -->
    <div v-else-if="view() === 'grid'" class="resource-grid">
      <template v-for="item in items" :key="item.id">
        <slot v-if="$slots.card" name="card" :item="item" :selected="isSelected(item)" />
        <article
          v-else
          class="resource-card"
          :class="[cardClass, { 'is-selected': isSelected(item) }]"
          role="button"
          tabindex="0"
          :aria-label="cardAriaLabel(item)"
          @click="emit('item-click', item)"
          @keydown="onCardKeydown(item, $event)"
        >
          <!-- Selection checkbox (top-left) -->
          <button
            v-if="selectable"
            type="button"
            class="card-checkbox"
            :class="{ checked: isSelected(item) }"
            :aria-label="isSelected(item) ? 'Deselect item' : 'Select item'"
            @click.stop="emit('toggle-select', item.id)"
          >
            <Check v-if="isSelected(item)" class="w-3 h-3" />
          </button>
          <!-- Thumbnail (fixed aspect ratio, object-fit cover) -->
          <div v-if="card.imageKey" class="card-image">
            <img
              v-if="getImageUrl(item)"
              :src="getImageUrl(item)"
              :alt="getTitle(item)"
              loading="lazy"
            />
            <div v-else class="image-placeholder"><ImageIcon /></div>
          </div>
          <!-- Body -->
          <div class="card-body">
            <div class="card-header">
              <h3 class="card-title typo-h4">{{ getTitle(item) }}</h3>
              <span
                v-if="card.statusKey && getStatus(item) !== undefined"
                class="card-status"
                :data-tone="statusTone(getStatus(item) as string)"
                >{{ getStatus(item) }}</span
              >
            </div>
            <p v-if="card.subtitleKey && getSubtitle(item)" class="card-subtitle typo-caption">
              {{ getSubtitle(item) }}
            </p>
            <div v-if="card.metricKey && getMetric(item) !== undefined" class="card-metric">
              <span class="metric-value">{{ getMetric(item) }}</span>
              <span v-if="card.metricLabel" class="metric-label typo-caption">{{
                card.metricLabel
              }}</span>
            </div>
            <dl v-if="card.fields?.length" class="card-fields">
              <div
                v-for="field in card.fields"
                :key="field.key"
                class="field-row"
                :class="field.class"
              >
                <dt class="field-label typo-caption">{{ field.label }}</dt>
                <dd class="field-value typo-caption">{{ formatValue(item[field.key]) }}</dd>
              </div>
            </dl>
            <div v-if="getTags(item).length" class="card-tags">
              <span v-for="tag in getTags(item).slice(0, 4)" :key="tag" class="card-tag"
                >#{{ tag }}</span
              >
            </div>
          </div>
          <!-- Actions dropdown (top-right) -->
          <div v-if="hasActions() || $slots.actions" class="card-actions" @click.stop>
            <Dropdown
              trigger="click"
              placement="bottom-end"
              @command="(id) => emit('item-action', item, String(id))"
            >
              <button type="button" class="more-btn" aria-label="More actions">
                <MoreHorizontal class="w-4 h-4" />
              </button>
              <template #dropdown>
                <DropdownMenu>
                  <slot name="actions" :item="item">
                    <DropdownItem v-for="action in actions" :key="action.id" :command="action.id">{{
                      action.label
                    }}</DropdownItem>
                  </slot>
                </DropdownMenu>
              </template>
            </Dropdown>
          </div>
        </article>
      </template>
    </div>
    <!-- ── List view ── -->
    <ul v-else class="resource-list" role="list">
      <li
        v-for="item in items"
        :key="item.id"
        class="list-row"
        :class="{ 'is-selected': isSelected(item) }"
        role="button"
        tabindex="0"
        :aria-label="cardAriaLabel(item)"
        @click="emit('item-click', item)"
        @keydown="onCardKeydown(item, $event)"
      >
        <!-- Selection checkbox -->
        <button
          v-if="selectable"
          type="button"
          class="card-checkbox list-checkbox"
          :class="{ checked: isSelected(item) }"
          :aria-label="isSelected(item) ? 'Deselect item' : 'Select item'"
          @click.stop="emit('toggle-select', item.id)"
        >
          <Check v-if="isSelected(item)" class="w-3 h-3" />
        </button>
        <!-- Thumbnail -->
        <div v-if="card.imageKey" class="list-row__thumb">
          <img
            v-if="getImageUrl(item)"
            :src="getImageUrl(item)"
            :alt="getTitle(item)"
            loading="lazy"
          />
          <div v-else class="image-placeholder"><ImageIcon /></div>
        </div>
        <!-- Title + meta -->
        <div class="list-row__body">
          <div class="list-row__head">
            <h3 class="card-title typo-h4">{{ getTitle(item) }}</h3>
            <span
              v-if="card.statusKey && getStatus(item) !== undefined"
              class="card-status"
              :data-tone="statusTone(getStatus(item) as string)"
              >{{ getStatus(item) }}</span
            >
          </div>
          <p v-if="card.subtitleKey && getSubtitle(item)" class="card-subtitle typo-caption">
            {{ getSubtitle(item) }}
          </p>
          <div class="list-row__meta">
            <span v-if="card.metricKey && getMetric(item) !== undefined" class="list-meta-item">
              <span class="metric-value">{{ getMetric(item) }}</span>
              <span v-if="card.metricLabel" class="metric-label typo-caption">{{
                card.metricLabel
              }}</span>
            </span>
            <template v-if="card.fields?.length">
              <span
                v-for="field in card.fields"
                :key="field.key"
                class="list-meta-item typo-caption"
              >
                <span class="field-label">{{ field.label }}:</span>
                <span class="field-value">{{ formatValue(item[field.key]) }}</span>
              </span>
            </template>
            <span v-for="tag in getTags(item).slice(0, 3)" :key="tag" class="card-tag"
              >#{{ tag }}</span
            >
          </div>
        </div>
        <!-- Actions -->
        <div v-if="hasActions() || $slots.actions" class="list-row__actions" @click.stop>
          <Dropdown
            trigger="click"
            placement="bottom-end"
            @command="(id) => emit('item-action', item, String(id))"
          >
            <button type="button" class="more-btn" aria-label="More actions">
              <MoreHorizontal class="w-4 h-4" />
            </button>
            <template #dropdown>
              <DropdownMenu>
                <slot name="actions" :item="item">
                  <DropdownItem v-for="action in actions" :key="action.id" :command="action.id">{{
                    action.label
                  }}</DropdownItem>
                </slot>
              </DropdownMenu>
            </template>
          </Dropdown>
        </div>
      </li>
    </ul>
  </div>
</template>
<style scoped>
/* ============================================================ Grid view ============================================================ */
.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}
.resource-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  border: 1px dashed var(--border-base);
  border-radius: var(--radius-lg);
  background: var(--surface-solid);
}
.empty-default {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}
.empty-icon {
  width: 32px;
  height: 32px;
  color: var(--text-muted);
  opacity: 0.6;
}
.empty-text {
  color: var(--text-muted);
} /* Skeleton card (grid) — solid surface, no glass */
.skeleton-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface-solid);
}
.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
} /* ── Resource card — single-channel hover (border-color only) ── Solid surface, opaque, no backdrop-filter, no transform. */
.resource-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--card-border-rest);
  border-radius: var(--radius-field);
  background: var(--surface-solid);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-standard);
} /* SINGLE channel: border-color shift toward accent. No transform/shadow/bg. */
.resource-card:hover {
  border-color: var(--card-border-hover);
}
.resource-card:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.resource-card.is-selected {
  border-color: var(--accent);
  background: var(--accent-subtle);
} /* Selection checkbox — solid, token colors, no glass */
.card-checkbox {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  z-index: 10;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  border: 1.5px solid var(--border-strong);
  background: var(--surface-solid);
  color: var(--accent-on);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}
.resource-card:hover .card-checkbox,
.resource-card:focus-visible .card-checkbox,
.card-checkbox.checked {
  opacity: 1;
}
.card-checkbox.checked {
  background: var(--accent);
  border-color: var(--accent);
}
.card-checkbox:focus-visible {
  opacity: 1;
  outline: 2px solid var(--ring);
  outline-offset: 2px;
} /* Thumbnail — fixed aspect ratio, object-fit cover */
.card-image {
  width: 100%;
  aspect-ratio: 1.6 / 1;
  overflow: hidden;
  background: var(--surface-raised);
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-placeholder {
  color: var(--text-muted);
  opacity: 0.4;
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-placeholder svg {
  width: 28px;
  height: 28px;
} /* Body */
.card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4) var(--space-4);
  min-width: 0;
}
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}
.card-title {
  color: var(--text-on-solid-primary);
  line-height: var(--typo-h4-line-height, 1.45);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
  margin: 0;
} /* Status badge — minimum 12px caption size */
.card-status {
  flex-shrink: 0;
  font-size: var(--typo-caption-font-size);
  font-weight: var(--font-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px var(--space-1);
  border-radius: var(--radius-control);
  border: 1px solid transparent;
  line-height: 1.4;
}
.card-status[data-tone='success'] {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
  border-color: color-mix(in srgb, var(--success) 30%, transparent);
}
.card-status[data-tone='warning'] {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  border-color: color-mix(in srgb, var(--warning) 30%, transparent);
}
.card-status[data-tone='danger'] {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--danger) 30%, transparent);
}
.card-status[data-tone='neutral'] {
  color: var(--text-muted);
  background: var(--bg-hover);
  border-color: var(--border-base);
}
.card-subtitle {
  color: var(--text-on-solid-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
}
.card-metric {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}
.metric-value {
  font-size: var(--typo-body-font-size);
  font-weight: var(--font-semibold);
  color: var(--text-on-solid-primary);
}
.metric-label {
  color: var(--text-on-solid-muted);
}
.card-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
}
.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.field-label {
  color: var(--text-on-solid-muted);
  font-weight: var(--font-medium);
}
.field-value {
  color: var(--text-on-solid-secondary);
  margin: 0;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-1);
} /* Tags — minimum 12px caption size */
.card-tag {
  font-size: var(--typo-caption-font-size);
  color: var(--text-on-solid-secondary);
  background: var(--bg-hover);
  padding: 2px var(--space-1);
  border-radius: var(--radius-control);
  line-height: 1.4;
} /* Actions dropdown — solid button, no glass */
.card-actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 10;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-standard);
}
.resource-card:hover .card-actions,
.resource-card:focus-visible .card-actions {
  opacity: 1;
}
.more-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-control);
  border: 1px solid var(--border-strong);
  background: var(--surface-solid);
  color: var(--text-on-solid-secondary);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}
.more-btn:hover {
  color: var(--accent);
  border-color: var(--card-border-hover);
}
.more-btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
} /* ============================================================ List view — rows with 1px border between them ============================================================ */
.resource-list {
  display: flex;
  flex-direction: column;
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-field);
  background: var(--surface-solid);
  overflow: hidden;
}
.list-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-base);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
} /* Last row: no bottom border (clean edge against container) */
.list-row:last-child {
  border-bottom: none;
} /* Single-channel hover: background shift only (border already separates rows) */
.list-row:hover {
  background: var(--surface-raised);
}
.list-row:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: -2px;
}
.list-row.is-selected {
  background: var(--accent-subtle);
}
.list-row--skeleton {
  cursor: default;
}
.list-row--skeleton:hover {
  background: transparent;
}
.list-checkbox {
  position: static;
  opacity: 1;
  flex-shrink: 0;
}
.list-row__thumb {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-control);
  overflow: hidden;
  background: var(--surface-raised);
  display: flex;
  align-items: center;
  justify-content: center;
}
.list-row__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.list-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.list-row__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.list-row__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
}
.list-meta-item {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-1);
}
.list-row__actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-standard);
}
.list-row:hover .list-row__actions,
.list-row:focus-visible .list-row__actions {
  opacity: 1;
} /* ============================================================ Mobile — single column grid ============================================================ */
@media (max-width: 639px) {
  .resource-grid {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  .list-row {
    gap: var(--space-3);
    padding: var(--space-3);
  }
  .list-row__thumb {
    width: 56px;
    height: 56px;
  } /* On mobile, always show actions so touch users can reach them */
  .card-actions,
  .list-row__actions {
    opacity: 1;
  }
}
</style>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'radix-vue';
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-vue-next';

interface Props {
  modelValue?: string | null;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  size?: 'sm' | 'md';
  /** Receives a Date, return true to disable that date */
  disabledDate?: (date: Date) => boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  placeholder: '选择日期',
  disabled: false,
  clearable: true,
  size: 'md',
  disabledDate: undefined,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void;
  (e: 'change', value: string | null): void;
}>();

// ── Popover open state ──
const open = ref(false);

// ── Internal calendar state ──
const today = new Date();
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth()); // 0-indexed

// ── Parse modelValue into a selected Date (or null) ──
const selectedDate = computed<Date | null>(() => {
  if (!props.modelValue) return null;
  const d = new Date(props.modelValue + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
});

// ── When modelValue changes from outside, sync the view ──
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      const d = new Date(val + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        viewYear.value = d.getFullYear();
        viewMonth.value = d.getMonth();
      }
    }
  },
  { immediate: true },
);

// ── Display label shown in the trigger button ──
const displayLabel = computed(() => {
  if (!selectedDate.value) return '';
  const d = selectedDate.value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

// ── Month navigation ──
const prevMonth = () => {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value--;
  } else {
    viewMonth.value--;
  }
};
const nextMonth = () => {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value++;
  } else {
    viewMonth.value++;
  }
};
const goToday = () => {
  const t = new Date();
  viewYear.value = t.getFullYear();
  viewMonth.value = t.getMonth();
};

// ── Calendar grid computation ──
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const calendarCells = computed(() => {
  const year = viewYear.value;
  const month = viewMonth.value;
  const firstDay = new Date(year, month, 1);
  // Monday-first: getDay() returns 0=Sun, so we shift
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: Array<{
    date: Date;
    day: number;
    currentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isDisabled: boolean;
  }> = [];

  // Previous month fill
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrev - i);
    cells.push({
      date: d,
      day: d.getDate(),
      currentMonth: false,
      isToday: false,
      isSelected: false,
      isDisabled: true,
    });
  }
  // Current month
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selStr = displayLabel.value;
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    const str = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const isDisabled = props.disabledDate ? props.disabledDate(d) : false;
    cells.push({
      date: d,
      day: i,
      currentMonth: true,
      isToday: str === todayStr,
      isSelected: str === selStr,
      isDisabled,
    });
  }
  // Next month fill to complete 6 rows (42 cells)
  let next = 1;
  while (cells.length < 42) {
    const d = new Date(year, month + 1, next++);
    cells.push({
      date: d,
      day: d.getDate(),
      currentMonth: false,
      isToday: false,
      isSelected: false,
      isDisabled: true,
    });
  }
  return cells;
});

const MONTH_NAMES = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
];

// ── Select a date ──
const selectDate = (cell: (typeof calendarCells.value)[0]) => {
  if (cell.isDisabled) return;
  if (!cell.currentMonth) {
    viewYear.value = cell.date.getFullYear();
    viewMonth.value = cell.date.getMonth();
  }
  const y = cell.date.getFullYear();
  const m = String(cell.date.getMonth() + 1).padStart(2, '0');
  const d = String(cell.date.getDate()).padStart(2, '0');
  const val = `${y}-${m}-${d}`;
  emit('update:modelValue', val);
  emit('change', val);
  open.value = false;
};

// ── Clear ──
const clearValue = (e: MouseEvent) => {
  e.stopPropagation();
  emit('update:modelValue', null);
  emit('change', null);
};

// ── Select today and close ──
const selectToday = () => {
  const t = new Date();
  const val = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  emit('update:modelValue', val);
  emit('change', val);
  open.value = false;
};
</script>

<template>
  <PopoverRoot v-model:open="open" class="cdp-root">
    <PopoverTrigger as-child :disabled="disabled">
      <button
        type="button"
        class="cdp-trigger"
        :class="[
          size === 'sm' ? 'cdp-trigger--sm' : 'cdp-trigger--md',
          { 'cdp-trigger--active': !!modelValue, 'cdp-trigger--disabled': disabled },
        ]"
      >
        <CalendarIcon class="cdp-trigger-icon" />
        <span class="cdp-trigger-label" :class="{ 'cdp-trigger-placeholder': !modelValue }">
          {{ displayLabel || placeholder }}
        </span>
        <button
          v-if="clearable && modelValue"
          type="button"
          class="cdp-clear-btn"
          @click="clearValue"
        >
          <X class="w-3 h-3" />
        </button>
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        :side-offset="6"
        align="start"
        class="glass-popover z-[var(--z-popover)] outline-none"
        style="width: 260px; padding: 10px 12px; user-select: none"
      >
        <!-- Header: year/month + nav -->
        <div class="cdp-header">
          <button type="button" class="cdp-nav-btn" @click="prevMonth">
            <ChevronLeft class="w-3.5 h-3.5" />
          </button>
          <span class="cdp-header-label">{{ viewYear }} 年 {{ MONTH_NAMES[viewMonth] }}</span>
          <button type="button" class="cdp-nav-btn" @click="nextMonth">
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Weekday row -->
        <div class="cdp-weekdays">
          <span v-for="wd in WEEKDAYS" :key="wd" class="cdp-weekday">{{ wd }}</span>
        </div>

        <!-- Day cells grid -->
        <div class="cdp-grid">
          <button
            v-for="(cell, i) in calendarCells"
            :key="i"
            type="button"
            class="cdp-cell"
            :class="{
              'cdp-cell--other': !cell.currentMonth,
              'cdp-cell--today': cell.isToday && !cell.isSelected,
              'cdp-cell--selected': cell.isSelected,
              'cdp-cell--disabled': cell.isDisabled,
            }"
            :disabled="cell.isDisabled"
            @click="selectDate(cell)"
          >
            {{ cell.day }}
          </button>
        </div>

        <!-- Footer -->
        <div class="cdp-footer">
          <button type="button" class="cdp-footer-btn" @click="clearValue($event as MouseEvent)">
            清除
          </button>
          <button type="button" class="cdp-footer-btn cdp-footer-btn--today" @click="selectToday">
            今天
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
/* Root wrapper — acts like a block element, respects external width */
.cdp-root {
  display: block;
  min-width: 0;
}

/* ── Trigger button ── */
.cdp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-control);
  background-color: var(--surface-solid);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  outline: none;
  box-sizing: border-box;
}
.cdp-trigger:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
}
.cdp-trigger--md {
  padding: 8px 12px;
  font-size: 14px;
}
.cdp-trigger--sm {
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 700;
}
.cdp-trigger--active {
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
}
.cdp-trigger--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cdp-trigger-icon {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.cdp-trigger-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cdp-trigger-placeholder {
  color: var(--text-muted, var(--text-secondary));
  opacity: 0.6;
}

.cdp-clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.1s,
    color 0.1s;
}
.cdp-clear-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ── Panel (dead scoped rule – kept for reference, actual width via inline style) ── */
.cdp-panel {
  width: 380px;
  padding: 16px 18px;
  user-select: none;
}
</style>

<!-- Global styles: portal content is teleported out of this component's DOM scope,
     so scoped CSS cannot reach it. These classes must be global. -->
<style>
/* ── Header ── */
.cdp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.cdp-header-label {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-primary);
}
.cdp-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.cdp-nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ── Weekdays ── */
.cdp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}
.cdp-weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  color: var(--text-secondary);
  padding: 1px 0 5px;
  letter-spacing: 0.02em;
}
.cdp-weekday:nth-child(6),
.cdp-weekday:nth-child(7) {
  color: color-mix(in srgb, var(--accent) 70%, var(--text-secondary));
}

/* ── Grid ── */
.cdp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}
.cdp-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
  position: relative;
}
.cdp-cell:hover {
  background: var(--bg-hover);
}
.cdp-cell--disabled {
  opacity: 0.25;
  cursor: not-allowed;
  pointer-events: none;
}
.cdp-cell--other {
  color: var(--text-secondary);
  opacity: 0.4;
}
.cdp-cell--today::after {
  content: '';
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
}
.cdp-cell--today {
  color: var(--accent);
  font-weight: 800;
}
.cdp-cell--selected {
  background: var(--accent) !important;
  color: #fff !important;
  font-weight: 800;
}

/* ── Footer ── */
.cdp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px solid var(--glass-border-color);
}
.cdp-footer-btn {
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 3px 8px;
  border-radius: var(--radius-control);
  transition:
    color 0.12s,
    background 0.12s;
}
.cdp-footer-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.cdp-footer-btn--today {
  color: var(--accent);
}
.cdp-footer-btn--today:hover {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
</style>

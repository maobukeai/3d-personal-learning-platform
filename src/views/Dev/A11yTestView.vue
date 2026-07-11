<script setup lang="ts">
/**
 * Dev-only a11y test page — mounts Modal / Drawer / Dropdown / Select /
 * Tooltip in isolation so Playwright keyboard tests (e2e/a11y-*.spec.ts)
 * can drive them without auth or app chrome.
 *
 * This route is registered only in dev mode (see router/index.ts), so it
 * never ships in production builds.
 */
import { ref } from 'vue';
import Modal from '@/components/ui/Modal.vue';
import Drawer from '@/components/ui/Drawer.vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import DropdownItem from '@/components/ui/DropdownItem.vue';
import Select from '@/components/ui/Select.vue';
import Tooltip from '@/components/ui/Tooltip.vue';

// ── Modal ────────────────────────────────────────────────────────────
const modalStandardOpen = ref(false);
const modalFullscreenOpen = ref(false);
const modalTitleFocusOpen = ref(false);
const modalNestedOpen = ref(false);
const modalSelectValue = ref<string | undefined>(undefined);

// ── Drawer ───────────────────────────────────────────────────────────
const drawerOpen = ref(false);

// ── Dropdown ─────────────────────────────────────────────────────────
const dropdownCommand = ref<string | null>(null);

// ── Select ───────────────────────────────────────────────────────────
const selectValue = ref<string | undefined>(undefined);
const selectOptions = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
];

// ── Tooltip ──────────────────────────────────────────────────────────
// no state needed — radix tooltip opens on focus/hover by default

const currentTheme = ref('glass-dark');
const toggleTheme = () => {
  const root = document.documentElement;
  if (currentTheme.value === 'glass-dark') {
    currentTheme.value = 'glass-light';
    root.className = 'theme-glass';
  } else {
    currentTheme.value = 'glass-dark';
    root.className = 'theme-glass dark';
  }
};
</script>

<template>
  <main class="a11y-test-page p-8 space-y-12" data-testid="a11y-test-page">
    <div class="flex justify-between items-center">
      <h1>Accessibility Test Page</h1>
      <button
        type="button"
        data-testid="theme-toggle-btn"
        class="px-4 py-2 border rounded"
        @click="toggleTheme"
      >
        Theme: {{ currentTheme }}
      </button>
    </div>

    <!-- ╔══════════════════ Modal ══════════════════╗ -->
    <section data-testid="modal-section">
      <h2>Modal</h2>

      <button type="button" data-testid="open-modal-standard" @click="modalStandardOpen = true">
        Open standard modal
      </button>

      <button type="button" data-testid="open-modal-fullscreen" @click="modalFullscreenOpen = true">
        Open fullscreen modal
      </button>

      <button
        type="button"
        data-testid="open-modal-title-focus"
        @click="modalTitleFocusOpen = true"
      >
        Open title-focus modal
      </button>

      <!-- Standard modal with focusable body + footer -->
      <Modal
        :show="modalStandardOpen"
        title="Standard Modal"
        description="A standard test modal"
        size="md"
        @close="modalStandardOpen = false"
      >
        <div class="space-y-3">
          <p>Modal body content.</p>
          <input type="text" data-testid="modal-input" placeholder="First focusable in body" />
          <a href="#" data-testid="modal-link">A link in the modal</a>

          <div class="pt-4 border-t border-gray-700/20 space-y-4">
            <h3 class="text-sm font-semibold">Nested Overlays</h3>
            <button
              type="button"
              data-testid="open-nested-modal-btn"
              class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
              @click="modalNestedOpen = true"
            >
              Open Nested Modal
            </button>

            <div data-testid="modal-select-container">
              <label class="block text-xs mb-1">Select inside Modal:</label>
              <Select
                v-model="modalSelectValue"
                :options="selectOptions"
                placeholder="Pick in modal"
              />
            </div>

            <div data-testid="modal-dropdown-container">
              <label class="block text-xs mb-1">Dropdown inside Modal:</label>
              <Dropdown>
                <template #trigger>
                  <button
                    type="button"
                    class="px-3 py-1.5 border rounded text-sm dropdown-trigger-btn"
                  >
                    Dropdown trigger
                  </button>
                </template>
                <template #dropdown>
                  <DropdownItem data-testid="modal-dd-item-1" command="m-item-1">
                    Action 1
                  </DropdownItem>
                  <DropdownItem data-testid="modal-dd-item-2" command="m-item-2">
                    Action 2
                  </DropdownItem>
                </template>
              </Dropdown>
            </div>
          </div>
        </div>
        <template #footer>
          <button type="button" data-testid="modal-cancel" @click="modalStandardOpen = false">
            Cancel
          </button>
          <button type="button" data-testid="modal-confirm" @click="modalStandardOpen = false">
            Confirm
          </button>
        </template>
      </Modal>

      <!-- Nested Modal -->
      <Modal
        :show="modalNestedOpen"
        title="Nested Modal"
        size="sm"
        @close="modalNestedOpen = false"
      >
        <div class="space-y-3">
          <p>Nested modal body content.</p>
          <input type="text" data-testid="modal-nested-input" placeholder="Nested focus target" />
        </div>
        <template #footer>
          <button type="button" data-testid="modal-nested-close" @click="modalNestedOpen = false">
            Close Nested
          </button>
        </template>
      </Modal>

      <!-- Fullscreen modal -->
      <Modal
        :show="modalFullscreenOpen"
        title="Fullscreen Modal"
        size="fullscreen"
        @close="modalFullscreenOpen = false"
      >
        <p>Fullscreen modal body.</p>
        <input type="text" data-testid="modal-fullscreen-input" placeholder="Fullscreen input" />
      </Modal>

      <!-- Title-focus modal -->
      <Modal
        :show="modalTitleFocusOpen"
        title="Title Focus Modal"
        initial-focus="title"
        @close="modalTitleFocusOpen = false"
      >
        <p>Body for title-focus modal.</p>
      </Modal>
    </section>

    <!-- ╔══════════════════ Drawer ══════════════════╗ -->
    <section data-testid="drawer-section">
      <h2>Drawer</h2>

      <button type="button" data-testid="open-drawer" @click="drawerOpen = true">
        Open drawer
      </button>

      <Drawer v-model="drawerOpen" title="Test Drawer" direction="rtl" size="md">
        <div class="space-y-3 p-4">
          <p>Drawer body content.</p>
          <input type="text" data-testid="drawer-input" placeholder="Drawer input" />
          <a href="#" data-testid="drawer-link">A link in the drawer</a>
        </div>
      </Drawer>
    </section>

    <!-- ╔══════════════════ Dropdown ══════════════════╗ -->
    <section data-testid="dropdown-section">
      <h2>Dropdown</h2>

      <Dropdown
        data-testid="test-dropdown"
        @command="dropdownCommand = $event !== undefined ? String($event) : null"
      >
        <template #trigger>
          <button type="button" data-testid="dropdown-trigger">Dropdown trigger</button>
        </template>
        <template #dropdown>
          <DropdownItem data-testid="dd-item-1" command="edit"> Edit </DropdownItem>
          <DropdownItem data-testid="dd-item-2" command="duplicate"> Duplicate </DropdownItem>
          <DropdownItem data-testid="dd-item-3" command="delete"> Delete </DropdownItem>
        </template>
      </Dropdown>

      <p data-testid="dropdown-result">Last command: {{ dropdownCommand ?? 'none' }}</p>
    </section>

    <!-- ╔══════════════════ Select ══════════════════╗ -->
    <section data-testid="select-section">
      <h2>Select</h2>

      <Select
        v-model="selectValue"
        :options="selectOptions"
        placeholder="Pick a fruit"
        data-testid="test-select"
      />
      <p data-testid="select-result">Selected: {{ selectValue ?? 'none' }}</p>
    </section>

    <!-- ╔══════════════════ Tooltip ══════════════════╗ -->
    <section data-testid="tooltip-section">
      <h2>Tooltip</h2>

      <Tooltip content="Helpful tooltip text" :show-after="0">
        <button type="button" data-testid="tooltip-trigger">Hover or focus me</button>
      </Tooltip>
    </section>
  </main>
</template>

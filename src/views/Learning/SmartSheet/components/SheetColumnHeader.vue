<script setup lang="ts">
import { ref } from 'vue';
import {
  Type,
  Tag,
  Hash,
  Calendar,
  Star,
  CheckSquare,
  FileText,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
} from 'lucide-vue-next';
import type { SheetColumnDef, SheetColumnType } from '../types/sheet';

defineProps<{
  column: SheetColumnDef;
}>();

const emit = defineEmits<{
  (e: 'config', col: SheetColumnDef): void;
  (e: 'move', colId: string, dir: 'left' | 'right'): void;
  (e: 'delete', colId: string): void;
}>();

const showMenu = ref(false);

const typeIconMap: Record<SheetColumnType, any> = {
  text: Type,
  select: Tag,
  'multi-select': Tag,
  number: Hash,
  date: Calendar,
  rating: Star,
  checkbox: CheckSquare,
  'rich-text': FileText,
};
</script>

<template>
  <div class="relative group flex items-center justify-between px-2 py-1.5 select-none">
    <div class="flex items-center gap-1.5 truncate cursor-pointer" @click="emit('config', column)">
      <component
        :is="typeIconMap[column.type] || Type"
        class="w-3.5 h-3.5 text-blue-400 shrink-0"
      />
      <span class="font-medium text-xs text-neutral-200 truncate">{{ column.name }}</span>
    </div>

    <!-- Dropdown Trigger Button -->
    <button
      class="p-1 text-neutral-400 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
      title="列操作"
      @click.stop="showMenu = !showMenu"
    >
      <MoreVertical class="w-3.5 h-3.5" />
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="showMenu"
      class="absolute right-0 top-full mt-1 w-36 rounded-lg bg-neutral-900/95 border border-white/10 p-1 shadow-xl z-30 text-xs backdrop-blur-md"
      @click.stop
    >
      <button
        class="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/10 rounded text-left text-neutral-200"
        @click="
          showMenu = false;
          emit('config', column);
        "
      >
        <Edit2 class="w-3.5 h-3.5" />
        重命名/编辑
      </button>

      <button
        class="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/10 rounded text-left text-neutral-200"
        @click="
          showMenu = false;
          emit('move', column.id, 'left');
        "
      >
        <ChevronLeft class="w-3.5 h-3.5" />
        左移一列
      </button>

      <button
        class="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/10 rounded text-left text-neutral-200"
        @click="
          showMenu = false;
          emit('move', column.id, 'right');
        "
      >
        <ChevronRight class="w-3.5 h-3.5" />
        右移一列
      </button>

      <button
        class="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-500/20 text-red-400 rounded text-left"
        @click="
          showMenu = false;
          emit('delete', column.id);
        "
      >
        <Trash2 class="w-3.5 h-3.5" />
        删除此列
      </button>
    </div>

    <div v-if="showMenu" class="fixed inset-0 z-20" @click="showMenu = false"></div>
  </div>
</template>

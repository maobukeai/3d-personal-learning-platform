<script setup lang="ts">
import { ref } from 'vue';
import Button from '@/components/ui/Button.vue';
import { Plus, X, BookOpen, CheckSquare, CreditCard, Film, Table, Edit3 } from 'lucide-vue-next';
import type { CustomSheetTable } from '../types/sheet';

defineProps<{
  tables: CustomSheetTable[];
  activeId: string;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'create'): void;
  (e: 'rename', id: string, newName: string): void;
  (e: 'delete', id: string): void;
}>();

const editingId = ref<string | null>(null);
const editingTitle = ref('');

const iconMap: Record<string, any> = {
  BookOpen,
  CheckSquare,
  CreditCard,
  Film,
};

const startRename = (table: CustomSheetTable) => {
  editingId.value = table.id;
  editingTitle.value = table.title;
};

const finishRename = (table: CustomSheetTable) => {
  if (editingId.value && editingTitle.value.trim()) {
    emit('rename', table.id, editingTitle.value.trim());
  }
  editingId.value = null;
};
</script>

<template>
  <div
    class="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 no-scrollbar border-b border-white/10"
  >
    <div
      v-for="table in tables"
      :key="table.id"
      :class="[
        'group relative flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-medium cursor-pointer transition-all duration-200 select-none border border-b-0',
        table.id === activeId
          ? 'bg-white/10 text-white border-white/20 shadow-lg backdrop-blur-md font-semibold'
          : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10 hover:text-neutral-200',
      ]"
      @click="emit('select', table.id)"
      @dblclick="startRename(table)"
    >
      <component
        :is="iconMap[table.icon || 'Table'] || Table"
        class="w-3.5 h-3.5 text-blue-400 shrink-0"
      />

      <template v-if="editingId === table.id">
        <input
          v-model="editingTitle"
          type="text"
          class="bg-black/40 text-white px-1.5 py-0.5 rounded outline-none w-24 text-xs"
          @blur="finishRename(table)"
          @keyup.enter="finishRename(table)"
        />
      </template>
      <template v-else>
        <span>{{ table.title }}</span>
      </template>

      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          class="p-0.5 hover:text-white rounded"
          title="双击重命名"
          @click.stop="startRename(table)"
        >
          <Edit3 class="w-3 h-3" />
        </button>
        <button
          v-if="tables.length > 1"
          class="p-0.5 hover:text-red-400 rounded"
          title="删除此工作表"
          @click.stop="emit('delete', table.id)"
        >
          <X class="w-3 h-3" />
        </button>
      </div>

      <!-- Active Indicator Bottom Line -->
      <div
        v-if="table.id === activeId"
        class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"
      ></div>
    </div>

    <!-- 新建工作表按钮 -->
    <Button
      variant="outline"
      size="sm"
      class="h-8 px-2.5 rounded-t-xl text-neutral-400 hover:text-white border-dashed border-white/10"
      title="新建工作表页签"
      @click="emit('create')"
    >
      <Plus class="w-3.5 h-3.5 mr-1" />
      新表
    </Button>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { Plus, Tag } from 'lucide-vue-next';
import type { TwoFactorAccount } from '@/types';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';

const props = defineProps<{
  modelValue: boolean;
  allCategories: string[];
  pendingCategories: string[];
  accounts: TwoFactorAccount[];
  newCategoryName: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:newCategoryName', value: string): void;
  (e: 'create'): void;
  (e: 'rename', oldName: string): void;
  (e: 'delete', categoryName: string): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const localNewCategoryName = computed({
  get: () => props.newCategoryName,
  set: (val) => emit('update:newCategoryName', val),
});

function categoryCount(category: string): number {
  return props.accounts.filter((a) => a.category === category).length;
}

function isPendingEmpty(category: string): boolean {
  return props.pendingCategories.includes(category) && categoryCount(category) === 0;
}
</script>

<template>
  <Modal :show="visible" title="管理分组" size="md" glass-card @close="visible = false">
    <div class="space-y-4">
      <!-- Create new category -->
      <div
        class="rounded-xl border p-3.5 space-y-2.5"
        style="background-color: var(--bg-app); border-color: var(--border-base)"
      >
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">新建分组</p>
        <div class="flex items-center gap-2">
          <el-input
            v-model="localNewCategoryName"
            placeholder="输入新分组名称，如: 工作、金融、游戏..."
            class="custom-dialog-input flex-1"
            clearable
            @keyup.enter="emit('create')"
          />
          <Button variant="primary" size="sm" @click="emit('create')">
            <Plus class="h-3.5 w-3.5 mr-1" />
            创建
          </Button>
        </div>
        <p class="text-[10px] text-slate-500">
          创建后可在添加/编辑账号时选择，或直接将账号卡片拖入分组标签来分配。
        </p>
      </div>

      <!-- Existing categories list -->
      <div class="rounded-xl border overflow-hidden" style="border-color: var(--border-base)">
        <div
          class="flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b"
          style="border-color: var(--border-base); background-color: rgba(15, 23, 42, 0.3)"
        >
          <span>分组名称</span>
          <span>账号数</span>
          <span>操作</span>
        </div>

        <div v-if="allCategories.length === 0" class="py-8 text-center text-xs text-slate-500">
          <Tag class="h-8 w-8 mx-auto mb-2 text-slate-700" />
          <p>暂无分组，在上方输入框创建第一个分组</p>
        </div>

        <div
          v-else
          class="divide-y max-h-72 overflow-y-auto"
          style="border-color: var(--border-base)"
        >
          <div
            v-for="cat in allCategories"
            :key="cat"
            class="flex items-center justify-between px-3 py-2.5 text-xs hover:bg-slate-800/20 transition-colors group"
          >
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></div>
              <span class="font-bold text-slate-800 dark:text-slate-200 truncate">{{ cat }}</span>
              <span
                v-if="isPendingEmpty(cat)"
                class="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full font-bold shrink-0"
                >空</span
              >
            </div>
            <span class="text-slate-500 font-mono text-[11px] shrink-0 mx-4">
              {{ categoryCount(cat) }} 个账号
            </span>
            <div class="flex items-center gap-1 shrink-0">
              <button
                class="px-2 py-1 rounded-lg bg-transparent border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300 cursor-pointer font-bold text-[10px] transition-colors"
                @click="emit('rename', cat)"
              >
                重命名
              </button>
              <button
                class="px-2 py-1 rounded-lg bg-transparent border border-rose-500/20 text-rose-500 hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer font-bold text-[10px] transition-colors"
                @click="emit('delete', cat)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <p class="text-[10px] text-slate-500 leading-relaxed">
        💡 重命名会同步修改该分组下所有账号；删除分组后账号变为「未分类」，数据不会丢失。
      </p>
    </div>

    <template #footer>
      <Button variant="secondary" size="sm" @click="visible = false"> 关闭 </Button>
    </template>
  </Modal>
</template>

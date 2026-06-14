<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Shield,
  Settings,
  Plus,
  Trash2,
  Search,
  ExternalLink,
  GripVertical,
  Copy,
  Key,
  Edit
} from 'lucide-vue-next';

interface GoogleAccount {
  id: string;
  email: string;
  password?: string;
  recoveryEmail?: string;
  twoFASecret?: string;
  country?: string;
  note?: string;
  backupCodes?: string;
  category?: string;
  status: 'warming' | 'completed' | 'paused';
  currentDay: number;
  lastWarmedAt?: string;
  createdAt: string;
}

const props = defineProps<{
  accounts: GoogleAccount[];
  isLoading: boolean;
  listTotpCodes: Record<string, { code: string; timeLeft: number }>;
  categoriesList: string[];
}>();

const emit = defineEmits<{
  (e: 'edit', account: GoogleAccount): void;
  (e: 'delete', account: GoogleAccount): void;
  (e: 'inline-category', payload: { row: GoogleAccount; cmd: string }): void;
  (e: 'batch-status', payload: { ids: string[]; status: 'warming' | 'completed' | 'paused' }): void;
  (e: 'batch-delete', ids: string[]): void;
  (e: 'batch-warm', ids: string[]): void;
  (e: 'batch-category', payload: { ids: string[]; category: string }): void;
  (e: 'add-category', name: string): void;
  (e: 'rename-category', payload: { oldCategory: string; newCategory: string }): void;
  (e: 'delete-category', category: string): void;
}>();

const { t } = useI18n();

const selectedCategory = ref<string>('all');
const isCategoryManagerVisible = ref<boolean>(false);
const searchQuery = ref<string>('');
const newCategoryName = ref<string>('');
const selectedAccountIds = ref<string[]>([]);

// Drag & Drop account categorization
const draggedAccount = ref<GoogleAccount | null>(null);
const draggingOverCategory = ref<string | null>(null);

const getCategoryCount = (category: string) => {
  if (category === 'all') return props.accounts.length;
  if (category === '未分类') {
    return props.accounts.filter(a => !a.category || a.category === '未分类').length;
  }
  return props.accounts.filter(a => a.category === category).length;
};

// Filtered and categorized accounts for the management table
const filteredAndCategorizedAccounts = computed(() => {
  return props.accounts.filter(acc => {
    // Search query filter
    const query = searchQuery.value.trim().toLowerCase();
    const matchQuery = !query ||
      acc.email.toLowerCase().includes(query) ||
      (acc.note && acc.note.toLowerCase().includes(query)) ||
      (acc.country && acc.country.toLowerCase().includes(query)) ||
      (acc.category && acc.category.toLowerCase().includes(query));

    // Category filter
    let matchCategory = true;
    if (selectedCategory.value === '未分类') {
      matchCategory = !acc.category || acc.category === '未分类';
    } else if (selectedCategory.value !== 'all') {
      matchCategory = acc.category === selectedCategory.value;
    }

    return matchQuery && matchCategory;
  });
});

const handleSelectionChange = (selection: GoogleAccount[]) => {
  selectedAccountIds.value = selection.map(item => item.id);
};

const handleDragStart = (event: DragEvent, row: GoogleAccount) => {
  draggedAccount.value = row;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.id);
  }
};

const handleDragEnter = (category: string) => {
  draggingOverCategory.value = category;
};

const handleDragLeave = () => {
  draggingOverCategory.value = null;
};

const handleDrop = (event: DragEvent, targetCategory: string) => {
  event.preventDefault();
  draggingOverCategory.value = null;

  const row = draggedAccount.value;
  if (!row) return;

  const actualCategory = targetCategory === 'all' ? '未分类' : targetCategory;
  const isBatch = selectedAccountIds.value.includes(row.id);
  const targetIds = isBatch ? selectedAccountIds.value : [row.id];

  emit('batch-category', { ids: targetIds, category: actualCategory });
  selectedAccountIds.value = [];
  draggedAccount.value = null;
};

const handleAddCategory = () => {
  const name = newCategoryName.value.trim();
  if (!name) {
    ElMessage.warning('请输入分类名称');
    return;
  }
  if (name === '未分类' || name === 'all') {
    ElMessage.warning('无效的分类名称');
    return;
  }
  if (props.categoriesList.includes(name)) {
    ElMessage.warning('分类已存在');
    return;
  }
  emit('add-category', name);
  newCategoryName.value = '';
};

const handleRenameCategory = (oldCat: string) => {
  ElMessageBox.prompt(`请输入「${oldCat}」的新分类名称`, '重命名分类', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPlaceholder: '新分类名称...',
    inputValue: oldCat,
    customClass: 'dark:bg-slate-900 border-none'
  }).then(({ value }) => {
    const newCat = value ? value.trim() : '未分类';
    if (newCat === oldCat) return;
    emit('rename-category', { oldCategory: oldCat, newCategory: newCat });
    if (selectedCategory.value === oldCat) {
      selectedCategory.value = newCat;
    }
  }).catch(() => {});
};

const handleDeleteCategory = (cat: string) => {
  ElMessageBox.confirm(
    `确定要删除分类「${cat}」吗？该分类下的所有账号将变回「未分类」。`,
    '删除分类',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'dark:bg-slate-900 border-none'
    }
  ).then(() => {
    emit('delete-category', cat);
    if (selectedCategory.value === cat) {
      selectedCategory.value = 'all';
    }
  }).catch(() => {});
};

const handleInlineCategory = (row: GoogleAccount, cmd: string) => {
  if (cmd === 'custom-new-category') {
    ElMessageBox.prompt('请输入新的分类名称', '修改分类', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入新分类名称...',
      customClass: 'dark:bg-slate-900 border-none'
    }).then(({ value }) => {
      const newCat = value ? value.trim() : '未分类';
      emit('inline-category', { row, cmd: newCat });
    }).catch(() => {});
  } else {
    emit('inline-category', { row, cmd });
  }
};

const handleBatchStatus = (status: 'warming' | 'completed' | 'paused') => {
  emit('batch-status', { ids: selectedAccountIds.value, status });
  selectedAccountIds.value = [];
};

const handleBatchDelete = () => {
  ElMessageBox.confirm(
    `确定要删除已选的 ${selectedAccountIds.value.length} 个账号吗？此操作将永久清除养号进度且不可逆！`,
    '批量删除警告',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'dark:bg-slate-900 border-none'
    }
  ).then(() => {
    emit('batch-delete', selectedAccountIds.value);
    selectedAccountIds.value = [];
  }).catch(() => {});
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed':
      return t('tools.googleWarming.statusCompleted');
    case 'paused':
      return t('tools.googleWarming.statusPaused');
    default:
      return t('tools.googleWarming.statusWarming');
  }
};

const copyText = (text?: string) => {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板');
  }).catch(() => {
    ElMessage.error('复制失败');
  });
};
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6 items-start w-full">
    <!-- Sidebar: Categories -->
    <div class="lg:col-span-3 gw-card !p-2 sm:!p-3 flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-stretch justify-between lg:justify-start gap-2.5 max-h-[800px] w-full">
      <div class="flex flex-row lg:flex-row items-center lg:justify-between justify-start pb-0 lg:pb-2 border-b-0 lg:border-b border-slate-200 dark:border-slate-800 shrink-0 gap-1.5 lg:w-full">
        <span class="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <Shield class="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          <span class="hidden sm:inline lg:inline">{{ t('tools.googleWarming.category') }}</span>
        </span>
        <button 
          @click="isCategoryManagerVisible = true" 
          class="text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors flex items-center gap-0.5 cursor-pointer bg-transparent border-none p-1"
          title="管理分类"
        >
          <Settings class="w-3 h-3" />
          <span>管理</span>
        </button>
      </div>

      <div class="flex lg:flex-col flex-row overflow-x-auto lg:overflow-x-visible no-scrollbar lg:overflow-y-auto gap-1.5 flex-1 w-full pb-0.5 lg:pb-0 select-none">
        <button
          v-for="cat in categoriesList"
          :key="cat"
          @click="selectedCategory = cat"
          @dragover.prevent
          @dragenter="handleDragEnter(cat)"
          @dragleave="handleDragLeave"
          @drop="handleDrop($event, cat)"
          :class="[
            'flex items-center justify-between px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer border w-auto lg:w-full shrink-0 lg:shrink',
            selectedCategory === cat
              ? 'bg-violet-600/10 dark:bg-violet-600/15 border-violet-500/30 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 font-semibold shadow-sm'
              : (draggingOverCategory === cat
                 ? 'bg-indigo-600/15 border-indigo-500 text-indigo-600 dark:text-indigo-300 scale-[1.02] shadow-sm font-semibold'
                 : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/40')
          ]"
        >
          <span class="truncate max-w-[100px] lg:max-w-none">{{ cat === 'all' ? t('tools.googleWarming.allCategories') : (cat === '未分类' ? t('tools.googleWarming.uncategorized') : cat) }}</span>
          <span 
            :class="[
              'px-1.5 py-0.5 rounded text-[10px] transition-all font-mono ml-1.5 lg:ml-0',
              selectedCategory === cat 
                ? 'bg-violet-500/20 dark:bg-violet-500/30 text-violet-850 dark:text-violet-200' 
                : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            ]"
          >
            {{ getCategoryCount(cat) }}
          </span>
        </button>
      </div>
    </div>

    <!-- Main Account Table -->
    <div class="lg:col-span-9 gw-card !p-3 sm:!p-4 flex flex-col gap-3 min-h-[500px]">
      <!-- Actions & Search -->
      <div class="flex flex-wrap gap-2 items-center justify-between min-h-[32px]">
        <!-- Batch Actions (visible only when selectedAccountIds.length > 0) -->
        <transition name="el-zoom-in-top">
          <div v-if="selectedAccountIds.length > 0" class="flex flex-wrap gap-1.5 items-center">
            <span class="text-[11px] text-slate-500 dark:text-slate-400 mr-1">已选择 {{ selectedAccountIds.length }} 个:</span>
            
            <!-- Batch change status dropdown -->
            <el-dropdown trigger="click" @command="handleBatchStatus">
              <button
                class="gw-btn-secondary !py-1 !px-2 !text-[10.5px] flex items-center gap-0.5 cursor-pointer"
              >
                <span>修改状态</span>
                <ExternalLink class="w-3 h-3 opacity-60" />
              </button>
              <template #dropdown>
                <el-dropdown-menu class="dark:bg-slate-900 dark:border-slate-800">
                  <el-dropdown-item command="warming" class="text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">设为 养号中</el-dropdown-item>
                  <el-dropdown-item command="paused" class="text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">设为 已暂停</el-dropdown-item>
                  <el-dropdown-item command="completed" class="text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">设为 已毕业</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <!-- Batch delete button -->
            <button
              @click="handleBatchDelete"
              class="gw-btn-secondary !py-1 !px-2 !text-[10.5px] !border-red-500/20 flex items-center gap-0.5 cursor-pointer hover:!bg-red-500/10 hover:!text-red-400"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>删除</span>
            </button>
          </div>
        </transition>

        <!-- Search (always visible) -->
        <div class="relative w-full sm:w-64" :class="{ 'sm:ml-auto': selectedAccountIds.length === 0 }">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('tools.googleWarming.searchPlaceholder')"
            class="gw-input !py-1 !text-xs !pl-8"
          />
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <!-- Table Wrapper -->
      <div class="overflow-x-auto border rounded-xl" style="border-color: var(--border-base); background: var(--bg-card)">
        <el-table
          v-loading="isLoading"
          :data="filteredAndCategorizedAccounts"
          @selection-change="handleSelectionChange"
          style="width: 100%;"
          class="custom-el-table !text-xs"
        >
          <el-table-column type="selection" width="45" align="center" />
          
          <!-- Email -->
          <el-table-column label="邮箱账号" min-width="210">
            <template #default="{ row }">
              <div 
                draggable="true" 
                @dragstart="handleDragStart($event, row)"
                class="flex items-center gap-1.5 cursor-grab active:cursor-grabbing hover:bg-slate-500/5 p-1 rounded transition-all"
                title="可拖拽该账号至左侧分类"
              >
                <GripVertical class="w-3.5 h-3.5 opacity-40 shrink-0 cursor-grab active:cursor-grabbing" style="color: var(--text-muted)" />
                <span class="font-medium truncate max-w-[160px]" style="color: var(--text-primary)" :title="row.email">{{ row.email }}</span>
                <button @click.stop="copyText(row.email)" class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5" style="color: var(--text-muted)" title="复制邮箱">
                  <Copy class="w-3.5 h-3.5" />
                </button>
                
                <!-- 2FA popover -->
                <el-popover v-if="row.twoFASecret" trigger="click" width="220" placement="top" class="dark:bg-slate-900">
                  <template #reference>
                    <button @click.stop class="text-indigo-500 hover:text-indigo-400 p-0.5" title="点击获取2FA验证码">
                      <Key class="w-3.5 h-3.5" />
                    </button>
                  </template>
                  <div class="p-2 space-y-2 text-xs">
                    <p class="font-bold text-slate-700 dark:text-slate-200">2FA 实时动态密码</p>
                    <div class="flex items-center justify-between bg-slate-100 dark:bg-slate-950/50 p-2 rounded border border-slate-200 dark:border-slate-800">
                      <span class="font-mono text-base font-bold text-indigo-400">
                        {{ listTotpCodes[row.id]?.code || '------' }}
                      </span>
                      <span class="text-[10px] text-slate-500">
                        {{ listTotpCodes[row.id]?.timeLeft || 30 }}s
                      </span>
                    </div>
                  </div>
                </el-popover>
              </div>
            </template>
          </el-table-column>

          <!-- Password -->
          <el-table-column label="密码" width="100">
            <template #default="{ row }">
              <div class="flex items-center gap-1 justify-between">
                <span class="font-mono truncate max-w-[70px]" style="color: var(--text-muted)">******</span>
                <button @click="copyText(row.password)" class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5" style="color: var(--text-muted)" title="复制密码">
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>
            </template>
          </el-table-column>

          <!-- Recovery Email -->
          <el-table-column label="辅助邮箱" width="160">
            <template #default="{ row }">
              <div v-if="row.recoveryEmail" class="flex items-center gap-1 justify-between">
                <span class="truncate max-w-[120px]" style="color: var(--text-secondary)" :title="row.recoveryEmail">{{ row.recoveryEmail }}</span>
                <button @click="copyText(row.recoveryEmail)" class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5" style="color: var(--text-muted)" title="复制辅助邮箱">
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>
              <span v-else style="color: var(--text-muted)">-</span>
            </template>
          </el-table-column>

          <!-- Backup Codes -->
          <el-table-column label="备用密码" width="160">
            <template #default="{ row }">
              <div v-if="row.backupCodes" class="flex items-center gap-1 justify-between">
                <span class="truncate max-w-[120px]" style="color: var(--text-secondary)" :title="row.backupCodes">{{ row.backupCodes }}</span>
                <button @click="copyText(row.backupCodes)" class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5" style="color: var(--text-muted)" title="复制备用密码">
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>
              <span v-else style="color: var(--text-muted)">-</span>
            </template>
          </el-table-column>

          <!-- Region -->
          <el-table-column label="地区" width="110" align="center">
            <template #default="{ row }">
              <span style="color: var(--text-primary)">{{ row.country || '-' }}</span>
            </template>
          </el-table-column>

          <!-- Status -->
          <el-table-column label="状态" width="120" align="center">
            <template #default="{ row }">
              <span
                v-if="row.status === 'warming'"
                class="px-1.5 py-0.5 rounded text-[10px] bg-violet-500/10 text-violet-500 border border-violet-500/20"
              >
                {{ t('tools.googleWarming.statusWarming') }} (D{{ row.currentDay }})
              </span>
              <span
                v-else-if="row.status === 'completed'"
                class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
              >
                {{ t('tools.googleWarming.statusCompleted') }}
              </span>
              <span
                v-else
                class="px-1.5 py-0.5 rounded text-[10px] bg-slate-500/10 text-slate-500 border border-slate-500/20"
              >
                {{ t('tools.googleWarming.statusPaused') }}
              </span>
            </template>
          </el-table-column>

          <!-- Category dropdown -->
          <el-table-column label="分类" width="100">
            <template #default="{ row }">
              <el-dropdown trigger="click" @command="(cmd) => handleInlineCategory(row, cmd)">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-medium inline-block max-w-[90px] truncate border cursor-pointer hover:opacity-80 transition-opacity"
                  :style="row.category && row.category !== '未分类' 
                    ? 'background: rgba(99, 102, 241, 0.1); color: #6366f1; border-color: rgba(99, 102, 241, 0.2);' 
                    : 'background: var(--bg-app); color: var(--text-muted); border-color: var(--border-base);'"
                  :title="row.category || '未分类'"
                >
                  {{ row.category || '未分类' }}
                </span>
                <template #dropdown>
                  <el-dropdown-menu class="dark:bg-slate-900 dark:border-slate-800">
                    <el-dropdown-item 
                      v-for="cat in categoriesList.filter(c => c !== 'all')" 
                      :key="cat" 
                      :command="cat"
                      class="text-xs hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                      :disabled="row.category === cat || (!row.category && cat === '未分类')"
                    >
                      {{ cat === '未分类' ? t('tools.googleWarming.uncategorized') : cat }}
                    </el-dropdown-item>
                    <el-dropdown-item divided command="custom-new-category" class="text-xs hover:bg-slate-800 text-slate-700 dark:text-slate-200">
                      自定义新分类...
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-table-column>

          <!-- Note -->
          <el-table-column label="备注" min-width="110">
            <template #default="{ row }">
              <span class="truncate max-w-[150px] inline-block" style="color: var(--text-muted)" :title="row.note">{{ row.note || '-' }}</span>
            </template>
          </el-table-column>

          <!-- Actions -->
          <el-table-column label="操作" width="90" align="right">
            <template #default="{ row }">
              <div class="flex items-center justify-end gap-1">
                <button @click="emit('edit', row)" class="hover:text-violet-600 dark:hover:text-violet-400 p-1 transition-colors cursor-pointer" style="color: var(--text-muted)">
                  <Edit class="w-3.5 h-3.5" />
                </button>
                <button @click="emit('delete', row)" class="hover:text-red-600 dark:hover:text-red-400 p-1 transition-colors cursor-pointer" style="color: var(--text-muted)">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>

  <!-- Category Manager Dialog -->
  <el-dialog
    v-model="isCategoryManagerVisible"
    title="分类管理"
    width="90%"
    style="max-width: 460px"
    align-center
    class="gw-dialog"
  >
    <div class="space-y-3">
      <p class="text-[11px] text-slate-500 dark:text-slate-400">
        在此处管理您的自定义分类。重命名会批量更新所有属于该分类的账号；删除分类会将该分类下的账号重置为“未分类”。
      </p>

      <div class="flex items-center gap-2 pb-1">
        <input 
          v-model="newCategoryName" 
          type="text" 
          placeholder="新增分类名称，例如: GCP" 
          class="gw-input flex-1 !py-1.5 !text-xs"
          @keyup.enter="handleAddCategory"
        />
        <button 
          @click="handleAddCategory"
          class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs px-3.5 py-1.5 rounded-lg transition-all font-semibold cursor-pointer flex items-center gap-1"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>新增</span>
        </button>
      </div>

      <div class="border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto" style="border-color: var(--border-base)">
        <table class="w-full text-xs text-left">
          <thead class="text-xs border-b font-medium" style="background: var(--bg-app); border-color: var(--border-base); color: var(--text-secondary)">
            <tr>
              <th class="p-2.5">分类名称</th>
              <th class="p-2.5 text-center" width="80">账号数量</th>
              <th class="p-2.5 text-right" width="120">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y" style="border-color: var(--border-base); background: var(--bg-card)">
            <tr 
              v-for="cat in categoriesList.filter(c => c !== 'all' && c !== '未分类')" 
              :key="cat"
              class="hover:bg-slate-500/5"
              style="border-color: var(--border-base)"
            >
              <td class="p-2.5 font-medium truncate max-w-[180px]" style="color: var(--text-primary)" :title="cat">
                {{ cat }}
              </td>
              <td class="p-2.5 text-center font-semibold font-mono" style="color: var(--text-muted)">
                {{ getCategoryCount(cat) }}
              </td>
              <td class="p-2.5 text-right space-x-2.5">
                <button 
                  @click="handleRenameCategory(cat)"
                  class="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer font-medium bg-transparent border-none p-0"
                >
                  重命名
                </button>
                <button 
                  @click="handleDeleteCategory(cat)"
                  class="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 cursor-pointer font-medium bg-transparent border-none p-0"
                >
                  删除
                </button>
              </td>
            </tr>
            <tr v-if="categoriesList.filter(c => c !== 'all' && c !== '未分类').length === 0">
              <td colspan="3" class="p-6 text-center italic" style="color: var(--text-muted)">
                暂无自定义分类，可以在账号列表的“分类”标签直接创建。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end pt-1">
        <button
          @click="isCategoryManagerVisible = false"
          class="gw-btn-secondary text-xs cursor-pointer"
        >
          关闭
        </button>
      </div>
    </template>
  </el-dialog>
</template>

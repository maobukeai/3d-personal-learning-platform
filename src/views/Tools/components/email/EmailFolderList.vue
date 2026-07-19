<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Inbox, Send, FileText, AlertTriangle, Trash2, ChevronRight } from 'lucide-vue-next';

defineProps<{
  selectedAccountId: string;
  currentFolder: string;
}>();

defineEmits<{
  (e: 'changeFolder', folderId: string): void;
}>();

const { t } = useI18n();

const foldersList = [
  { id: 'inbox', name: t('tools.email.folders.inbox'), icon: Inbox },
  { id: 'sentitems', name: t('tools.email.folders.sentitems'), icon: Send },
  { id: 'drafts', name: t('tools.email.folders.drafts'), icon: FileText },
  { id: 'junkemail', name: t('tools.email.folders.junkemail'), icon: AlertTriangle },
  { id: 'deleteditems', name: t('tools.email.folders.deleteditems'), icon: Trash2 },
];
</script>

<template>
  <div v-show="selectedAccountId" class="border-t border-slate-100 dark:border-slate-900 pt-4">
    <div class="px-2 mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
      {{ $t('tools.email.email_folders_label') }}
    </div>
    <ul class="flex flex-col gap-0.5">
      <li v-for="folder in foldersList" :key="folder.id">
        <button
          type="button"
          class="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 text-left"
          :class="[
            currentFolder === folder.id
              ? 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold'
              : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-800 dark:hover:text-slate-200',
          ]"
          @click="$emit('changeFolder', folder.id)"
        >
          <div class="flex items-center gap-2">
            <component :is="folder.icon" class="w-4 h-4 text-slate-400" />
            <span>{{ folder.name }}</span>
          </div>
          <ChevronRight v-show="currentFolder === folder.id" class="w-3 h-3 text-slate-300" />
        </button>
      </li>
    </ul>
  </div>
</template>

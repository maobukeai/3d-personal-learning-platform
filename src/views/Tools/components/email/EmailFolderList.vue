<script setup lang="ts">
import { computed } from 'vue';
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

const foldersList = computed(() => [
  { id: 'inbox', name: t('tools.email.folders.inbox'), icon: Inbox },
  { id: 'sentitems', name: t('tools.email.folders.sentitems'), icon: Send },
  { id: 'drafts', name: t('tools.email.folders.drafts'), icon: FileText },
  { id: 'junkemail', name: t('tools.email.folders.junkemail'), icon: AlertTriangle },
  { id: 'deleteditems', name: t('tools.email.folders.deleteditems'), icon: Trash2 },
]);
</script>

<template>
  <div v-show="selectedAccountId">
    <div class="px-2 mb-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
      {{ $t('tools.email.email_folders_label') }}
    </div>
    <ul class="flex flex-col gap-0.5">
      <li v-for="folder in foldersList" :key="folder.id">
        <button
          type="button"
          class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 text-left cursor-pointer"
          :class="[
            currentFolder === folder.id
              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-200',
          ]"
          @click="$emit('changeFolder', folder.id)"
        >
          <div class="flex items-center gap-2">
            <component
              :is="folder.icon"
              class="w-4 h-4 transition-colors"
              :class="
                currentFolder === folder.id
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500'
              "
            />
            <span>{{ folder.name }}</span>
          </div>
          <ChevronRight
            v-show="currentFolder === folder.id"
            class="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400"
          />
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { Github, KeyRound, GitBranch, FolderOpen, Eye, Loader2 } from 'lucide-vue-next';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';

defineProps<{
  myNotebooksList: string[];
}>();

const emit = defineEmits<{
  (e: 'imported'): void;
}>();

const { t } = useI18n();
const visible = ref(false);
const isImporting = ref(false);

const form = reactive({
  repoUrl: '',
  token: '',
  branch: 'main',
  folderPath: '',
  category: '',
  visibility: 'PRIVATE',
});

const handleSaveConfig = () => {
  localStorage.setItem(
    'github_import_config',
    JSON.stringify({
      repoUrl: form.repoUrl,
      token: form.token,
      branch: form.branch,
      folderPath: form.folderPath,
      category: form.category,
      visibility: form.visibility,
    }),
  );
  ElMessage.success(t('notes.githubImport.configSaved'));
};

const open = () => {
  const saved = localStorage.getItem('github_import_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      form.repoUrl = parsed.repoUrl || '';
      form.token = parsed.token || '';
      form.branch = parsed.branch || 'main';
      form.folderPath = parsed.folderPath || '';
      form.category = parsed.category || '';
      form.visibility = parsed.visibility || 'PRIVATE';
    } catch (e) {
      logError(e, { operation: 'notes.parseGithubConfig', component: 'NoteImportGithubDialog' });
      resetForm();
    }
  } else {
    resetForm();
  }
  visible.value = true;
};

const resetForm = () => {
  form.repoUrl = '';
  form.token = '';
  form.branch = 'main';
  form.folderPath = '';
  form.category = '';
  form.visibility = 'PRIVATE';
};

const isCheckingRepo = ref(false);

const checkGithubRepo = async () => {
  const url = form.repoUrl.trim();
  if (!url) return;

  let cleanPath = url;
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    cleanPath = cleanPath.replace(/^https?:\/\/github\.com\//i, '');
  }
  cleanPath = cleanPath.replace(/\.git$/i, '');
  const parts = cleanPath.split('/');
  if (parts.length < 2) {
    ElMessage.error(t('notes.githubImport.invalidRepo'));
    return;
  }
  const owner = parts[0];
  const repo = parts[1];

  isCheckingRepo.value = true;
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (form.token.trim()) {
      headers['Authorization'] = `Bearer ${form.token.trim()}`;
    }

    await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    ElMessage.success(t('notes.githubImport.repoValid'));
  } catch (err: unknown) {
    logError(err, { operation: 'notes.validateGithubRepo', component: 'NoteImportGithubDialog' });
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 404) {
        ElMessage.error(t('notes.githubImport.repoNotFound'));
      } else if (status === 401) {
        ElMessage.error(t('notes.githubImport.unauthorized'));
      } else {
        ElMessage.error(err.response?.data?.message || t('notes.githubImport.connectFailed'));
      }
    } else {
      ElMessage.error(t('notes.githubImport.connectFailed'));
    }
  } finally {
    isCheckingRepo.value = false;
  }
};

const handleImport = async () => {
  if (!form.repoUrl || !form.repoUrl.trim()) {
    ElMessage.warning(t('notes.githubImport.repoRequired'));
    return;
  }

  isImporting.value = true;
  try {
    const res = await api.post('/api/notes/import/github', {
      repoUrl: form.repoUrl.trim(),
      token: form.token.trim() || null,
      branch: form.branch.trim() || 'main',
      folderPath: form.folderPath.trim() || null,
      category: form.category || null,
      visibility: form.visibility,
    });

    ElMessage({
      message: res.data.message || t('notes.githubImport.importSuccess'),
      type: 'success',
      duration: 5000,
    });
    emit('imported');
    visible.value = false;
  } catch (error: unknown) {
    const errorMsg =
      (axios.isAxiosError(error) && error.response?.data?.error) ||
      t('notes.githubImport.importFailed');
    ElMessage.error({
      message: errorMsg,
      duration: 5000,
    });
  } finally {
    isImporting.value = false;
  }
};

defineExpose({ open });
</script>

<template>
  <Modal :show="visible" title="GitHub 笔记同步" size="md" glass-card @close="visible = false">
    <!-- Custom Header Slot for Premium Branding -->
    <template #header>
      <div class="mobile-row flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0"
        >
          <Github class="w-4.5 h-4.5" />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-black text-[var(--text-primary)] leading-none">
            {{ t('notes.githubImport.dialogTitle') }}
          </h3>
          <p class="text-[10px] text-[var(--text-muted)] mt-1.5 leading-none">
            {{ t('notes.githubImport.dialogSubtitle') }}
          </p>
        </div>
      </div>
    </template>

    <div class="mobile-adaptive relative space-y-4">
      <!-- Loading Overlay -->
      <div
        v-if="isImporting"
        class="absolute -inset-4 bg-[var(--bg-card)]/90 backdrop-blur-xs z-50 flex flex-col items-center justify-center space-y-3 rounded-2xl"
      >
        <Loader2 class="animate-spin text-accent w-9 h-9" />
        <div class="text-center">
          <p class="text-xs font-black text-[var(--text-primary)]">
            {{ t('notes.githubImport.syncing') }}
          </p>
          <p class="text-[10px] text-[var(--text-secondary)] mt-1">
            {{ t('notes.githubImport.syncingDesc') }}
          </p>
        </div>
      </div>

      <!-- Inputs -->
      <div class="space-y-4">
        <div class="space-y-1.5">
          <div class="mobile-row flex items-center justify-between">
            <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">
              {{ t('notes.githubImport.repoUrlLabel') }} <span class="text-rose-500">*</span>
            </label>
            <button
              type="button"
              class="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:opacity-85 active:scale-95 transition-all cursor-pointer flex items-center gap-0.5 disabled:opacity-40 disabled:pointer-events-none"
              :disabled="isCheckingRepo || !form.repoUrl.trim()"
              @click="checkGithubRepo"
            >
              <Loader2 v-if="isCheckingRepo" class="animate-spin w-2.5 h-2.5" />
              <span>{{ t('notes.githubImport.testValidity') }}</span>
            </button>
          </div>
          <Input
            v-model="form.repoUrl"
            :placeholder="t('notes.githubImport.repoPlaceholder')"
            :icon="Github"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">
            {{ t('notes.githubImport.tokenLabel') }}
          </label>
          <Input
            v-model="form.token"
            type="password"
            :placeholder="t('notes.githubImport.tokenPlaceholder')"
            :icon="KeyRound"
          />
        </div>

        <div class="mobile-grid grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">
              {{ t('notes.githubImport.branchLabel') }}
            </label>
            <Input
              v-model="form.branch"
              :placeholder="t('notes.githubImport.branchPlaceholder')"
              :icon="GitBranch"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">
              {{ t('notes.githubImport.folderLabel') }}
            </label>
            <Input
              v-model="form.folderPath"
              :placeholder="t('notes.githubImport.folderPlaceholder')"
              :icon="FolderOpen"
            />
          </div>
        </div>

        <div class="mobile-grid grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">
              {{ t('notes.githubImport.defaultNotebookLabel') }}
            </label>
            <el-select
              v-model="form.category"
              :placeholder="t('notes.githubImport.selectNotebookPlaceholder')"
              class="w-full custom-select"
            >
              <el-option :label="t('notes.githubImport.uncategorizedOption')" value="" />
              <el-option v-for="item in myNotebooksList" :key="item" :label="item" :value="item" />
            </el-select>
          </div>
          <div class="space-y-1.5">
            <label
              class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5 flex items-center gap-1"
            >
              <Eye class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              {{ t('notes.githubImport.visibilityLabel') }}
            </label>
            <div
              class="mobile-row flex p-0.5 bg-slate-100 dark:bg-zinc-800 rounded-lg border border-[var(--border-base)] w-full"
            >
              <button
                type="button"
                class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer text-center"
                :class="
                  form.visibility === 'PRIVATE'
                    ? 'bg-white dark:bg-zinc-700 text-[var(--text-primary)] shadow-xs border border-black/5 dark:border-white/5'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                "
                @click="form.visibility = 'PRIVATE'"
              >
                {{ t('notes.githubImport.visibilityPrivate') }}
              </button>
              <button
                type="button"
                class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer text-center"
                :class="
                  form.visibility === 'PUBLIC'
                    ? 'bg-white dark:bg-zinc-700 text-[var(--text-primary)] shadow-xs border border-black/5 dark:border-white/5'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                "
                @click="form.visibility = 'PUBLIC'"
              >
                {{ t('notes.githubImport.visibilityPublic') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="mobile-row flex justify-between items-center w-full">
        <!-- Left: Save Config Button -->
        <Button variant="secondary" size="sm" :disabled="isImporting" @click="handleSaveConfig">
          {{ t('notes.githubImport.saveConfig') }}
        </Button>

        <!-- Right: Cancel & Start Sync Buttons -->
        <div class="flex gap-2.5">
          <Button variant="outline" size="sm" :disabled="isImporting" @click="visible = false">
            {{ t('common.cancel') }}
          </Button>
          <Button
            variant="primary"
            size="sm"
            :disabled="isImporting"
            :loading="isImporting"
            @click="handleImport"
          >
            {{ t('notes.githubImport.syncNow') }}
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style></style>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { 
  Github, 
  KeyRound, 
  GitBranch, 
  FolderOpen, 
  Eye, 
  Loader2 
} from 'lucide-vue-next';
import api from '@/utils/api';
import axios from 'axios';

defineProps<{
  myNotebooksList: string[];
}>();

const emit = defineEmits<{
  (e: 'imported'): void;
}>();

const visible = ref(false);
const isImporting = ref(false);

const form = reactive({
  repoUrl: '',
  token: '',
  branch: 'main',
  folderPath: '',
  category: '',
  visibility: 'PRIVATE'
});

const handleSaveConfig = () => {
  localStorage.setItem('github_import_config', JSON.stringify({
    repoUrl: form.repoUrl,
    token: form.token,
    branch: form.branch,
    folderPath: form.folderPath,
    category: form.category,
    visibility: form.visibility
  }));
  ElMessage.success('配置已成功保存到本地！');
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
      console.error('Failed to parse saved github config', e);
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
    ElMessage.error('无效的仓库地址，格式应为 owner/repo');
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
    ElMessage.success('检测成功：该 GitHub 仓库有效且可访问！');
  } catch (err: any) {
    console.error('Validation error:', err);
    const status = err.response?.status;
    if (status === 404) {
      ElMessage.error('检测失败：未找到该仓库，若是私有仓库请确认是否填写了正确的密钥。');
    } else if (status === 401) {
      ElMessage.error('检测失败：无权访问，请检查密钥是否正确。');
    } else {
      ElMessage.error(err.response?.data?.message || '连接 GitHub 失败，请检查仓库路径或网络。');
    }
  } finally {
    isCheckingRepo.value = false;
  }
};

const handleImport = async () => {
  if (!form.repoUrl || !form.repoUrl.trim()) {
    ElMessage.warning('请输入 GitHub 仓库地址');
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
      visibility: form.visibility
    });

    ElMessage({
      message: res.data.message || '导入成功！',
      type: 'success',
      duration: 5000
    });
    emit('imported');
    visible.value = false;
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || '导入失败，请检查配置参数。';
    ElMessage.error({
      message: errorMsg,
      duration: 5000
    });
  } finally {
    isImporting.value = false;
  }
};

defineExpose({ open });
</script>

<template>
  <el-dialog
    v-model="visible"
    width="480px"
    destroy-on-close
    :close-on-click-modal="!isImporting"
    :close-on-press-escape="!isImporting"
    :show-close="!isImporting"
    class="github-import-dialog"
  >
    <!-- Custom Header Slot for Premium Branding -->
    <template #header>
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
          <Github class="w-4.5 h-4.5" />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-black text-[var(--text-primary)] leading-none">导入 GitHub 笔记</h3>
          <p class="text-[10px] text-[var(--text-muted)] mt-1.5 leading-none">从 GitHub 备份一键同步 Obsidian Markdown 笔记</p>
        </div>
      </div>
    </template>

    <div class="relative space-y-4">
      <!-- Loading Overlay -->
      <div 
        v-if="isImporting" 
        class="absolute -inset-4 bg-[var(--bg-card)]/90 backdrop-blur-xs z-50 flex flex-col items-center justify-center space-y-3 rounded-2xl"
      >
        <Loader2 class="animate-spin text-accent w-9 h-9" />
        <div class="text-center">
          <p class="text-xs font-black text-[var(--text-primary)]">正在拉取并解析 Obsidian 笔记...</p>
          <p class="text-[10px] text-[var(--text-secondary)] mt-1">这可能需要几秒到一分钟时间，请稍候</p>
        </div>
      </div>

      <!-- Inputs -->
      <div class="space-y-4">
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">
              GitHub 仓库路径或 URL <span class="text-rose-500">*</span>
            </label>
            <button 
              type="button"
              class="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:opacity-85 active:scale-95 transition-all cursor-pointer flex items-center gap-0.5 disabled:opacity-40 disabled:pointer-events-none"
              :disabled="isCheckingRepo || !form.repoUrl.trim()"
              @click="checkGithubRepo"
            >
              <Loader2 v-if="isCheckingRepo" class="animate-spin w-2.5 h-2.5" />
              <span>检测有效性</span>
            </button>
          </div>
          <el-input 
            v-model="form.repoUrl" 
            placeholder="例如: owner/repo 或 github.com/owner/repo" 
            autocomplete="off"
          >
            <template #prefix>
              <Github class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
            </template>
          </el-input>
        </div>

        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">
            Personal Access Token (密钥)
          </label>
          <el-input 
            v-model="form.token" 
            type="password" 
            show-password
            placeholder="公开仓库可留空；私密仓库必须填写" 
            autocomplete="new-password"
          >
            <template #prefix>
              <KeyRound class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
            </template>
          </el-input>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">
              默认分支
            </label>
            <el-input 
              v-model="form.branch" 
              placeholder="默认: main" 
              autocomplete="off"
            >
              <template #prefix>
                <GitBranch class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              </template>
            </el-input>
          </div>
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">
              指定文件夹目录
            </label>
            <el-input 
              v-model="form.folderPath" 
              placeholder="可选，例如: docs" 
              autocomplete="off"
            >
              <template #prefix>
                <FolderOpen class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              </template>
            </el-input>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5">
              默认笔记本
            </label>
            <el-select v-model="form.category" placeholder="选择默认笔记本" class="w-full custom-select">
              <el-option label="默认分类 (未分类)" value="" />
              <el-option v-for="item in myNotebooksList" :key="item" :label="item" :value="item" />
            </el-select>
          </div>
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-[var(--text-secondary)] px-0.5 flex items-center gap-1">
              <Eye class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              导入笔记的可见性
            </label>
            <el-radio-group v-model="form.visibility" class="w-full flex custom-radio-group">
              <el-radio-button label="PRIVATE" class="flex-1">私密</el-radio-button>
              <el-radio-button label="PUBLIC" class="flex-1">公开</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <!-- Left: Save Config Button -->
        <button 
          type="button" 
          class="px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-xl active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          :disabled="isImporting" 
          @click="handleSaveConfig"
        >
          <span>保存配置</span>
        </button>

        <!-- Right: Cancel & Start Sync Buttons -->
        <div class="flex gap-2.5">
          <button 
            type="button" 
            class="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl hover:bg-[var(--bg-subtle)] active:scale-95 transition-all cursor-pointer"
            :disabled="isImporting" 
            @click="visible = false"
          >
            取消
          </button>
          <button 
            type="button" 
            class="px-5 py-2 text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/10 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            :disabled="isImporting" 
            @click="handleImport"
          >
            <Loader2 v-if="isImporting" class="animate-spin w-3.5 h-3.5" />
            <span>一键同步</span>
          </button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style>
.github-import-dialog {
  border-radius: 1.25rem !important;
  border: 1px solid var(--border-base) !important;
  background-color: var(--bg-card) !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
}
.github-import-dialog .el-dialog__header {
  border-bottom: 1px solid var(--border-base) !important;
  padding: 1.25rem 1.5rem 1rem 1.5rem !important;
  margin: 0 !important;
}
.github-import-dialog .el-dialog__body {
  padding: 1.5rem 1.5rem 1rem 1.5rem !important;
}
.github-import-dialog .el-dialog__footer {
  padding: 1rem 1.5rem 1.25rem 1.5rem !important;
  border-top: 1px solid var(--border-base) !important;
  background-color: var(--bg-app)/30;
}

/* Customizing inputs to look modern & minimalist */
.github-import-dialog .el-input__wrapper {
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
  border-radius: 0.75rem !important;
  padding: 6px 10px !important;
  transition: all 0.2s ease-in-out !important;
}
.github-import-dialog .el-input__wrapper.is-focus,
.github-import-dialog .el-input__wrapper:hover {
  border-color: var(--accent) !important;
  background-color: var(--bg-card) !important;
  box-shadow: 0 0 0 1px var(--accent) !important;
}
.github-import-dialog .el-input__inner {
  font-size: 13px !important;
  color: var(--text-primary) !important;
  font-weight: 500 !important;
}
.github-import-dialog .el-input__inner::placeholder {
  color: var(--text-muted) !important;
  font-size: 11px !important;
}
.github-import-dialog .el-input__prefix {
  margin-right: 4px !important;
}

/* Customizing Select wrapper */
.github-import-dialog .el-select .el-select__wrapper {
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
  border-radius: 0.75rem !important;
  min-height: 38px !important;
  padding: 4px 10px !important;
  transition: all 0.2s ease-in-out !important;
}
.github-import-dialog .el-select .el-select__wrapper:hover,
.github-import-dialog .el-select .el-select__wrapper.is-focus {
  border-color: var(--accent) !important;
  background-color: var(--bg-card) !important;
  box-shadow: 0 0 0 1px var(--accent) !important;
}
.github-import-dialog .el-select__placeholder {
  font-size: 12px !important;
  color: var(--text-muted) !important;
}
.github-import-dialog .el-select__text {
  font-size: 13px !important;
  color: var(--text-primary) !important;
  font-weight: 500 !important;
}

/* Customizing Radio group */
.github-import-dialog .el-radio-button__inner {
  background-color: var(--bg-app) !important;
  border: 1px solid var(--border-base) !important;
  color: var(--text-secondary) !important;
  font-size: 12px !important;
  height: 38px !important;
  line-height: 36px !important;
  padding: 0 16px !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  transition: all 0.2s ease-in-out !important;
  font-weight: bold !important;
  width: 100% !important;
}
.github-import-dialog .el-radio-button:first-child .el-radio-button__inner {
  border-radius: 0.75rem 0 0 0.75rem !important;
  border-right: none !important;
}
.github-import-dialog .el-radio-button:last-child .el-radio-button__inner {
  border-radius: 0 0.75rem 0.75rem 0 !important;
  border-left: none !important;
}
.github-import-dialog .el-radio-button.is-active .el-radio-button__inner {
  background-color: var(--accent) !important;
  border-color: var(--accent) !important;
  color: #ffffff !important;
}
</style>

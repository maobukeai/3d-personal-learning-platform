<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Share2, Copy, Check, Calendar, Clock, Link, MessageSquare } from 'lucide-vue-next';
import api from '@/utils/api';

interface Note {
  id: string;
  title: string;
  content: string;
  userId: string;
  user: { id: string; name: string };
  createdAt: string;
}

interface ShareConfig {
  id: string;
  noteId: string;
  expiresAt: string | null;
  customText: string | null;
  createdAt: string;
}

const visible = ref(false);
const note = ref<Note | null>(null);
const loading = ref(false);
const saving = ref(false);
const shareConfig = ref<ShareConfig | null>(null);
const durationType = ref<'permanent' | '1h' | '1d' | '7d' | '30d' | 'custom'>('permanent');
const customExpiresAt = ref<Date | null>(null);
const customText = ref('');
const enableCustomText = ref(false);
const isCopied = ref(false);

const shareUrl = computed(() => {
  if (!shareConfig.value) return '';
  return `${window.location.origin}/share/note/${shareConfig.value.id}`;
});

const isExpired = computed(() => {
  if (!shareConfig.value || !shareConfig.value.expiresAt) return false;
  return new Date() > new Date(shareConfig.value.expiresAt);
});

const getExpiryText = (expiresAt: string | null) => {
  if (!expiresAt) return '永久有效';
  const date = new Date(expiresAt);
  if (new Date() > date) return '已过期';
  return `有效期至: ${date.toLocaleString('zh-CN')}`;
};

const open = async (targetNote: Note) => {
  note.value = targetNote;
  visible.value = true;
  loading.value = true;
  shareConfig.value = null;
  durationType.value = 'permanent';
  customExpiresAt.value = null;
  customText.value = '';
  enableCustomText.value = false;
  isCopied.value = false;

  try {
    const res = await api.get(`/api/notes/${targetNote.id}/share`);
    if (res.data) {
      shareConfig.value = res.data;
      customText.value = res.data.customText || '';
      enableCustomText.value = !!res.data.customText;
      if (res.data.expiresAt) {
        // Try to match duration types or set custom
        const diffMs = new Date(res.data.expiresAt).getTime() - new Date().getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);
        if (Math.abs(diffHrs - 1) < 0.05) durationType.value = '1h';
        else if (Math.abs(diffHrs - 24) < 0.1) durationType.value = '1d';
        else if (Math.abs(diffHrs - 168) < 0.5) durationType.value = '7d';
        else if (Math.abs(diffHrs - 720) < 1) durationType.value = '30d';
        else {
          durationType.value = 'custom';
          customExpiresAt.value = new Date(res.data.expiresAt);
        }
      }
    }
  } catch (error) {
    console.error('获取分享配置失败', error);
  } finally {
    loading.value = false;
  }
};

const handleCreateOrUpdate = async () => {
  if (!note.value) return;
  saving.value = true;
  try {
    let payload: any = {};
    if (durationType.value === '1h') payload.expireHours = 1;
    else if (durationType.value === '1d') payload.expireHours = 24;
    else if (durationType.value === '7d') payload.expireHours = 168;
    else if (durationType.value === '30d') payload.expireHours = 720;
    else if (durationType.value === 'custom') {
      if (!customExpiresAt.value) {
        ElMessage.warning('请选择自定义过期时间');
        saving.value = false;
        return;
      }
      if (customExpiresAt.value <= new Date()) {
        ElMessage.warning('过期时间不能早于当前时间');
        saving.value = false;
        return;
      }
      payload.expiresAt = customExpiresAt.value.toString();
    } else {
      payload.expireHours = null; // Permanent
    }

    // Attach optional custom Text
    payload.customText = enableCustomText.value ? (customText.value.trim() || null) : null;

    const res = await api.post(`/api/notes/${note.value.id}/share`, payload);
    shareConfig.value = res.data;
    ElMessage.success(shareConfig.value ? '分享链接已更新/创建！' : '创建失败');
  } catch (_e) {
    ElMessage.error('更新分享链接失败');
  } finally {
    saving.value = false;
  }
};

const handleCancelShare = async () => {
  if (!note.value) return;
  saving.value = true;
  try {
    await api.delete(`/api/notes/${note.value.id}/share`);
    shareConfig.value = null;
    durationType.value = 'permanent';
    customExpiresAt.value = null;
    customText.value = '';
    enableCustomText.value = false;
    ElMessage.success('已取消分享，该链接已失效');
  } catch {
    ElMessage.error('取消分享失败');
  } finally {
    saving.value = false;
  }
};

const copyLink = async () => {
  if (!shareUrl.value || !note.value) return;
  try {
    let copyText = `我分享了笔记《${note.value.title}》，点击链接查看：${shareUrl.value}`;
    if (enableCustomText.value && customText.value.trim()) {
      copyText = `我分享了笔记《${note.value.title}》：“${customText.value.trim()}”，点击链接查看：${shareUrl.value}`;
    }
    await navigator.clipboard.writeText(copyText);
    isCopied.value = true;
    ElMessage.success('已生成分享寄语并复制到剪贴板！');
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch {
    ElMessage.error('复制失败');
  }
};

defineExpose({ open });
</script>

<template>
  <el-dialog
    v-model="visible"
    width="440px"
    destroy-on-close
    class="share-note-dialog"
  >
    <template #header>
      <div class="flex items-center gap-2.5">
        <div class="p-2 bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-base)] rounded-lg">
          <Share2 class="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 class="text-sm font-bold tracking-wide" style="color: var(--text-primary)">
            分享笔记
          </h3>
          <p class="text-[10px] text-[var(--text-muted)] mt-0.5">生成免登录分享链接，可设置有效时长与说明文案</p>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="space-y-4 py-0.5">
      <!-- Note Summary Box -->
      <div v-if="note" class="p-3 bg-slate-50/40 dark:bg-zinc-900/10 rounded-xl border border-[var(--border-base)] flex items-start gap-3 transition-all duration-300">
        <div class="p-2 bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-base)] rounded-lg shrink-0 flex items-center justify-center">
          <Share2 class="w-4 h-4" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse"></span>
            <span class="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">公开分享</span>
          </div>
          <h4 class="text-xs font-bold text-[var(--text-primary)] truncate">{{ note.title }}</h4>
          <p class="text-[9px] text-[var(--text-muted)] mt-0.5">创建于: {{ new Date(note.createdAt).toLocaleString('zh-CN') }}</p>
        </div>
      </div>

      <!-- Share Settings Form -->
      <div class="space-y-3.5">
        <!-- Set Duration -->
        <div class="space-y-1.5">
          <label class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block flex items-center gap-1.5 ml-1">
            <Clock class="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 设置链接有效时长
          </label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="opt in [
                { val: 'permanent', label: '永久有效' },
                { val: '1h', label: '1 小时' },
                { val: '1d', label: '1 天' },
                { val: '7d', label: '7 天' },
                { val: '30d', label: '30 天' },
                { val: 'custom', label: '自定义' }
              ]"
              :key="opt.val"
              type="button"
              class="px-2 py-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer whitespace-nowrap active:scale-95 duration-200"
              :class="[
                durationType === opt.val
                  ? 'bg-accent text-white font-bold border-transparent'
                  : 'bg-white dark:bg-white/5 border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20'
              ]"
              @click="durationType = (opt.val as any)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Custom Expiration Picker -->
        <Transition name="fade">
          <div v-if="durationType === 'custom'" class="pt-1 space-y-1.5">
            <label class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block flex items-center gap-1.5 ml-1">
              <Calendar class="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 选择过期时间
            </label>
            <el-date-picker
              v-model="customExpiresAt"
              type="datetime"
              placeholder="选择具体日期和时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              class="!w-full custom-datepicker"
            />
          </div>
        </Transition>

        <!-- Custom Share Text Toggle & Field -->
        <div class="space-y-2 pt-2.5 border-t border-[var(--border-base)]">
          <div class="flex items-center justify-between">
            <label class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block flex items-center gap-1.5 ml-1">
              <MessageSquare class="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 附带分享留言 / 寄语
            </label>
            <el-switch
              v-model="enableCustomText"
              inline-prompt
              style="--el-switch-on-color: var(--accent);"
            />
          </div>
          
          <Transition name="fade">
            <div v-if="enableCustomText" class="space-y-2 mt-1">
              <el-input
                v-model="customText"
                type="textarea"
                :rows="2"
                placeholder="写下几句分享留言，将渲染在分享页面的顶部..."
                maxlength="200"
                show-word-limit
                class="custom-textarea"
              />
              
              <!-- Shortcut templates -->
              <div class="flex items-center gap-1 pt-0.5 overflow-x-auto whitespace-nowrap shortcut-list">
                <span class="text-[8.5px] text-[var(--text-muted)] select-none flex-shrink-0">快捷留言:</span>
                <button
                  v-for="opt in [
                    { tpl: '💡 强烈推荐收藏，满满的干货分享！', label: '💡 强烈推荐' },
                    { tpl: '📚 精选学习心得，希望能帮到大家。', label: '📚 精选心得' },
                    { tpl: '🎯 今日学习成果复盘，欢迎交流！', label: '🎯 成果复盘' }
                  ]"
                  :key="opt.tpl"
                  type="button"
                  class="px-1.5 py-0.5 text-[8.5px] bg-slate-50 dark:bg-white/5 border border-[var(--border-base)] hover:border-accent hover:text-accent rounded-md transition-all cursor-pointer text-[var(--text-secondary)] flex-shrink-0"
                  @click="customText = opt.tpl"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Current Share Status & URL -->
        <div v-if="shareConfig" class="pt-3 border-t border-[var(--border-base)] space-y-3">
          <!-- Status Banner -->
          <div 
            class="p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors duration-300"
            :class="[
              isExpired
                ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
                : 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            ]"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <div 
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                :class="isExpired ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'"
              >
                <Link class="w-3.5 h-3.5" />
              </div>
              <div class="min-w-0 flex-1">
                <span class="text-[9px] font-black uppercase tracking-wider block opacity-70">当前分享状态</span>
                <span class="text-[11px] font-mono font-medium truncate block mt-0.5">
                  {{ getExpiryText(shareConfig.expiresAt) }}
                </span>
              </div>
            </div>
            <div class="shrink-0 flex items-center gap-1.5">
              <span 
                class="w-2 h-2 rounded-full"
                :class="[isExpired ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse']"
              ></span>
              <span class="text-[10px] font-black uppercase tracking-wider">
                {{ isExpired ? '已过期' : '分享中' }}
              </span>
            </div>
          </div>

          <!-- Share Link Box -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest block ml-1">分享链接</label>
            <div class="relative flex items-center">
              <input
                :value="shareUrl"
                readonly
                type="text"
                class="w-full pl-9 pr-24 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent/25 transition-all select-all"
                style="
                  background-color: var(--bg-subtle);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
              <Link class="w-4 h-4 text-slate-400 absolute left-3" />
              
              <button
                type="button"
                class="absolute right-1 top-1 bottom-1 px-3 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                :class="[
                  isCopied 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-accent hover:bg-accent/90 text-white active:scale-95'
                ]"
                @click="copyLink"
              >
                <component :is="isCopied ? Check : Copy" class="w-3.5 h-3.5" />
                <span>{{ isCopied ? '已复制' : '复制' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer buttons -->
    <template #footer>
      <div class="flex justify-between items-center gap-2 w-full">
        <div>
          <button
            v-if="shareConfig"
            type="button"
            class="px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-red-500 hover:bg-red-500/5 border border-red-500/10 hover:border-red-500/20 flex items-center gap-1 disabled:opacity-50"
            :disabled="saving"
            @click="handleCancelShare"
          >
            <span>取消分享</span>
          </button>
        </div>
        <div class="flex gap-2">
          <button 
            type="button" 
            class="px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-[var(--text-secondary)] border border-[var(--border-base)]"
            @click="visible = false"
          >
            关闭
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
            :disabled="saving"
            @click="handleCreateOrUpdate"
          >
            <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            <span>{{ shareConfig ? '保存设置' : '生成链接' }}</span>
          </button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: all 0.2s ease-in-out;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

:deep(.share-note-dialog) {
  background: var(--bg-card) !important;
  border: 1px solid var(--border-base) !important;
  border-radius: 16px !important;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.08) !important;
}

:deep(.share-note-dialog .el-dialog__header) {
  padding: 16px 20px 12px !important;
  margin-right: 0 !important;
  border-bottom: 1px solid var(--border-base) !important;
}

:deep(.share-note-dialog .el-dialog__header .el-dialog__headerbtn) {
  top: 16px !important;
  right: 20px !important;
  width: 28px !important;
  height: 28px !important;
  border-radius: 8px !important;
  background-color: var(--bg-subtle) !important;
  border: 1px solid var(--border-base) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s !important;
}

:deep(.share-note-dialog .el-dialog__header .el-dialog__headerbtn:hover) {
  background-color: var(--bg-card-hover) !important;
}

:deep(.share-note-dialog .el-dialog__body) {
  padding: 16px 20px !important;
}

:deep(.share-note-dialog .el-dialog__footer) {
  padding: 12px 20px 16px !important;
  border-top: 1px solid var(--border-base) !important;
}

:deep(.custom-datepicker .el-input__wrapper) {
  background-color: var(--bg-subtle) !important;
  border-radius: 8px !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
  padding: 6px 10px !important;
}

:deep(.custom-datepicker .el-input__wrapper.is-focus) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 1px var(--accent) !important;
}

:deep(.custom-textarea .el-textarea__inner) {
  background-color: var(--bg-subtle) !important;
  border-radius: 8px !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
  padding: 8px 12px !important;
  font-family: inherit !important;
  color: var(--text-primary) !important;
  transition: all 0.25s ease !important;
  font-size: 11px !important;
}

:deep(.custom-textarea .el-textarea__inner:focus) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 1px var(--accent) !important;
  background-color: var(--bg-card) !important;
}

:deep(.custom-textarea .el-input__count) {
  background: transparent !important;
  bottom: 6px !important;
  right: 10px !important;
  font-size: 9px !important;
  color: var(--text-muted) !important;
}

.dark :deep(.share-note-dialog) {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4) !important;
}
.shortcut-list::-webkit-scrollbar {
  display: none;
}
.shortcut-list {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

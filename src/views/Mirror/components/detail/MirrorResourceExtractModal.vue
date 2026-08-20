<script setup lang="ts">
import { ref } from 'vue';
import { ExternalLink, Copy, Check, Sparkles, ShieldCheck, Link2, KeyRound } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import { ElMessage } from '@/utils/feedbackBridge';

const props = defineProps<{
  show: boolean;
  activeLink: { name: string; url: string; code?: string; type: string } | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
}>();

const copiedLink = ref(false);
const copiedCode = ref(false);

function copyLink() {
  if (!props.activeLink?.url) return;
  navigator.clipboard.writeText(props.activeLink.url);
  copiedLink.value = true;
  ElMessage.success('下载链接已复制到剪贴板！');
  setTimeout(() => (copiedLink.value = false), 2000);
}

function copyCode() {
  if (!props.activeLink?.code) return;
  navigator.clipboard.writeText(props.activeLink.code);
  copiedCode.value = true;
  ElMessage.success(`提取码 [${props.activeLink.code}] 已复制！`);
  setTimeout(() => (copiedCode.value = false), 2000);
}

function handleJumpToNetdisk() {
  if (!props.activeLink?.url) return;

  if (props.activeLink.code) {
    navigator.clipboard.writeText(props.activeLink.code);
    ElMessage.success(`提取码 [${props.activeLink.code}] 已自动复制！正在为您打开网盘...`);
  } else {
    ElMessage.success('正在为您跳转网盘...');
  }

  window.open(props.activeLink.url, '_blank', 'noopener,noreferrer');
  emit('update:show', false);
}

function getLinkTypeColor(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('baidu') || t.includes('百度')) return 'bg-blue-500';
  if (t.includes('quark') || t.includes('夸克')) return 'bg-amber-500';
  if (t.includes('ali') || t.includes('阿里')) return 'bg-indigo-500';
  return 'bg-emerald-500';
}
</script>

<template>
  <Modal
    :show="show && !!activeLink"
    title="提取网盘资源"
    size="md"
    @close="emit('update:show', false)"
  >
    <div v-if="activeLink" class="space-y-4 py-1">
      <!-- Top Drive Info Card -->
      <div
        class="p-3.5 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-slate-100/50 dark:from-blue-900/30 dark:via-indigo-900/20 dark:to-slate-900/50 border border-blue-500/20 rounded-2xl flex items-center justify-between shadow-inner"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs"
          >
            <Link2 class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div
              class="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 truncate"
            >
              <span>{{ activeLink.name }}</span>
              <span
                class="px-1.5 py-0.2 text-[9px] font-black rounded bg-blue-600 text-white uppercase"
                >{{ activeLink.type }}</span
              >
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              官方高速镜像通道已就绪
            </p>
          </div>
        </div>

        <div
          class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span>有效链接</span>
        </div>
      </div>

      <!-- Download Link Field with High-Contrast Label -->
      <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-800 dark:text-slate-200">
          <span class="flex items-center gap-1">
            <Link2 class="w-3.5 h-3.5 text-blue-500" />
            网盘下载链接
          </span>
        </label>

        <div class="flex gap-2">
          <input
            type="text"
            readonly
            :value="activeLink.url"
            class="flex-1 min-w-0 h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-mono font-medium bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 select-all shadow-inner"
            @click="($event.target as HTMLInputElement).select()"
          />
          <button
            type="button"
            class="h-10 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1.5 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs"
            @click="copyLink"
          >
            <Check v-if="copiedLink" class="w-3.5 h-3.5 text-emerald-500" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedLink ? '已复制' : '复制链接' }}</span>
          </button>
        </div>
      </div>

      <!-- Passcode Field (Highlighted Card) -->
      <div v-if="activeLink.code" class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-800 dark:text-slate-200">
          <span class="flex items-center gap-1">
            <KeyRound class="w-3.5 h-3.5 text-rose-500" />
            提取密码 / 访问码
          </span>
        </label>

        <div class="flex gap-2">
          <input
            type="text"
            readonly
            :value="activeLink.code"
            class="flex-1 min-w-0 h-10 px-4 text-base font-black font-mono tracking-widest text-center rounded-xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 focus:outline-none select-all shadow-inner"
            @click="($event.target as HTMLInputElement).select()"
          />
          <button
            type="button"
            class="h-10 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 font-black text-xs transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1.5 border border-rose-500/25 shadow-2xs"
            @click="copyCode"
          >
            <Check v-if="copiedCode" class="w-3.5 h-3.5 text-emerald-500" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedCode ? '已复制' : '复制密码' }}</span>
          </button>
        </div>
      </div>

      <!-- Helpful Smart Tip -->
      <div
        class="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center gap-2 text-[11px] text-blue-700 dark:text-blue-300"
      >
        <Sparkles class="w-3.5 h-3.5 shrink-0 text-blue-500" />
        <span
          >提示：点击下方<strong>「立即跳转网盘」</strong>会自动将提取码复制到剪贴板，进入网盘直接粘贴即可！</span
        >
      </div>
    </div>

    <!-- Action Buttons Footer -->
    <template v-if="activeLink" #footer>
      <div class="w-full flex items-center gap-3">
        <button
          type="button"
          class="flex-1 h-10.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer active:scale-98 whitespace-nowrap flex items-center justify-center shadow-2xs"
          @click="emit('update:show', false)"
        >
          关闭
        </button>

        <button
          type="button"
          class="flex-2 h-10.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-black text-center flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/25 active:scale-98 whitespace-nowrap cursor-pointer"
          @click="handleJumpToNetdisk"
        >
          <ExternalLink class="w-4 h-4 shrink-0" />
          <span>立即跳转网盘 (自动复制提取码)</span>
        </button>
      </div>
    </template>
  </Modal>
</template>

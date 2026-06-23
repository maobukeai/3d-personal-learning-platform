/* eslint-disable vue/no-v-html */
<script setup lang="ts">
import {
  KeyRound,
  Pin,
  PinOff,
  QrCode,
  Edit,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Github,
  Chrome,
  Lock,
  Cpu,
  TrendingUp,
  Globe,
  Briefcase,
  ShieldCheck,
  Sparkles,
} from 'lucide-vue-next';
import type { TwoFactorAccount } from '@/types';

interface LiveTotp {
  code: string;
  timeLeft: number;
}

interface BrandInfo {
  name: string;
  gradient: string;
  text: string;
  accentColor: string;
  tagBg: string;
  icon: string;
}

const props = defineProps<{
  accounts: TwoFactorAccount[];
  liveCodes: Record<string, LiveTotp>;
  pinnedAccountIds: string[];
  revealedSecrets: Record<string, boolean>;
  copiedStates: Record<string, boolean>;
  isPrivacyMode: boolean;
  searchQuery: string;
}>();

const emit = defineEmits<{
  (e: 'pin', id: string): void;
  (e: 'qr', acc: TwoFactorAccount): void;
  (e: 'edit', acc: TwoFactorAccount): void;
  (e: 'delete', acc: TwoFactorAccount): void;
  (e: 'copyCode', id: string): void;
  (e: 'copySecret', secret: string, id: string): void;
  (e: 'toggleSecret', id: string): void;
  (e: 'dragstart', event: DragEvent, acc: TwoFactorAccount): void;
  (e: 'dragend'): void;
}>();

function getBrandInfo(label: string, email?: string | null): BrandInfo {
  const name = (label + ' ' + (email || '')).toLowerCase();

  if (name.includes('github')) {
    return {
      name: 'GitHub',
      gradient: 'from-zinc-900 via-neutral-900 to-zinc-950 border-neutral-700/60',
      text: 'text-slate-200',
      accentColor: '#24292f',
      tagBg: 'bg-white/10 text-white border-white/5',
      icon: 'Github',
    };
  }
  if (name.includes('google') || name.includes('gmail') || name.includes('chrome')) {
    return {
      name: 'Google',
      gradient: 'from-rose-500/10 via-amber-500/5 to-blue-500/10 border-rose-500/20',
      text: 'text-rose-400',
      accentColor: '#ea4335',
      tagBg: 'bg-rose-500/15 text-rose-400 border-rose-500/10',
      icon: 'Chrome',
    };
  }
  if (
    name.includes('microsoft') ||
    name.includes('outlook') ||
    name.includes('azure') ||
    name.includes('office')
  ) {
    return {
      name: 'Microsoft',
      gradient: 'from-blue-600/10 via-indigo-600/5 to-transparent border-blue-500/20',
      text: 'text-blue-400',
      accentColor: '#00a4ef',
      tagBg: 'bg-blue-500/15 text-blue-400 border-blue-500/10',
      icon: 'Lock',
    };
  }
  if (name.includes('aws') || name.includes('amazon')) {
    return {
      name: 'Amazon AWS',
      gradient: 'from-amber-600/15 via-orange-500/10 to-transparent border-amber-500/20',
      text: 'text-amber-500',
      accentColor: '#ff9900',
      tagBg: 'bg-amber-500/15 text-amber-500 border-amber-500/10',
      icon: 'Cpu',
    };
  }
  if (name.includes('openai') || name.includes('chatgpt')) {
    return {
      name: 'OpenAI',
      gradient: 'from-emerald-600/15 via-teal-500/10 to-transparent border-emerald-500/20',
      text: 'text-emerald-400',
      accentColor: '#10a37f',
      tagBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/10',
      icon: 'Sparkles',
    };
  }
  if (name.includes('apple') || name.includes('icloud')) {
    return {
      name: 'Apple',
      gradient: 'from-neutral-200/10 to-neutral-400/5 border-neutral-700/60',
      text: 'text-neutral-300',
      accentColor: '#a3a3a3',
      tagBg: 'bg-white/10 text-neutral-300 border-white/5',
      icon: 'ShieldCheck',
    };
  }
  if (name.includes('steam')) {
    return {
      name: 'Steam',
      gradient: 'from-cyan-900/20 via-sky-800/10 to-slate-900/5 border-cyan-500/20',
      text: 'text-cyan-400',
      accentColor: '#171a21',
      tagBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/10',
      icon: 'Lock',
    };
  }
  if (
    name.includes('binance') ||
    name.includes('crypto') ||
    name.includes('okx') ||
    name.includes('coinbase') ||
    name.includes('wallet') ||
    name.includes('metamask')
  ) {
    return {
      name: 'Crypto',
      gradient: 'from-yellow-600/15 via-amber-500/10 to-transparent border-yellow-500/20',
      text: 'text-yellow-400',
      accentColor: '#f3ba2f',
      tagBg: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/10',
      icon: 'TrendingUp',
    };
  }
  if (name.includes('facebook') || name.includes('meta') || name.includes('instagram')) {
    return {
      name: 'Meta',
      gradient: 'from-blue-600/15 via-sky-500/10 to-transparent border-blue-500/20',
      text: 'text-blue-400',
      accentColor: '#0668e1',
      tagBg: 'bg-blue-500/15 text-blue-400 border-blue-500/10',
      icon: 'Globe',
    };
  }

  // Fallback custom color based on first char code
  const charCode = label.charCodeAt(0) || 65;
  const hue = (charCode * 23) % 360;
  return {
    name: 'Generic',
    gradient: `from-hsl(${hue},45%,15%)/15 via-hsl(${hue},30%,8%)/10 to-transparent border-slate-700/60`,
    text: `text-slate-300`,
    accentColor: `hsl(${hue},50%,50%)`,
    tagBg: `bg-slate-800 text-slate-400 border-slate-700/40`,
    icon: 'KeyRound',
  };
}

function getBrandIconComponent(acc: TwoFactorAccount) {
  const brand = getBrandInfo(acc.label, acc.email);
  switch (brand.icon) {
    case 'Github':
      return Github;
    case 'Chrome':
      return Chrome;
    case 'Lock':
      return Lock;
    case 'Cpu':
      return Cpu;
    case 'TrendingUp':
      return TrendingUp;
    case 'Globe':
      return Globe;
    case 'Briefcase':
      return Briefcase;
    case 'ShieldCheck':
      return ShieldCheck;
    case 'Sparkles':
      return Sparkles;
    default:
      return KeyRound;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightText(text: string | null, query: string): string {
  if (!text) return '';
  const escapedText = escapeHtml(text);
  if (!query) return escapedText;

  const escapedQuery = query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escapedText.replace(
    regex,
    '<mark class="bg-violet-500/35 text-white rounded px-0.5 font-semibold">$1</mark>',
  );
}
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
    <div
      v-for="acc in accounts"
      :key="acc.id"
      draggable="true"
      class="acc-card rounded-xl p-3 border transition-all duration-300 flex flex-col justify-between shadow-sm group/item relative overflow-hidden cursor-grab active:cursor-grabbing"
      :class="{
        'animate-border-pulse border-rose-500/50 shadow-rose-950/20':
          liveCodes[acc.id]?.timeLeft <= 5,
      }"
      :style="{
        backgroundColor: 'var(--bg-card)',
        borderColor: pinnedAccountIds.includes(acc.id)
          ? 'var(--accent, #6366f1)'
          : liveCodes[acc.id]?.timeLeft <= 5
            ? '#f43f5e'
            : 'var(--border-base)',
        boxShadow: pinnedAccountIds.includes(acc.id)
          ? '0 2px 8px rgba(99, 102, 241, 0.12)'
          : 'none',
      }"
      @dragstart="emit('dragstart', $event, acc)"
      @dragend="emit('dragend')"
    >
      <!-- Background light effect -->
      <div
        class="absolute -right-16 -top-16 w-32 h-32 rounded-full blur-3xl group-hover/item:bg-indigo-500/10 transition-all duration-500 pointer-events-none"
        style="background-color: rgba(99, 102, 241, 0.02)"
      ></div>

      <div class="flex flex-col gap-2">
        <!-- Header: Label & Email & Category tag -->
        <div class="flex justify-between items-start gap-1.5">
          <!-- Avatar or Dynamic Brand Logo icon -->
          <div
            class="w-6.5 h-6.5 rounded-lg shrink-0 flex items-center justify-center border text-[10px] font-bold bg-gradient-to-br"
            :class="[
              getBrandInfo(acc.label, acc.email).gradient,
              getBrandInfo(acc.label, acc.email).text,
            ]"
          >
            <component :is="getBrandIconComponent(acc)" class="h-3.5 w-3.5" />
          </div>

          <div class="min-w-0 flex-1 ml-0.5">
            <h3
              class="text-xs font-bold truncate flex items-center gap-1"
              :title="acc.label"
              style="color: var(--text-primary)"
            >
              <span v-html="highlightText(acc.label, searchQuery)"></span>
              <span
                v-if="acc.category"
                class="text-[7.5px] font-black uppercase tracking-wider px-1 py-0.25 rounded shrink-0"
                :class="getBrandInfo(acc.label, acc.email).tagBg"
              >
                {{ acc.category }}
              </span>
            </h3>
            <p
              class="text-[9px] truncate mt-0.25"
              :title="acc.email || ''"
              style="color: var(--text-secondary)"
            >
              <span v-html="highlightText(acc.email || '未绑定账号', searchQuery)"></span>
            </p>
          </div>

          <!-- Hover Actions -->
          <div
            class="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity duration-200"
          >
            <button
              class="p-0.5 rounded transition-colors cursor-pointer bg-transparent border-none text-slate-500 hover:text-amber-400"
              :class="pinnedAccountIds.includes(acc.id) ? '!text-amber-400 !opacity-100' : ''"
              :title="pinnedAccountIds.includes(acc.id) ? '取消置顶' : '置顶'"
              @click="emit('pin', acc.id)"
            >
              <Pin v-if="pinnedAccountIds.includes(acc.id)" class="h-3 w-3 fill-amber-400" />
              <PinOff v-else class="h-3 w-3" />
            </button>
            <button
              class="p-0.5 text-slate-500 hover:text-indigo-400 rounded transition-colors cursor-pointer bg-transparent border-none"
              title="二维码"
              @click="emit('qr', acc)"
            >
              <QrCode class="h-3 w-3" />
            </button>
            <button
              class="p-0.5 text-slate-500 hover:text-amber-400 rounded transition-colors cursor-pointer bg-transparent border-none"
              title="编辑"
              @click="emit('edit', acc)"
            >
              <Edit class="h-3 w-3" />
            </button>
            <button
              class="p-0.5 text-slate-500 hover:text-rose-500 rounded transition-colors cursor-pointer bg-transparent border-none"
              title="删除"
              @click="emit('delete', acc)"
            >
              <Trash2 class="h-3 w-3" />
            </button>
          </div>
        </div>

        <!-- OTP Code Display (with Privacy Blur option) -->
        <div
          class="code-box border rounded-lg p-1.5 px-2 flex items-center justify-between gap-1.5"
          style="background-color: var(--bg-app); border-color: var(--border-base)"
        >
          <div class="flex flex-col min-w-0 w-full">
            <div class="flex items-center gap-1">
              <span class="text-[8px] font-bold tracking-wider uppercase text-slate-500"
                >动态码</span
              >
              <span
                v-if="copiedStates[acc.id]"
                class="text-[8px] text-emerald-400 font-bold bg-emerald-500/10 px-0.5 rounded animate-pulse"
                >已复制</span
              >
            </div>
            <div
              class="text-base font-extrabold tracking-widest font-mono cursor-pointer select-all transition-colors flex items-center gap-1.5 hover:text-indigo-400"
              style="color: var(--accent, #6366f1)"
              :class="{
                'blur-[5px] hover:blur-none transition-all duration-300': isPrivacyMode,
              }"
              @click="emit('copyCode', acc.id)"
            >
              <span class="truncate">
                {{
                  liveCodes[acc.id]
                    ? liveCodes[acc.id].code.slice(0, 3) + ' ' + liveCodes[acc.id].code.slice(3)
                    : '------'
                }}
              </span>
              <Copy
                class="h-3 w-3 text-slate-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
              />
            </div>
          </div>

          <!-- SVG Progress Ring -->
          <div class="flex items-center justify-center relative shrink-0">
            <svg class="w-6 h-6 transform -rotate-90">
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="rgba(71, 85, 105, 0.15)"
                stroke-width="2"
                fill="transparent"
              />
              <circle
                cx="12"
                cy="12"
                r="9"
                :stroke="liveCodes[acc.id]?.timeLeft <= 5 ? '#ef4444' : 'var(--accent, #6366f1)'"
                stroke-width="2"
                fill="transparent"
                :stroke-dasharray="2 * Math.PI * 9"
                :stroke-dashoffset="
                  2 * Math.PI * 9 * (1 - (liveCodes[acc.id]?.timeLeft || 30) / 30)
                "
                class="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span
              class="absolute text-[7px] font-bold font-mono"
              :class="
                liveCodes[acc.id]?.timeLeft <= 5 ? 'text-rose-500 animate-pulse' : 'text-slate-400'
              "
            >
              {{ liveCodes[acc.id]?.timeLeft ?? 30 }}
            </span>
          </div>
        </div>
      </div>

      <!-- Secret Key & Notes -->
      <div
        class="border-t pt-1.5 mt-2 flex flex-col gap-1"
        style="border-color: var(--border-base)"
      >
        <div
          class="flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded border"
          style="background-color: var(--bg-app); border-color: var(--border-base)"
        >
          <span
            class="font-mono flex items-center gap-1 truncate max-w-[70%]"
            style="color: var(--text-secondary)"
          >
            <KeyRound class="h-2.5 w-2.5 shrink-0" style="color: var(--accent, #6366f1)" />
            <span
              class="truncate"
              :class="{
                'blur-[4px] hover:blur-none transition-all duration-300': isPrivacyMode,
              }"
            >
              {{ revealedSecrets[acc.id] ? acc.secret : '••••••••••••' }}
            </span>
          </span>
          <div class="flex items-center gap-0.5 shrink-0">
            <button
              class="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer border-none bg-transparent p-0.5"
              title="隐藏/显示"
              @click="emit('toggleSecret', acc.id)"
            >
              <EyeOff v-if="revealedSecrets[acc.id]" class="h-3 w-3" />
              <Eye v-else class="h-3 w-3" />
            </button>
            <button
              class="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer border-none bg-transparent p-0.5"
              title="复制"
              @click="emit('copySecret', acc.secret, acc.id)"
            >
              <Copy class="h-3 w-3" />
            </button>
          </div>
        </div>

        <!-- Notes -->
        <div
          v-if="acc.note"
          class="flex items-center gap-1 text-[9px] px-0.5"
          style="color: var(--text-secondary)"
        >
          <FileText class="h-2.5 w-2.5 shrink-0 text-slate-500" />
          <span class="truncate text-slate-500" :title="acc.note">
            <span v-html="highlightText(acc.note, searchQuery)"></span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

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

defineProps<{
  accounts: TwoFactorAccount[];
  liveCodes: Record<string, LiveTotp>;
  pinnedAccountIds: string[];
  revealedSecrets: Record<string, boolean>;
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
  <div class="flex flex-col gap-2">
    <!-- List Header -->
    <div
      class="hidden lg:flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 border-b"
      style="border-color: var(--border-base)"
    >
      <div class="w-[260px]">账号信息</div>
      <div class="w-[180px]">双重验证动态码</div>
      <div class="w-[220px]">安全密钥</div>
      <div class="flex-1 px-2">备注说明</div>
      <div class="w-[110px] text-right">操作</div>
    </div>

    <!-- List Items -->
    <div
      v-for="acc in accounts"
      :key="acc.id"
      draggable="true"
      class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 px-4 border rounded-xl hover:shadow-md transition-all duration-300 relative overflow-hidden group/listitem cursor-grab active:cursor-grabbing"
      :class="{ 'border-rose-500/40 shadow-rose-950/10': liveCodes[acc.id]?.timeLeft <= 5 }"
      :style="{
        backgroundColor: 'var(--bg-card)',
        borderColor: pinnedAccountIds.includes(acc.id)
          ? 'var(--accent, #6366f1)'
          : liveCodes[acc.id]?.timeLeft <= 5
            ? '#f43f5e'
            : 'var(--border-base)',
        boxShadow: pinnedAccountIds.includes(acc.id)
          ? '0 2px 8px rgba(99, 102, 241, 0.08)'
          : 'none',
      }"
      @dragstart="emit('dragstart', $event, acc)"
      @dragend="emit('dragend')"
    >
      <!-- Column 1: Info (Label / User Email / Category tag) -->
      <div class="flex items-center gap-3 w-full lg:w-[260px] shrink-0 min-w-0">
        <button
          class="p-1 rounded transition-colors cursor-pointer bg-transparent border-none text-slate-500 hover:text-slate-300 shrink-0"
          :title="pinnedAccountIds.includes(acc.id) ? '取消置顶' : '置顶'"
          @click="emit('pin', acc.id)"
        >
          <Pin
            v-if="pinnedAccountIds.includes(acc.id)"
            class="h-4 w-4 fill-amber-400 text-amber-400"
          />
          <PinOff v-else class="h-4 w-4" />
        </button>

        <!-- Brand Icon representation -->
        <div
          class="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border text-sm font-bold bg-gradient-to-br"
          :class="[
            getBrandInfo(acc.label, acc.email).gradient,
            getBrandInfo(acc.label, acc.email).text,
          ]"
        >
          <component :is="getBrandIconComponent(acc)" class="h-4 w-4" />
        </div>

        <div class="min-w-0">
          <h4
            class="text-sm font-bold truncate flex items-center gap-1.5"
            :title="acc.label"
            style="color: var(--text-primary)"
          >
            <span v-html="highlightText(acc.label, searchQuery)"></span>
            <span
              v-if="acc.category"
              class="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
              :class="getBrandInfo(acc.label, acc.email).tagBg"
            >
              {{ acc.category }}
            </span>
          </h4>
          <p
            class="text-[11px] truncate mt-0.5"
            :title="acc.email || ''"
            style="color: var(--text-secondary)"
          >
            <span v-html="highlightText(acc.email || '未绑定邮箱/账号', searchQuery)"></span>
          </p>
        </div>
      </div>

      <!-- Column 2: Dynamic Code & Countdown (with Privacy Blur) -->
      <div class="flex items-center gap-3 w-full lg:w-[180px] shrink-0">
        <div
          class="border rounded-lg px-3 py-1.5 flex items-center justify-between gap-2.5 w-full"
          style="background-color: var(--bg-app); border-color: var(--border-base)"
        >
          <div
            class="flex items-center gap-2 cursor-pointer w-full"
            @click="emit('copyCode', acc.id)"
          >
            <span
              class="text-base font-extrabold font-mono tracking-wider"
              style="color: var(--accent, #6366f1)"
              :class="{
                'blur-[5px] hover:blur-none transition-all duration-300': isPrivacyMode,
              }"
            >
              {{
                liveCodes[acc.id]
                  ? liveCodes[acc.id].code.slice(0, 3) + ' ' + liveCodes[acc.id].code.slice(3)
                  : '------'
              }}
            </span>
            <Copy
              class="h-3 w-3 text-slate-500 opacity-0 group-hover/listitem:opacity-100 transition-opacity ml-auto"
            />
          </div>

          <!-- SVG Progress Ring (Very Small) -->
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

      <!-- Column 3: Secret Key (with Privacy Blur) -->
      <div
        class="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border w-full lg:w-[220px] shrink-0"
        style="background-color: var(--bg-app); border-color: var(--border-base)"
      >
        <span
          class="font-mono truncate"
          style="color: var(--text-secondary); max-width: 130px"
          :class="{ 'blur-[4px] hover:blur-none transition-all duration-300': isPrivacyMode }"
        >
          {{ revealedSecrets[acc.id] ? acc.secret : '••••••••••••••••' }}
        </span>
        <div class="flex items-center gap-1.5 shrink-0 ml-1">
          <button
            class="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer border-none bg-transparent"
            @click="emit('toggleSecret', acc.id)"
          >
            <EyeOff v-if="revealedSecrets[acc.id]" class="h-3.5 w-3.5" />
            <Eye v-else class="h-3.5 w-3.5" />
          </button>
          <button
            class="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer border-none bg-transparent"
            @click="emit('copySecret', acc.secret, acc.id)"
          >
            <Copy class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <!-- Column 4: Notes/Remark -->
      <div class="flex items-center gap-1.5 text-xs min-w-0 w-full lg:w-auto flex-1 px-1 lg:px-2">
        <FileText v-if="acc.note" class="h-3.5 w-3.5 text-slate-500 shrink-0" />
        <span class="truncate text-slate-400 italic" :title="acc.note || ''">
          <span v-if="acc.note" v-html="highlightText(acc.note, searchQuery)"></span>
          <span v-else>—</span>
        </span>
      </div>

      <!-- Column 5: Action Buttons -->
      <div class="flex items-center gap-0.5 shrink-0 ml-auto lg:ml-0">
        <button
          class="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
          title="手机扫码添加"
          @click="emit('qr', acc)"
        >
          <QrCode class="h-4 w-4" />
        </button>
        <button
          class="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
          title="编辑"
          @click="emit('edit', acc)"
        >
          <Edit class="h-4 w-4" />
        </button>
        <button
          class="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
          title="删除"
          @click="emit('delete', acc)"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>

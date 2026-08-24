<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import {
  Globe,
  Cloud,
  Link,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Server,
  Zap,
  Upload,
  Plus,
  Layers,
  ChevronDown,
} from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import api, { getAssetUrl } from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import { getApiErrorMessage, logError } from '@/utils/error';
import type { MirrorSource } from '../AdminMirrorView.vue';

const props = defineProps<{
  show: boolean;
  source: MirrorSource | null;
  sources?: MirrorSource[];
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (e: 'update:source', source: MirrorSource): void;
  (e: 'saved'): void;
}>();

const isLoading = ref(false);
const isSaving = ref(false);
const isSyncingDns = ref(false);
const isUploadingLogo = ref(false);
const hasCloudflareToken = ref(false);
const availableZones = ref<Array<{ id: string; name: string }>>([]);

const currentSourceId = ref<string>('');

const form = ref({
  proxyEnabled: false,
  customSlug: '',
  customDomain: '',
  brandName: '',
  brandSubtitle: '',
  brandLogoUrl: '',
  serverIp: '',
  cloudflareProxied: true,
  cloudflareZoneId: '',
  cloudflareDnsRecordId: '',
  lastDnsSyncAt: '',
});

// Subdomain prefix input logic
const subdomainPrefix = ref('');
const selectedZone = ref('');
const isCustomZone = ref(false);
const customZoneInput = ref('');

const currentSource = computed(() => {
  if (props.sources && currentSourceId.value) {
    const found = props.sources.find((s) => s.id === currentSourceId.value);
    if (found) return found;
  }
  return props.source;
});

const currentOrigin = computed(() => {
  return typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com';
});

const previewPortalUrl = computed(() => {
  if (form.value.customSlug.trim()) {
    return `${currentOrigin.value}/portal/${form.value.customSlug.trim()}`;
  }
  if (currentSource.value?.id) {
    return `${currentOrigin.value}/portal/mirror/${currentSource.value.id}`;
  }
  return `${currentOrigin.value}/portal`;
});

// Active full domain computation
const activeFullDomain = computed(() => {
  const prefix = subdomainPrefix.value.trim().toLowerCase();
  if (!prefix) return form.value.customDomain.trim();

  // If user typed a full domain with dot in prefix input
  if (prefix.includes('.')) {
    return prefix;
  }

  const zone = isCustomZone.value
    ? customZoneInput.value.trim()
    : selectedZone.value.trim() || availableZones.value[0]?.name || '';

  if (zone) {
    return `${prefix}.${zone.replace(/^\./, '')}`;
  }
  return prefix;
});

// Watch subdomain inputs and sync to form.customDomain
watch([subdomainPrefix, selectedZone, customZoneInput, isCustomZone], () => {
  if (subdomainPrefix.value.trim()) {
    form.value.customDomain = activeFullDomain.value;
  }
});

function initFormFromSource(src: any) {
  if (!src) return;
  let cfg: any = {};
  if (src.syncConfig) {
    try {
      const parsed =
        typeof src.syncConfig === 'string' ? JSON.parse(src.syncConfig) : src.syncConfig;
      cfg = parsed.proxyConfig || {};
    } catch {}
  }

  form.value = {
    proxyEnabled: Boolean(cfg.proxyEnabled),
    customSlug: cfg.customSlug || '',
    customDomain: cfg.customDomain || '',
    brandName: cfg.brandName || src.displayName || '',
    brandSubtitle: cfg.brandSubtitle || '',
    brandLogoUrl: cfg.brandLogoUrl || src.iconUrl || '',
    serverIp: cfg.serverIp || '',
    cloudflareProxied: cfg.cloudflareProxied !== false,
    cloudflareZoneId: cfg.cloudflareZoneId || '',
    cloudflareDnsRecordId: cfg.cloudflareDnsRecordId || '',
    lastDnsSyncAt: cfg.lastDnsSyncAt || '',
  };

  if (cfg.customDomain) {
    const primaryDomain = cfg.customDomain.split(/[,，\s]+/)[0] || '';
    subdomainPrefix.value = primaryDomain;
  }
}

function handleSourceSwitch(sourceId: string) {
  currentSourceId.value = sourceId;
  const newSrc = props.sources?.find((s) => s.id === sourceId);
  if (newSrc) {
    emit('update:source', newSrc);
    initFormFromSource(newSrc);
  }
  loadProxyConfig(sourceId);
}

async function handleLogoUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    return ElMessage.warning('图标图片不能超过 5MB');
  }
  isUploadingLogo.value = true;
  try {
    const fd = new FormData();
    fd.append('mirror_image', file);
    const { data } = await api.post('/api/admin/mirror/upload', fd);
    form.value.brandLogoUrl = data.url;
    ElMessage.success('Logo 图标上传成功！');
  } catch (err) {
    ElMessage.error(getApiErrorMessage(err, '图标上传失败'));
  } finally {
    isUploadingLogo.value = false;
    target.value = '';
  }
}

async function loadProxyConfig(sourceIdToLoad?: string) {
  const targetId = sourceIdToLoad || currentSource.value?.id;
  if (!targetId) return;
  try {
    const res = await api.get(`/api/admin/mirror/sources/${targetId}/proxy-config`);
    const cfg = res.data?.proxyConfig || {};
    hasCloudflareToken.value = Boolean(res.data?.hasCloudflareToken);
    availableZones.value = res.data?.availableZones || [];

    if (availableZones.value.length > 0 && !selectedZone.value) {
      selectedZone.value = availableZones.value[0].name;
    }

    // 平滑同步云端字段
    if (cfg.proxyEnabled !== undefined) form.value.proxyEnabled = Boolean(cfg.proxyEnabled);
    if (cfg.customSlug !== undefined) form.value.customSlug = cfg.customSlug;
    if (cfg.customDomain !== undefined) form.value.customDomain = cfg.customDomain;
    if (cfg.brandName) form.value.brandName = cfg.brandName;
    if (cfg.brandSubtitle !== undefined) form.value.brandSubtitle = cfg.brandSubtitle;
    if (cfg.brandLogoUrl) form.value.brandLogoUrl = cfg.brandLogoUrl;
    if (cfg.serverIp) form.value.serverIp = cfg.serverIp;
    if (cfg.cloudflareProxied !== undefined)
      form.value.cloudflareProxied = cfg.cloudflareProxied !== false;
    if (cfg.cloudflareZoneId) form.value.cloudflareZoneId = cfg.cloudflareZoneId;
    if (cfg.cloudflareDnsRecordId) form.value.cloudflareDnsRecordId = cfg.cloudflareDnsRecordId;
    if (cfg.lastDnsSyncAt) form.value.lastDnsSyncAt = cfg.lastDnsSyncAt;

    // Extract prefix if domain exists
    if (form.value.customDomain) {
      const primaryDomain = form.value.customDomain.split(/[,，\s]+/)[0] || '';
      const matchedZone = availableZones.value.find(
        (z) => primaryDomain === z.name || primaryDomain.endsWith('.' + z.name),
      );
      if (matchedZone) {
        selectedZone.value = matchedZone.name;
        isCustomZone.value = false;
        subdomainPrefix.value = primaryDomain.replace('.' + matchedZone.name, '');
      } else {
        subdomainPrefix.value = primaryDomain;
      }
    }
  } catch (error) {
    logError(error, { operation: 'admin.loadProxyConfig', component: 'MirrorProxyConfigDialog' });
  }
}

async function handleSave() {
  const targetId = currentSource.value?.id;
  if (!targetId) return;
  isSaving.value = true;

  // Make sure full domain is written
  if (subdomainPrefix.value.trim() && !form.value.customDomain.trim()) {
    form.value.customDomain = activeFullDomain.value;
  }

  try {
    await api.post(`/api/admin/mirror/sources/${targetId}/proxy-config`, form.value);
    ElMessage.success(`🎉「${currentSource.value?.displayName}」代理站配置保存成功！`);
    emit('saved');
    emit('update:show', false);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存代理站配置失败'));
  } finally {
    isSaving.value = false;
  }
}

async function handleSyncCloudflareDns() {
  const targetId = currentSource.value?.id;
  if (!targetId) return;

  const domainToSync = activeFullDomain.value.trim() || form.value.customDomain.trim();
  if (!domainToSync) {
    ElMessage.warning('请先输入子域名前缀（如: zy）或完整二级域名');
    return;
  }

  isSyncingDns.value = true;
  try {
    const res = await api.post(`/api/admin/mirror/sources/${targetId}/cloudflare-dns`, {
      customDomain: domainToSync,
      serverIp: form.value.serverIp.trim() || undefined,
      proxied: form.value.cloudflareProxied,
    });
    ElMessage.success(res.data?.message || 'DNS 解析成功同步至 Cloudflare！');
    if (res.data?.proxyConfig) {
      form.value.cloudflareDnsRecordId = res.data.proxyConfig.cloudflareDnsRecordId;
      form.value.lastDnsSyncAt = res.data.proxyConfig.lastDnsSyncAt;
      form.value.customDomain = res.data.proxyConfig.customDomain;
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, 'Cloudflare DNS 解析失败'));
  } finally {
    isSyncingDns.value = false;
  }
}

function copyToClipboard(text: string, msg: string = '已复制到剪贴板') {
  navigator.clipboard.writeText(text);
  ElMessage.success(msg);
}

const nginxSnippet = computed(() => {
  const domain = activeFullDomain.value || form.value.customDomain.trim() || 'zy.yourdomain.com';
  return `server {
    listen 80;
    server_name ${domain};

    root /var/www/3d-lms/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;
});

watch(
  () => [props.show, props.source?.id],
  ([show, sourceId]) => {
    if (show && sourceId) {
      currentSourceId.value = sourceId as string;
      const targetSrc =
        (props.sources && props.sources.find((s) => s.id === sourceId)) || props.source;
      if (targetSrc) {
        initFormFromSource(targetSrc);
      }
      loadProxyConfig(sourceId as string);
    }
  },
  { immediate: true },
);
</script>

<template>
  <Modal
    :show="show"
    title="独立代理门户站与域名配置"
    size="lg"
    @close="emit('update:show', false)"
  >
    <div class="space-y-4">
      <!-- 🌟 多镜像源站点即时切换栏 -->
      <div
        v-if="sources && sources.length > 1"
        class="flex items-center justify-between p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
      >
        <div class="flex items-center gap-2">
          <Layers class="w-4 h-4 text-blue-500" />
          <span class="text-xs font-bold text-slate-700 dark:text-slate-200">配置目标镜像源：</span>
        </div>
        <div class="relative min-w-[220px]">
          <select
            :value="currentSourceId"
            class="w-full pl-3 pr-8 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer appearance-none"
            @change="handleSourceSwitch(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="src in sources" :key="src.id" :value="src.id">
              {{ src.displayName }} ({{ src.status === 'ACTIVE' ? '已启用' : '暂停' }})
            </option>
          </select>
          <ChevronDown
            class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
        </div>
      </div>

      <!-- 代理模式总开关 -->
      <div
        class="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-200/60 dark:border-blue-500/20"
      >
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <Globe class="w-4 h-4 text-blue-500" />
            <h4 class="text-sm font-bold text-slate-900 dark:text-white">
              启用独立代理站门户模式 (Standalone Portal)
            </h4>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            开启后，该镜像站可作为独立站点展示，无主站多余菜单，全套会员充值与账号自动互通。
          </p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input v-model="form.proxyEnabled" type="checkbox" class="sr-only peer" />
          <div
            class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
          ></div>
        </label>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 专属路径 Slug -->
        <div
          class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-3"
        >
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
            ① 专属访问路径 (Slug / Alias)
          </label>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400">/portal/</span>
            <input
              v-model="form.customSlug"
              type="text"
              placeholder="例如: zy 或 zycku"
              class="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none font-mono"
            />
          </div>
          <div
            class="flex items-center justify-between text-[11px] text-slate-500 bg-white dark:bg-slate-900/50 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/50"
          >
            <span class="truncate mr-2 font-mono">{{ previewPortalUrl }}</span>
            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                class="p-1 hover:text-blue-500 cursor-pointer"
                title="复制链接"
                @click="copyToClipboard(previewPortalUrl)"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
              <a
                :href="previewPortalUrl"
                target="_blank"
                class="p-1 hover:text-blue-500 cursor-pointer"
                title="打开预览"
              >
                <ExternalLink class="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        <!-- 品牌与标题定制 -->
        <div
          class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-3"
        >
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
            ② 代理站品牌个性化展示与专属 Logo
          </label>
          <div class="flex items-center gap-3">
            <div
              class="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-600 shrink-0"
            >
              <img
                v-if="form.brandLogoUrl"
                :src="getAssetUrl(form.brandLogoUrl)"
                alt="Logo"
                class="w-full h-full object-cover"
              />
              <Globe v-else class="w-6 h-6 text-slate-400" />
            </div>
            <div class="flex-1 min-w-0 space-y-1">
              <label
                class="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
              >
                <Loader2 v-if="isUploadingLogo" class="w-3.5 h-3.5 animate-spin text-blue-500" />
                <Upload v-else class="w-3.5 h-3.5 text-blue-500" />
                <span>{{ isUploadingLogo ? '上传中...' : '更换 Logo 图标' }}</span>
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  :disabled="isUploadingLogo"
                  @change="handleLogoUpload"
                />
              </label>
              <p class="text-[10px] text-slate-400">支持 PNG/JPG/SVG/WEBP (≤5MB)</p>
            </div>
          </div>
          <input
            v-model="form.brandName"
            type="text"
            placeholder="代理站展示名称 (如: 资源酷 · 3D海量素材库)"
            class="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
          />
          <input
            v-model="form.brandSubtitle"
            type="text"
            placeholder="副标题标语 (如: 高速海量数字资源库)"
            class="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
          />
        </div>
      </div>

      <!-- 🌟 Cloudflare 二级域名智能前缀与一键 DNS 解析 -->
      <div
        class="p-4 rounded-2xl bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-transparent border border-amber-200/60 dark:border-amber-500/20 space-y-3.5"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Cloud class="w-4 h-4 text-orange-500" />
            <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">
              ③ 二级域名绑定与 Cloudflare DNS 一键解析联动
            </h4>
          </div>
          <span
            v-if="hasCloudflareToken"
            class="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold"
          >
            <CheckCircle2 class="w-3 h-3" /> Cloudflare API 已就绪
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full font-bold"
          >
            <AlertCircle class="w-3 h-3" /> 需在【域名管理】配置 Token
          </span>
        </div>

        <!-- 🚀 智能子域名前缀输入与根域名联动 -->
        <div class="space-y-2">
          <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
            绑定二级域名（直接输入子域名前缀即可，支持多域名逗号隔开）：
          </label>
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <!-- 前缀输入框 -->
            <div class="flex-1 relative">
              <input
                v-model="subdomainPrefix"
                type="text"
                placeholder="直接写子域名前缀，如: zy 或 cku"
                class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:outline-none font-mono"
              />
            </div>

            <span class="hidden sm:inline text-xs font-bold text-slate-400">.</span>

            <!-- 根域名选择器 -->
            <div class="sm:w-56 shrink-0">
              <select
                v-if="!isCustomZone && availableZones.length > 0"
                v-model="selectedZone"
                class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:outline-none font-mono cursor-pointer"
              >
                <option v-for="z in availableZones" :key="z.id" :value="z.name">
                  .{{ z.name }}
                </option>
              </select>
              <input
                v-else
                v-model="customZoneInput"
                type="text"
                placeholder="根域名，如: yourdomain.com"
                class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:outline-none font-mono"
              />
            </div>

            <!-- 切换自定义根域名 -->
            <button
              v-if="availableZones.length > 0"
              type="button"
              class="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap cursor-pointer py-1"
              @click="isCustomZone = !isCustomZone"
            >
              {{ isCustomZone ? '从 Cloudflare 选择' : '自定义根域名' }}
            </button>
          </div>

          <!-- 域名实时预览 -->
          <div
            v-if="activeFullDomain"
            class="flex items-center justify-between p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[11px] text-orange-700 dark:text-orange-300 font-mono"
          >
            <span class="truncate"
              >解析后生效域名: <strong>https://{{ activeFullDomain }}</strong></span
            >
            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                class="p-1 hover:text-orange-900 dark:hover:text-white cursor-pointer"
                title="复制域名"
                @click="copyToClipboard(`https://${activeFullDomain}`)"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label class="block text-[11px] text-slate-500 dark:text-slate-400 mb-1"
              >服务器 IP（留空自动使用当前服务器公网 IP）：</label
            >
            <input
              v-model="form.serverIp"
              type="text"
              placeholder="例如: 120.78.xxx.xxx"
              class="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:outline-none font-mono"
            />
          </div>

          <div class="flex flex-col justify-end">
            <label
              class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 py-1.5"
            >
              <input
                v-model="form.cloudflareProxied"
                type="checkbox"
                class="rounded text-orange-500 focus:ring-orange-500/30"
              />
              <span>开启 Cloudflare CDN 代理加速 (小云朵)</span>
            </label>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span class="text-[10px] text-slate-400">
            支持多个代理站绑定不同二级子域名（如 zy.lilan8.cn, cku.lilan8.cn）
          </span>

          <Button
            size="sm"
            variant="outline"
            class="text-xs border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/20"
            :disabled="isSyncingDns || !hasCloudflareToken"
            @click="handleSyncCloudflareDns"
          >
            <Loader2 v-if="isSyncingDns" class="w-3.5 h-3.5 animate-spin mr-1" />
            <Zap v-else class="w-3.5 h-3.5 mr-1" />
            一键自动同步至 Cloudflare DNS
          </Button>
        </div>

        <div
          v-if="form.cloudflareDnsRecordId"
          class="text-[11px] text-slate-500 flex items-center justify-between bg-white/60 dark:bg-slate-900/40 p-2 rounded-xl"
        >
          <span>Cloudflare DNS 记录 ID: {{ form.cloudflareDnsRecordId }}</span>
          <span v-if="form.lastDnsSyncAt" class="text-slate-400"
            >上次同步: {{ form.lastDnsSyncAt.slice(0, 19).replace('T', ' ') }}</span
          >
        </div>
      </div>

      <!-- Nginx 配置助手 -->
      <details
        class="group p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60"
      >
        <summary
          class="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
        >
          <span>查看该子域名专属 Nginx 配置文件模板</span>
          <span class="text-blue-500 text-[11px] group-open:rotate-180 transition-transform"
            >▼</span
          >
        </summary>
        <div class="mt-2 space-y-2">
          <p class="text-[11px] text-slate-400">
            在服务器 <code>/etc/nginx/sites-available/</code> 中创建配置文件即可实现子域名直接访问：
          </p>
          <pre
            class="p-2.5 rounded-xl bg-slate-900 text-slate-200 text-[10px] font-mono overflow-x-auto leading-relaxed"
            >{{ nginxSnippet }}</pre
          >
          <div class="flex justify-end">
            <button
              type="button"
              class="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
              @click="copyToClipboard(nginxSnippet, 'Nginx 配置已复制！')"
            >
              复制 Nginx 配置代码
            </button>
          </div>
        </div>
      </details>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-3">
        <Button variant="outline" size="sm" @click="emit('update:show', false)"> 取消 </Button>
        <Button
          variant="primary"
          size="sm"
          :disabled="isSaving"
          class="bg-blue-600 hover:bg-blue-700 text-white font-bold"
          @click="handleSave"
        >
          <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin mr-1.5" />
          <span>{{ isSaving ? '保存中...' : '保存配置' }}</span>
        </Button>
      </div>
    </template>
  </Modal>
</template>

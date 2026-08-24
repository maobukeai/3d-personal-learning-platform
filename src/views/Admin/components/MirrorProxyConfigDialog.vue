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
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (e: 'saved'): void;
}>();

const isLoading = ref(false);
const isSaving = ref(false);
const isSyncingDns = ref(false);
const isUploadingLogo = ref(false);
const hasCloudflareToken = ref(false);

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

const currentOrigin = computed(() => {
  return typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com';
});

const previewPortalUrl = computed(() => {
  if (form.value.customSlug.trim()) {
    return `${currentOrigin.value}/portal/${form.value.customSlug.trim()}`;
  }
  if (props.source?.id) {
    return `${currentOrigin.value}/portal/mirror/${props.source.id}`;
  }
  return `${currentOrigin.value}/portal`;
});

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

async function loadProxyConfig() {
  if (!props.source?.id) return;
  isLoading.value = true;
  try {
    const res = await api.get(`/api/admin/mirror/sources/${props.source.id}/proxy-config`);
    const cfg = res.data?.proxyConfig || {};
    hasCloudflareToken.value = Boolean(res.data?.hasCloudflareToken);
    form.value = {
      proxyEnabled: Boolean(cfg.proxyEnabled),
      customSlug: cfg.customSlug || '',
      customDomain: cfg.customDomain || '',
      brandName: cfg.brandName || props.source.displayName || '',
      brandSubtitle: cfg.brandSubtitle || '',
      brandLogoUrl: cfg.brandLogoUrl || props.source.iconUrl || '',
      serverIp: cfg.serverIp || '',
      cloudflareProxied: cfg.cloudflareProxied !== false,
      cloudflareZoneId: cfg.cloudflareZoneId || '',
      cloudflareDnsRecordId: cfg.cloudflareDnsRecordId || '',
      lastDnsSyncAt: cfg.lastDnsSyncAt || '',
    };
  } catch (error) {
    logError(error, { operation: 'admin.loadProxyConfig', component: 'MirrorProxyConfigDialog' });
  } finally {
    isLoading.value = false;
  }
}

async function handleSave() {
  if (!props.source?.id) return;
  isSaving.value = true;
  try {
    await api.post(`/api/admin/mirror/sources/${props.source.id}/proxy-config`, form.value);
    ElMessage.success('🎉 独立代理站配置已成功保存！');
    emit('saved');
    emit('update:show', false);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存代理站配置失败'));
  } finally {
    isSaving.value = false;
  }
}

async function handleSyncCloudflareDns() {
  if (!props.source?.id) return;
  if (!form.value.customDomain.trim()) {
    ElMessage.warning('请先填写需要绑定的二级域名（如 zy.lilan8.cn）');
    return;
  }
  isSyncingDns.value = true;
  try {
    const res = await api.post(`/api/admin/mirror/sources/${props.source.id}/cloudflare-dns`, {
      customDomain: form.value.customDomain.trim(),
      serverIp: form.value.serverIp.trim() || undefined,
      proxied: form.value.cloudflareProxied,
    });
    ElMessage.success(res.data?.message || 'DNS 解析成功同步至 Cloudflare！');
    if (res.data?.proxyConfig) {
      form.value.cloudflareDnsRecordId = res.data.proxyConfig.cloudflareDnsRecordId;
      form.value.lastDnsSyncAt = res.data.proxyConfig.lastDnsSyncAt;
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
  const domain = form.value.customDomain.trim() || 'zy.yourdomain.com';
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
  () => props.show,
  (show) => {
    if (show) loadProxyConfig();
  },
);
</script>

<template>
  <Modal
    :show="show"
    :title="`独立代理门户站与域名配置 — ${source?.displayName || '镜像站'}`"
    size="lg"
    @close="emit('update:show', false)"
  >
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-16">
      <Loader2 class="w-8 h-8 animate-spin text-blue-500 mb-2" />
      <span class="text-xs text-slate-400">正在加载代理站配置...</span>
    </div>

    <div v-else class="space-y-5">
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

      <!-- Cloudflare 域名与一键 DNS 解析 -->
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

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] text-slate-500 dark:text-slate-400 mb-1"
              >要绑定的二级子域名：</label
            >
            <input
              v-model="form.customDomain"
              type="text"
              placeholder="例如: zy.lilan8.cn 或 mirror.yourdomain.com"
              class="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label class="block text-[11px] text-slate-500 dark:text-slate-400 mb-1"
              >服务器 IP（留空自动使用当前服务器 IP）：</label
            >
            <input
              v-model="form.serverIp"
              type="text"
              placeholder="例如: 120.78.xxx.xxx"
              class="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:outline-none font-mono"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              v-model="form.cloudflareProxied"
              type="checkbox"
              class="rounded text-orange-500 focus:ring-orange-500/30"
            />
            <span>开启 Cloudflare CDN 代理加速 (橙色小云朵)</span>
          </label>

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
          <pre
            class="p-3 rounded-xl bg-slate-900 text-slate-200 text-[10px] font-mono overflow-x-auto leading-relaxed"
            >{{ nginxSnippet }}</pre
          >
          <Button
            size="sm"
            variant="outline"
            class="text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20"
            @click="copyToClipboard(nginxSnippet, 'Nginx 配置代码已复制')"
          >
            <Copy class="w-3 h-3 mr-1" /> 复制 Nginx 配置
          </Button>
        </div>
      </details>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" @click="emit('update:show', false)"> 取消 </Button>
        <Button
          variant="primary"
          size="sm"
          class="bg-blue-600 text-white"
          :disabled="isSaving"
          @click="handleSave"
        >
          <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin mr-1" />
          保存配置
        </Button>
      </div>
    </template>
  </Modal>
</template>

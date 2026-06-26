<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Share2,
  Copy,
  Check,
  Calendar,
  Clock,
  Link,
  MessageSquare,
  Download,
  QrCode,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import QRCode from 'qrcode';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import Switch from '@/components/ui/Switch.vue';

const props = defineProps<{
  type: 'asset' | 'material' | 'plugin';
}>();

interface Resource {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
}

interface ShareConfig {
  id: string;
  expiresAt: string | null;
  customText: string | null;
  createdAt: string;
}

interface SharePayload {
  expireHours?: number | null;
  expiresAt?: string;
  customText?: string | null;
}

const visible = ref(false);
const resource = ref<Resource | null>(null);
const loading = ref(false);
const saving = ref(false);
const shareConfig = ref<ShareConfig | null>(null);

const durationOptions = [
  { val: 'permanent', label: '永久有效' },
  { val: '1h', label: '1 小时' },
  { val: '1d', label: '1 天' },
  { val: '7d', label: '7 天' },
  { val: '30d', label: '30 天' },
  { val: 'custom', label: '自定义' },
] as const;

const durationType = ref<typeof durationOptions[number]['val']>('permanent');
const customExpiresAt = ref<string | Date | null>(null);
const customText = ref('');
const enableCustomText = ref(false);
const isCopied = ref(false);
const qrCodeDataUrl = ref('');
const renderingCard = ref(false);

// Dynamic computed values based on type prop
const typeLabels = {
  asset: {
    name: '3D模型',
    urlKey: 'asset',
    apiPath: 'assets',
    qrSubtitle: '扫码浏览 3D 资产模型',
    watermark: '3D 个人学习平台 | 3D 资产库',
    themeClass: 'from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400',
    logoBg: 'bg-gradient-to-tr from-purple-500 to-indigo-600 shadow-sm',
    badgeClass: 'bg-emerald-500/10 text-emerald-500',
    shortcuts: [
      { tpl: '💡 炫酷的 3D 模型渲染，强烈推荐预览！', label: '💡 强烈推荐' },
      { tpl: '🎨 个人精心制作 the 3D 模型资产。', label: '🎨 精心制作' },
      { tpl: '🎯 欢迎大家来预览我们的 3D 资产。', label: '🎯 欢迎预览' },
    ],
  },
  material: {
    name: '材质',
    urlKey: 'material',
    apiPath: 'materials',
    qrSubtitle: '扫码浏览精美 3D 材质',
    watermark: '3D 个人学习平台 | 材质库',
    themeClass: 'from-indigo-600 to-cyan-600 dark:from-indigo-400 dark:to-cyan-400',
    logoBg: 'bg-gradient-to-tr from-indigo-500 to-cyan-500 shadow-sm',
    badgeClass: 'bg-indigo-500/10 text-indigo-500',
    shortcuts: [
      { tpl: '💡 精美高分辨率 PBR 材质，推荐下载！', label: '💡 强烈推荐' },
      { tpl: '🎨 个人精心制作的材质资产。', label: '🎨 精心制作' },
      { tpl: '🎯 欢迎大家来预览我们的材质。', label: '🎯 欢迎预览' },
    ],
  },
  plugin: {
    name: '插件',
    urlKey: 'plugin',
    apiPath: 'plugins',
    qrSubtitle: '扫码下载与浏览 3D 插件',
    watermark: '3D 个人学习平台 | 插件库',
    themeClass: 'from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400',
    logoBg: 'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-sm',
    badgeClass: 'bg-amber-500/10 text-amber-500',
    shortcuts: [
      { tpl: '💡 强大的编辑器插件，欢迎安装体验！', label: '💡 强烈推荐' },
      { tpl: '🎨 个人精心开发的插件资产。', label: '🎨 精心制作' },
      { tpl: '🎯 欢迎大家来预览我们的插件。', label: '🎯 欢迎预览' },
    ],
  },
};

const configInfo = computed(() => typeLabels[props.type]);

const shareUrl = computed(() => {
  if (!shareConfig.value) return '';
  return `${window.location.origin}/share/${configInfo.value.urlKey}/${shareConfig.value.id}`;
});

const isExpired = computed(() => {
  if (!shareConfig.value || !shareConfig.value.expiresAt) return false;
  return new Date() > new Date(shareConfig.value.expiresAt);
});

const generateQrCode = async () => {
  if (!shareUrl.value) {
    qrCodeDataUrl.value = '';
    return;
  }
  try {
    qrCodeDataUrl.value = await QRCode.toDataURL(shareUrl.value, {
      width: 240,
      margin: 1.5,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff',
      },
    });
  } catch (err) {
    logError(err, { operation: `${configInfo.value.apiPath}.generateQrCode`, component: 'ShareDialog' });
    qrCodeDataUrl.value = '';
  }
};

const drawRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 2,
) => {
  const words = text.split('');
  let line = '';
  let currentY = y;
  let lineCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      lineCount++;
      if (lineCount === maxLines) {
        ctx.fillText(line.slice(0, -1) + '...', x, currentY);
        return currentY;
      }
      ctx.fillText(line, x, currentY);
      line = words[n];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY;
};

const downloadQrCode = () => {
  if (!qrCodeDataUrl.value || !resource.value || renderingCard.value) return;
  renderingCard.value = true;

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    renderingCard.value = false;
    return;
  }

  // Enable anti-aliasing
  ctx.imageSmoothingEnabled = true;

  // 1. Draw Background Card
  ctx.fillStyle = '#ffffff';
  drawRoundRect(ctx, 0, 0, 400, 540, 24);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  // 2. Draw Header
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('🔗 分享卡片', 24, 38);

  // Badge background
  ctx.fillStyle = '#dcfce7'; // green-100
  drawRoundRect(ctx, 312, 22, 64, 22, 6);
  ctx.fill();
  // Badge text
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#15803d'; // green-700
  ctx.textAlign = 'center';
  ctx.fillText('公开可用', 344, 36);

  // 3. Draw Info Box
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  drawRoundRect(ctx, 24, 64, 352, 106, 16);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  // Title
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#0f172a';
  wrapText(ctx, resource.value.title, 40, 96, 320, 20, 1);

  // Subtitle / Custom message
  ctx.font = '11px sans-serif';
  if (enableCustomText.value && customText.value.trim()) {
    ctx.fillStyle = '#475569';
    ctx.font = 'italic 11px sans-serif';
    wrapText(ctx, `“${customText.value.trim()}”`, 40, 126, 320, 18, 2);
  } else {
    ctx.fillStyle = '#64748b';
    ctx.fillText(configInfo.value.qrSubtitle, 40, 126);
  }

  // 4. Draw QR Code Frame
  ctx.fillStyle = '#ffffff';
  drawRoundRect(ctx, 80, 196, 240, 240, 16);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  // Load and draw QR code image
  const img = new Image();
  img.src = qrCodeDataUrl.value;
  img.onload = () => {
    try {
      ctx.drawImage(img, 88, 204, 224, 224);

      // 5. Draw Footer
      ctx.textAlign = 'center';
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('微信/手机浏览器扫码浏览', 200, 470);

      // Watermark
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(configInfo.value.watermark, 200, 502);

      // Trigger download
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${resource.value!.title}_分享卡片.png`;
      link.click();
      ElMessage.success('分享二维码卡片已成功保存到本地！');
    } catch (err) {
      logError(err, { operation: `${configInfo.value.apiPath}.saveShareCard`, component: 'ShareDialog' });
      ElMessage.error('保存二维码卡片失败');
    } finally {
      renderingCard.value = false;
    }
  };
  img.onerror = () => {
    ElMessage.error('加载二维码图片失败');
    renderingCard.value = false;
  };
};

const open = async (targetResource: Resource) => {
  resource.value = targetResource;
  visible.value = true;
  loading.value = true;
  shareConfig.value = null;
  durationType.value = 'permanent';
  customExpiresAt.value = null;
  customText.value = '';
  enableCustomText.value = false;
  isCopied.value = false;
  qrCodeDataUrl.value = '';

  try {
    const res = await api.get(`/api/${configInfo.value.apiPath}/${targetResource.id}/share?t=${Date.now()}`);
    if (res.data) {
      shareConfig.value = res.data;
      customText.value = res.data.customText || '';
      enableCustomText.value = !!res.data.customText;
      if (res.data.expiresAt) {
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
      await generateQrCode();
    }
  } catch (error) {
    logError(error, { operation: `${configInfo.value.apiPath}.fetchShareConfig`, component: 'ShareDialog' });
  } finally {
    loading.value = false;
  }
};

const handleCreateOrUpdate = async () => {
  if (!resource.value) return;
  saving.value = true;
  try {
    let payload: SharePayload = {};
    if (durationType.value === '1h') payload.expireHours = 1;
    else if (durationType.value === '1d') payload.expireHours = 24;
    else if (durationType.value === '7d') payload.expireHours = 168;
    else if (durationType.value === '30d') payload.expireHours = 720;
    else if (durationType.value === 'custom') {
      const expiresVal = customExpiresAt.value;
      if (!expiresVal) {
        ElMessage.warning('请选择自定义过期时间');
        saving.value = false;
        return;
      }
      const expiresDate = typeof expiresVal === 'string' ? new Date(expiresVal.replace(' ', 'T')) : expiresVal;
      if (!expiresDate || Number.isNaN(expiresDate.getTime())) {
        ElMessage.warning('无效的过期时间');
        saving.value = false;
        return;
      }
      if (expiresDate <= new Date()) {
        ElMessage.warning('过期时间不能早于当前时间');
        saving.value = false;
        return;
      }
      payload.expiresAt = expiresDate.toISOString();
    } else {
      payload.expireHours = null; // Permanent
    }

    payload.customText = enableCustomText.value ? customText.value.trim() || null : null;

    const res = await api.post(`/api/${configInfo.value.apiPath}/${resource.value.id}/share`, payload);
    if (res.data) {
      shareConfig.value = res.data;
      await generateQrCode();
      ElMessage.success('分享链接已更新/创建！');
    } else {
      ElMessage.error('创建失败');
    }
  } catch (error) {
    ElMessage.error('更新分享链接失败');
  } finally {
    saving.value = false;
  }
};

const handleCancelShare = async () => {
  if (!resource.value) return;
  saving.value = true;
  try {
    await api.delete(`/api/${configInfo.value.apiPath}/${resource.value.id}/share`);
    shareConfig.value = null;
    durationType.value = 'permanent';
    customExpiresAt.value = null;
    customText.value = '';
    enableCustomText.value = false;
    qrCodeDataUrl.value = '';
    ElMessage.success('已取消分享，该链接已失效');
  } catch (error) {
    ElMessage.error('取消分享失败');
  } finally {
    saving.value = false;
  }
};

const copyLink = async () => {
  if (!shareUrl.value || !resource.value) return;
  try {
    let copyText = `我分享了${configInfo.value.name}《${resource.value.title}》，点击链接直接浏览：${shareUrl.value}`;
    if (enableCustomText.value && customText.value.trim()) {
      copyText = `我分享了${configInfo.value.name}《${resource.value.title}》：“${customText.value.trim()}”，点击链接直接浏览：${shareUrl.value}`;
    }
    await navigator.clipboard.writeText(copyText);
    isCopied.value = true;
    ElMessage.success('已复制分享链接！');
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (error) {
    ElMessage.error('复制失败');
  }
};

defineExpose({ open });
</script>

<template>
  <Modal :show="visible" size="lg" :z-index="1100" glass-card @close="visible = false">
    <template #header>
      <div class="mobile-row flex items-center gap-2.5">
        <div
          class="p-2 bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-base)] rounded-lg"
        >
          <Share2 class="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 class="text-base font-bold tracking-wide" style="color: var(--text-primary)">
            分享{{ configInfo.name }}
          </h3>
          <p class="text-xs text-[var(--text-muted)] mt-0.5">
            生成免登录浏览分享链接，可设置过期时间、说明寄语与分享二维码卡片
          </p>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="mobile-adaptive grid grid-cols-1 md:grid-cols-12 gap-5 py-0.5">
      <!-- Left Column: Settings (7 cols) -->
      <div class="md:col-span-7 space-y-4">
        <!-- Resource Summary Box -->
        <div
          v-if="resource"
          class="mobile-row p-3 bg-slate-50/40 dark:bg-zinc-900/10 rounded-xl border border-[var(--border-base)] flex items-start gap-3 transition-all duration-300"
        >
          <div
            class="p-2 bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-base)] rounded-lg shrink-0 flex items-center justify-center"
          >
            <Share2 class="w-4 h-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse"></span>
              <span
                class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block"
                >公开分享</span
              >
            </div>
            <h4 class="text-sm font-bold text-[var(--text-primary)] truncate">{{ resource.title }}</h4>
            <p class="text-xs text-[var(--text-muted)] mt-0.5">
              创建于: {{ new Date(resource.createdAt).toLocaleString('zh-CN') }}
            </p>
          </div>
        </div>

        <!-- Share Settings Form -->
        <div class="space-y-3.5">
          <!-- Set Duration -->
          <div class="space-y-1.5">
            <label
              class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block flex items-center gap-1.5 ml-1"
            >
              <Clock class="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 设置链接有效时长
            </label>
            <div class="mobile-grid grid grid-cols-3 gap-1.5">
              <button
                v-for="opt in durationOptions"
                :key="opt.val"
                type="button"
                class="px-2 py-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer whitespace-nowrap active:scale-95 duration-200"
                :class="[
                  durationType === opt.val
                    ? 'bg-accent text-white font-bold border-transparent'
                    : 'bg-white dark:bg-white/5 border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20',
                ]"
                @click="durationType = opt.val"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Custom Expiration Picker -->
          <Transition name="fade">
            <div v-if="durationType === 'custom'" class="pt-1 space-y-1.5">
              <label
                class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block flex items-center gap-1.5 ml-1"
              >
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
            <div class="mobile-row flex items-center justify-between">
              <label
                class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block flex items-center gap-1.5 ml-1"
              >
                <MessageSquare class="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 附带分享说明 / 寄语
              </label>
              <Switch v-model="enableCustomText" />
            </div>

            <Transition name="fade">
              <div v-if="enableCustomText" class="space-y-2 mt-1">
                <textarea
                  v-model="customText"
                  rows="2"
                  placeholder="写下几句对该资源的说明，将显示在访客页顶部..."
                  maxlength="200"
                  class="w-full text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:outline-none bg-slate-50 dark:bg-zinc-900 border border-[var(--border-base)] text-[var(--text-primary)] focus:border-accent p-3 focus:ring-2 focus:ring-accent/20"
                ></textarea>
                <div class="text-xs text-[var(--text-muted)] text-right mt-0.5">
                  {{ customText.length }} / 200
                </div>

                <!-- Shortcut templates -->
                <div
                  class="mobile-row flex items-center gap-1 pt-0.5 overflow-x-auto whitespace-nowrap shortcut-list"
                >
                  <span class="text-xs text-[var(--text-muted)] select-none flex-shrink-0"
                    >快捷留言:</span
                  >
                  <button
                    v-for="opt in configInfo.shortcuts"
                    :key="opt.tpl"
                    type="button"
                    class="px-1.5 py-0.5 text-[11px] bg-slate-50 dark:bg-white/5 border border-[var(--border-base)] hover:border-accent hover:text-accent rounded-md transition-all cursor-pointer text-[var(--text-secondary)] flex-shrink-0"
                    @click="customText = opt.tpl"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Current Share Link Box -->
          <div v-if="shareConfig" class="pt-3 border-t border-[var(--border-base)] space-y-2">
            <label
              class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest block ml-1"
              >分享链接</label
            >
            <div class="mobile-row relative flex items-center">
              <input
                :value="shareUrl"
                readonly
                type="text"
                class="w-full pl-9 pr-24 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent/25 transition-all select-all"
                style="
                  background-color: var(--bg-subtle);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
              <Link class="w-4 h-4 text-slate-400 absolute left-3" />

              <button
                type="button"
                class="absolute right-1 top-1 bottom-1 px-3 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                :class="[
                  isCopied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-accent hover:bg-accent/90 text-white active:scale-95',
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

      <!-- Right Column: Exquisite QR Code Card (5 cols) -->
      <div
        class="md:col-span-5 flex flex-col justify-between items-stretch bg-slate-50/40 dark:bg-zinc-900/10 border border-[var(--border-base)] rounded-2xl p-4 text-center shrink-0 self-stretch min-h-[360px] transition-all duration-300 hover:shadow-md"
      >
        <!-- Card Top Section (Stylized Resource Info) -->
        <div class="space-y-2 text-left">
          <div class="mobile-row flex items-center justify-between">
            <span
              class="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1"
            >
              <QrCode class="w-3 h-3 text-[var(--accent)]" /> 分享卡片
            </span>
            <span
              v-if="shareConfig"
              class="px-1.5 py-0.5 rounded text-[10px] font-bold"
              :class="
                isExpired ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
              "
            >
              {{ isExpired ? '已过期' : '公开可用' }}
            </span>
          </div>

          <div
            class="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-[var(--border-base)] shadow-xs"
          >
            <h4 class="text-sm font-bold text-[var(--text-primary)] line-clamp-1 leading-snug">
              {{ resource?.title || `未命名${configInfo.name}` }}
            </h4>
            <p
              v-if="enableCustomText && customText.trim()"
              class="text-xs italic text-[var(--text-secondary)] mt-1.5 pl-2 border-l-2 border-accent/40 line-clamp-2"
            >
              “{{ customText.trim() }}”
            </p>
            <p v-else class="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-1">
              {{ configInfo.qrSubtitle }}
            </p>
          </div>
        </div>

        <!-- Card Middle Section (QR code render) -->
        <div class="flex flex-col items-center justify-center py-4">
          <div
            class="relative p-2 bg-white rounded-xl border border-[var(--border-base)] shadow-md transition-all duration-300 hover:scale-[1.02] flex items-center justify-center w-40 h-40 group"
          >
            <template v-if="qrCodeDataUrl && !isExpired">
              <img
                :src="qrCodeDataUrl"
                alt="分享二维码"
                class="w-full h-full object-contain animate-fade-in"
              />
            </template>
            <template v-else>
              <!-- Locked/Empty QR code state -->
              <div
                class="flex flex-col items-center justify-center text-center p-3 text-[var(--text-muted)]"
              >
                <div
                  class="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-2"
                >
                  <QrCode class="w-5 h-5 text-slate-400" />
                </div>
                <span class="text-xs font-bold">{{
                  isExpired ? '分享链接已过期' : '等待生成链接'
                }}</span>
              </div>
            </template>
          </div>
          <span class="text-xs text-[var(--text-muted)] font-medium mt-3 block select-none">
            {{ shareConfig && !isExpired ? '微信/手机浏览器扫码浏览' : '设置左侧选项后生成二维码' }}
          </span>
        </div>

        <!-- Card Bottom Section (Download/Actions) -->
        <div class="pt-2">
          <Button
            variant="outline"
            size="sm"
            full-width
            :disabled="!qrCodeDataUrl || isExpired"
            :loading="renderingCard"
            :icon="Download"
            @click="downloadQrCode"
          >
            保存二维码卡片
          </Button>
        </div>
      </div>
    </div>

    <!-- Footer buttons -->
    <template #footer>
      <div class="mobile-row flex justify-between items-center gap-2 w-full">
        <div>
          <Button
            v-if="shareConfig"
            variant="danger"
            size="sm"
            :disabled="saving"
            @click="handleCancelShare"
          >
            取消分享
          </Button>
        </div>
        <div class="flex gap-2">
          <Button variant="secondary" size="sm" @click="visible = false"> 关闭 </Button>
          <Button variant="primary" size="sm" :loading="saving" @click="handleCreateOrUpdate">
            {{ shareConfig ? '保存设置' : '生成链接' }}
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease-in-out;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
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

.shortcut-list::-webkit-scrollbar {
  display: none;
}
.shortcut-list {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

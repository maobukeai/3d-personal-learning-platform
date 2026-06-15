<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, reactive, watch } from 'vue';
import { Palette, Image, Upload, RefreshCw, Sparkles } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';

const props = defineProps<{
  settings: {
    PLATFORM_LOGO_URL: string;
    PLATFORM_FAVICON_URL: string;
    PLATFORM_DESCRIPTION: string;
    BROWSER_TITLE: string;
    FOOTER_TEXT: string;
  };
}>();

const emit = defineEmits<{
  (e: 'update:settings', val: typeof props.settings): void;
}>();

const localSettings = reactive({ ...props.settings });

watch(
  () => props.settings,
  (newVal) => {
    Object.assign(localSettings, newVal);
  },
  { deep: true },
);

watch(
  localSettings,
  (newVal) => {
    emit('update:settings', { ...props.settings, ...newVal });
  },
  { deep: true },
);

const isUploadingLogo = ref(false);
const isUploadingFavicon = ref(false);

const handleLogoUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    return ElMessage.warning(t('admin.logo_image_size_cannot'));
  }

  try {
    isUploadingLogo.value = true;
    const formData = new FormData();
    formData.append('logo', file);
    const { data } = await api.post('/api/admin/settings/upload-logo', formData);
    localSettings.PLATFORM_LOGO_URL = data.url;
    ElMessage.success(t('admin.logo_uploaded_successfully_click'));
  } catch (error) {
    console.error('Logo upload error:', error);
    ElMessage.error(t('admin.logo_upload_failed'));
  } finally {
    isUploadingLogo.value = false;
    target.value = '';
  }
};

const handleFaviconUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 1 * 1024 * 1024) {
    return ElMessage.warning(t('admin.favicon_image_size_cannot'));
  }

  try {
    isUploadingFavicon.value = true;
    const formData = new FormData();
    formData.append('favicon', file);
    const { data } = await api.post('/api/admin/settings/upload-favicon', formData);
    localSettings.PLATFORM_FAVICON_URL = data.url;
    ElMessage.success(t('admin.favicon_uploaded_successfully_click'));
  } catch (error) {
    console.error('Favicon upload error:', error);
    ElMessage.error(t('admin.favicon_upload_failed'));
  } finally {
    isUploadingFavicon.value = false;
    target.value = '';
  }
};
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <section
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3 mb-8">
        <Palette class="w-5 h-5 text-pink-500" />
        <h2 class="text-lg font-bold" style="color: var(--text-primary)">
          {{ $t('admin.platform_brand_configuration') }}
        </h2>
      </div>

      <div class="space-y-6">
        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.platform_logo')
          }}</label>
          <div class="flex items-center gap-4">
            <div
              class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative"
              style="border-color: var(--border-base); background-color: var(--bg-app)"
            >
              <img
                v-if="localSettings.PLATFORM_LOGO_URL"
                alt=""
                :src="getAssetUrl(localSettings.PLATFORM_LOGO_URL)"
                class="w-full h-full object-contain p-1"
              />
              <Image v-else class="w-6 h-6 text-slate-300" />

              <label
                class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
              >
                <Upload v-if="!isUploadingLogo" class="w-5 h-5 text-white" />
                <RefreshCw v-else class="w-5 h-5 text-white animate-spin" />
                <input type="file" accept="image/*" class="hidden" @change="handleLogoUpload" />
              </label>
            </div>
            <div class="flex-1 space-y-2">
              <input
                v-model="localSettings.PLATFORM_LOGO_URL"
                type="text"
                :placeholder="$t('admin.or_enter_the_logo')"
                class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
              <p class="text-[10px] px-1" style="color: var(--text-muted)">
                推荐尺寸 128x128px，支持 PNG/SVG/JPG，文件小于 2MB
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.browser_favicon')
          }}</label>
          <div class="flex items-center gap-4">
            <div
              class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative"
              style="border-color: var(--border-base); background-color: var(--bg-app)"
            >
              <img
                v-if="localSettings.PLATFORM_FAVICON_URL || localSettings.PLATFORM_LOGO_URL"
                alt=""
                :src="
                  getAssetUrl(localSettings.PLATFORM_FAVICON_URL || localSettings.PLATFORM_LOGO_URL)
                "
                class="w-8 h-8 object-contain"
              />
              <Sparkles v-else class="w-6 h-6 text-slate-300" />

              <label
                class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
              >
                <Upload v-if="!isUploadingFavicon" class="w-5 h-5 text-white" />
                <RefreshCw v-else class="w-5 h-5 text-white animate-spin" />
                <input type="file" accept="image/*" class="hidden" @change="handleFaviconUpload" />
              </label>
            </div>
            <div class="flex-1 space-y-2">
              <input
                v-model="localSettings.PLATFORM_FAVICON_URL"
                type="text"
                :placeholder="$t('admin.if_left_blank_the')"
                class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
              <p class="text-[10px] px-1" style="color: var(--text-muted)">
                推荐尺寸 32x32px 或 64x64px，支持 .ico/PNG/SVG
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.platform_description')
          }}</label>
          <textarea
            v-model="localSettings.PLATFORM_DESCRIPTION"
            rows="3"
            :placeholder="$t('admin.introduce_your_platform_in')"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all resize-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          ></textarea>
          <p class="text-[10px] px-1" style="color: var(--text-muted)">
            将显示在登录页面和 SEO 元数据中
          </p>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.browser_window_title')
          }}</label>
          <input
            v-model="localSettings.BROWSER_TITLE"
            type="text"
            :placeholder="$t('admin.for_example_3d_community')"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
              font-weight: normal;
            "
          />
          <p class="text-[10px] px-1" style="color: var(--text-muted)">
            显示在浏览器标签页上的文字，不填则默认与平台名称一致
          </p>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.footer_text')
          }}</label>
          <input
            v-model="localSettings.FOOTER_TEXT"
            type="text"
            placeholder="© 2026 Your Company. All rights reserved."
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
          <p class="text-[10px] px-1" style="color: var(--text-muted)">显示在页面底部，支持 HTML</p>
        </div>
      </div>
    </section>
  </div>
</template>

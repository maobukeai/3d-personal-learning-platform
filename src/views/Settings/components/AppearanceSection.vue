<script setup lang="ts">
import { ref, computed, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { Sun, Moon, Languages } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { preferences, type LocalePreference, type ThemePreference } from '@/utils/preferences';
import { applyAccentColorToDocument, applyThemeToDocument } from '@/composables/useAppearance';

const { t, locale } = useI18n();

const currentTheme = ref<ThemePreference>(preferences.getTheme());
const currentAccent = ref(preferences.getAccentColor());
const currentLanguage = ref<LocalePreference>(preferences.getLanguage());

const accentColors = [
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
  { name: '翠绿', value: '#10b981' },
  { name: '橙色', value: '#f59e0b' },
  { name: '靛青', value: '#6366f1' },
];

const languageOptions: Array<{ label: string; value: LocalePreference }> = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

const themeOptions = computed<Array<{ id: ThemePreference; label: string; icon: Component }>>(
  () => [
    { id: 'glass-light', label: t('settings.themeGlassLight'), icon: Sun },
    { id: 'glass-dark', label: t('settings.themeGlassDark'), icon: Moon },
  ]
);

const applyTheme = (theme: ThemePreference) => {
  currentTheme.value = theme;
  preferences.setTheme(theme);
  applyThemeToDocument(theme);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
};

const applyAccentColor = (color: string) => {
  currentAccent.value = color;
  preferences.setAccentColor(color);
  applyAccentColorToDocument(color);
};

const applyLanguage = (lang: LocalePreference) => {
  currentLanguage.value = lang;
  preferences.setLanguage(lang);
  locale.value = lang;
  ElMessage.success(t('settings.successLanguage'));
};
</script>

<template>
  <div class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="p-5 lg:p-8 rounded-2xl lg:rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <h3 class="text-lg font-bold mb-6" style="color: var(--text-primary)">
        {{ t('settings.theme') }}
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 lg:gap-4">
        <button
v-for="theme in themeOptions" :key="theme.id" type="button" class="flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all" :class="
            currentTheme === theme.id
              ? 'border-accent bg-accent/5 ring-1 ring-accent'
              : 'hover:bg-slate-50 dark:hover:bg-white/5'
          " style="border-color: currentTheme === theme.id ? 'var(--accent)' : 'var(--border-base)'" @click="applyTheme(theme.id)">
          <component
            :is="theme.icon"
            class="w-6 h-6"
            :class="currentTheme === theme.id ? 'text-accent' : 'text-slate-400'"
          />
          <span
            class="text-xs font-bold"
            :class="
              currentTheme === theme.id
                ? 'text-accent'
                : 'text-slate-600 dark:text-slate-400'
            "
          >{{ theme.label }}</span>
        </button>
      </div>
    </div>

    <div class="p-5 lg:p-8 rounded-2xl lg:rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <h3 class="text-lg font-bold mb-6" style="color: var(--text-primary)">
        {{ t('settings.accentColor') }}
      </h3>
      <div class="flex flex-wrap gap-4">
        <button v-for="color in accentColors" :key="color.value" type="button" class="w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95" :style="{ backgroundColor: color.value }" @click="applyAccentColor(color.value)">
          <div
            v-if="currentAccent === color.value"
            class="w-2 h-2 rounded-full bg-white shadow-sm"
          ></div>
        </button>
      </div>
      <p class="text-[10px] text-slate-400 mt-6">
        {{ t('settings.accentColorDesc') }}
      </p>
    </div>

    <div class="p-5 lg:p-8 rounded-2xl lg:rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3 mb-6">
        <Languages class="w-5 h-5 text-accent" />
        <h3 class="text-lg font-bold" style="color: var(--text-primary)">{{ t('settings.languagePreference') }}</h3>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <button
v-for="lang in languageOptions" :key="lang.value" type="button" class="flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all text-sm font-bold" :class="
            currentLanguage === lang.value
              ? 'border-accent bg-accent/5 ring-1 ring-accent text-accent'
              : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'
          " style="border-color: currentLanguage === lang.value ? 'var(--accent)' : 'var(--border-base)'" @click="applyLanguage(lang.value)">
          {{ lang.label }}
        </button>
      </div>
    </div>
  </div>
</template>

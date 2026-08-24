<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Component } from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import {
  CheckCircle2,
  Languages,
  Moon,
  RotateCcw,
  Save,
  Sun,
  SunMoon,
  Grid,
  Sparkles,
  Infinity as InfinityIcon,
  LayoutGrid,
  Aperture,
  Square,
  Columns,
} from 'lucide-vue-next';
import {
  preferences,
  type LocalePreference,
  type ThemePreference,
  type ThemeBackgroundPreference,
  type AccentColorModePreference,
  type AccentColorIntervalPreference,
  type SidebarMode,
} from '@/utils/preferences';
import { useLabel } from '@/utils/i18n';
import { applyAccentColorToDocument, applyThemeToDocument } from '@/composables/useAppearance';
import { fetchUserSettings, updateUserSettings } from '@/services/account.service';
import { setLocale } from '@/i18n';
import Button from '@/components/ui/Button.vue';

const currentTheme = ref<ThemePreference>(preferences.getTheme());
const currentBackground = ref<ThemeBackgroundPreference>(preferences.getBackground());
const currentAccent = ref(preferences.getAccentColor());
const activeAccentColor = ref(currentAccent.value);
const currentLanguage = ref<LocalePreference>(preferences.getLanguage());
const currentSidebarMode = ref<SidebarMode>(preferences.getSidebarMode());

const currentAccentMode = ref<AccentColorModePreference>(preferences.getAccentColorMode());
const currentAccentInterval = ref<AccentColorIntervalPreference>(
  preferences.getAccentColorInterval(),
);

const savedSnapshot = ref('');
const isLoadingCloud = ref(false);
const isSaving = ref(false);
const label = useLabel();

const accentColors = computed(() => [
  { name: label('海蓝', 'Ocean Blue'), value: '#2563eb' },
  { name: label('紫罗兰', 'Violet'), value: '#8b5cf6' },
  { name: label('玫红', 'Rose'), value: '#ec4899' },
  { name: label('松绿', 'Pine Green'), value: '#10b981' },
  { name: label('琥珀', 'Amber'), value: '#f59e0b' },
  { name: label('青蓝', 'Cyan'), value: '#0891b2' },
]);

const modeOptions = computed(() => [
  { id: 'static' as const, label: label('固定颜色', 'Static') },
  { id: 'refresh' as const, label: label('刷新随机', 'On Refresh') },
  { id: 'interval' as const, label: label('定时随机', 'Interval') },
]);

const intervalOptions = computed(() => [
  { value: '10s' as const, label: label('10 秒', '10s') },
  { value: '1m' as const, label: label('1 分钟', '1m') },
  { value: '5m' as const, label: label('5 分钟', '5m') },
  { value: '30m' as const, label: label('30 分钟', '30m') },
]);

const languageOptions: Array<{ label: string; value: LocalePreference }> = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

const themeOptions = computed<
  Array<{ id: ThemePreference; label: string; description: string; icon: Component }>
>(() => [
  {
    id: 'glass-light',
    label: label('浅色玻璃', 'Light Glass'),
    description: label('适合白天和明亮环境', 'Best for daytime and bright rooms'),
    icon: Sun,
  },
  {
    id: 'glass-dark',
    label: label('深色玻璃', 'Dark Glass'),
    description: label('适合夜间 and 沉浸学习', 'Best for night and focused study'),
    icon: Moon,
  },
  {
    id: 'glass-auto',
    label: label('跟随系统', 'Auto'),
    description: label('自动匹配系统外观', 'Matches the system appearance'),
    icon: SunMoon,
  },
]);

const backgroundOptions = computed<
  Array<{ id: ThemeBackgroundPreference; label: string; description: string; icon: Component }>
>(() => [
  {
    id: 'grid',
    label: label('工业网格', 'Industrial Grid'),
    description: label('经典网格线条背景', 'Classic grid line canvas'),
    icon: Grid,
  },
  {
    id: 'aurora',
    label: label('极光幻影', 'Aurora Aura'),
    description: label('现代暗色环境光晕', 'Modern ambient radial glow'),
    icon: Sparkles,
  },
  {
    id: 'blobs',
    label: label('流光浮影', 'Neon Blobs'),
    description: label('动感十足的炫彩浮动光斑', 'Dynamic flowing tech blobs'),
    icon: InfinityIcon,
  },
  {
    id: 'dots',
    label: label('柔雾光影', 'Soft Atmosphere'),
    description: label('低对比度的柔和光影画布', 'A calm, low-contrast ambient canvas'),
    icon: LayoutGrid,
  },
  {
    id: 'prism',
    label: label('棱镜折光', 'Prism Refraction'),
    description: label(
      '具有空间感的玻璃折射光带',
      'Layered glass refraction with dimensional light',
    ),
    icon: Aperture,
  },
  {
    id: 'solid',
    label: label('极简纯色', 'Minimalist Solid'),
    description: label('去除多余视觉装饰', 'Clean and plain background'),
    icon: Square,
  },
]);

const layoutOptions = computed<
  Array<{
    id: SidebarMode;
    label: string;
    description: string;
    tag: string;
    styleTag: string;
    icon: Component;
  }>
>(() => [
  {
    id: 'classic',
    label: label('经典折叠侧栏', 'Classic Collapsible'),
    description: label(
      '保留原版双态交互（顶部按钮一键折叠为微轨/展开为侧栏，支持拖拽调宽），彻底优化代码架构与单列无框排版。',
      'Original dual-mode collapsible sidebar (toggle rail/panel, resizable), fully refactored with clean modern UI.',
    ),
    tag: label('原版优化', 'Original Opt'),
    styleTag: label('原版经典双态交互', 'Classic Dual-Mode'),
    icon: Columns,
  },
  {
    id: 'top',
    label: label('全景顶栏模式', 'Top Navigation Only'),
    description: label(
      '桌面端完全移除左侧全局主栏，全站导航收纳至顶栏，邮件/任务等工具独占侧栏，获得最大横向操作空间。',
      'Single workspace, navigation in topbar, GitHub & Vercel style without left main sidebar.',
    ),
    tag: label('全屏沉浸', 'Spacious'),
    styleTag: label('GitHub / Vercel 风格', 'GitHub / Vercel Style'),
    icon: SunMoon,
  },
  {
    id: 'rail',
    label: label('极简常驻微轨', 'Mini Icon Rail Only'),
    description: label(
      '左侧始终保持 56px 极简微图标轨，不占桌面横向空间，工具页面深度沉浸。',
      '56px permanent floating icon rail, auto-immersive tools, Linear & Slack style.',
    ),
    tag: label('极简悬浮', 'Minimal Rail'),
    styleTag: label('Linear / Slack 风格', 'Linear / Slack Style'),
    icon: LayoutGrid,
  },
]);

const snapshot = computed(() =>
  JSON.stringify({
    theme: currentTheme.value,
    background: currentBackground.value,
    accent: currentAccent.value,
    language: currentLanguage.value,
    accentMode: currentAccentMode.value,
    accentInterval: currentAccentInterval.value,
    sidebarMode: currentSidebarMode.value,
  }),
);

const hasChanges = computed(() => snapshot.value !== savedSnapshot.value);

const currentAccentName = computed(() => {
  if (currentAccentMode.value === 'refresh') {
    return label('刷新随机', 'Random on Refresh');
  }
  if (currentAccentMode.value === 'interval') {
    const duration =
      currentAccentInterval.value === '10s'
        ? '10s'
        : currentAccentInterval.value === '1m'
          ? '1m'
          : currentAccentInterval.value === '5m'
            ? '5m'
            : '30m';
    return `${label('定时随机', 'Interval')} (${duration})`;
  }
  return (
    accentColors.value.find((item) => item.value === currentAccent.value)?.name ||
    currentAccent.value
  );
});

const applyTheme = (theme: ThemePreference) => {
  currentTheme.value = theme;
  preferences.setTheme(theme);
  applyThemeToDocument(theme);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
};

const applyBackground = (bg: ThemeBackgroundPreference) => {
  currentBackground.value = bg;
  preferences.setBackground(bg);
  window.dispatchEvent(new CustomEvent('background-changed', { detail: bg }));
};

const applyAccentColor = (color: string) => {
  currentAccent.value = color;
  currentAccentMode.value = 'static';
  preferences.setAccentColor(color);
  preferences.setAccentColorMode('static');
  applyAccentColorToDocument(color);

  window.dispatchEvent(
    new CustomEvent('accent-settings-changed', {
      detail: {
        color: color,
        mode: 'static',
        interval: currentAccentInterval.value,
      },
    }),
  );
};

const applyAccentMode = (mode: AccentColorModePreference) => {
  currentAccentMode.value = mode;
  preferences.setAccentColorMode(mode);

  if (mode === 'refresh') {
    const backgrounds: ThemeBackgroundPreference[] = [
      'grid',
      'aurora',
      'blobs',
      'dots',
      'prism',
      'solid',
    ];
    const candidates = backgrounds.filter((background) => background !== currentBackground.value);
    const next =
      candidates[Math.floor(Math.random() * candidates.length)] || currentBackground.value;
    applyBackground(next);
  }

  window.dispatchEvent(
    new CustomEvent('accent-settings-changed', {
      detail: {
        color: currentAccent.value,
        mode: mode,
        interval: currentAccentInterval.value,
      },
    }),
  );
};

const applyAccentInterval = (interval: AccentColorIntervalPreference) => {
  currentAccentInterval.value = interval;
  preferences.setAccentColorInterval(interval);

  window.dispatchEvent(
    new CustomEvent('accent-settings-changed', {
      detail: {
        color: currentAccent.value,
        mode: currentAccentMode.value,
        interval: interval,
      },
    }),
  );
};

const applyLanguage = (lang: LocalePreference) => {
  currentLanguage.value = lang;
  void setLocale(lang);
};

const applyLoadedSettings = (settings: Record<string, string>) => {
  const theme = settings.appearanceTheme as ThemePreference | undefined;
  const background = settings.appearanceBackground as ThemeBackgroundPreference | undefined;
  const accent = settings.appearanceAccent;
  const language = settings.appearanceLanguage as LocalePreference | undefined;
  const accentMode = settings.appearanceAccentMode as AccentColorModePreference | undefined;
  const accentInterval = settings.appearanceAccentInterval as
    | AccentColorIntervalPreference
    | undefined;
  const sidebarMode = settings.layoutSidebarMode as SidebarMode | undefined;
  const hasValidBackground =
    background === 'grid' ||
    background === 'aurora' ||
    background === 'blobs' ||
    background === 'dots' ||
    background === 'prism' ||
    background === 'solid';

  if (theme === 'glass-light' || theme === 'glass-dark' || theme === 'glass-auto') {
    applyTheme(theme);
  }
  if (language === 'zh-CN' || language === 'en-US') {
    applyLanguage(language);
  }
  if (sidebarMode === 'rail' || sidebarMode === 'top' || sidebarMode === 'expanded') {
    applySidebarMode(sidebarMode);
  }

  if (accent && /^#[0-9a-f]{6}$/i.test(accent)) {
    currentAccent.value = accent;
    preferences.setAccentColor(accent);
  }

  if (accentMode === 'static' || accentMode === 'refresh' || accentMode === 'interval') {
    currentAccentMode.value = accentMode;
    preferences.setAccentColorMode(accentMode);
  } else {
    currentAccentMode.value = 'static';
    preferences.setAccentColorMode('static');
  }

  if (currentAccentMode.value === 'refresh') {
    applyAccentMode('refresh');
  } else if (hasValidBackground) {
    applyBackground(background as ThemeBackgroundPreference);
  }

  if (
    accentInterval === '10s' ||
    accentInterval === '1m' ||
    accentInterval === '5m' ||
    accentInterval === '30m'
  ) {
    currentAccentInterval.value = accentInterval;
    preferences.setAccentColorInterval(accentInterval);
  }

  if (currentAccentMode.value === 'static') {
    applyAccentColorToDocument(currentAccent.value);
  }

  window.dispatchEvent(
    new CustomEvent('accent-settings-changed', {
      detail: {
        color: currentAccent.value,
        mode: currentAccentMode.value,
        interval: currentAccentInterval.value,
      },
    }),
  );
};

const applySidebarMode = (mode: SidebarMode) => {
  currentSidebarMode.value = mode;
  preferences.setSidebarMode(mode);
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('sidebar-mode-changed', { detail: { mode } }));
};

const loadCloudSettings = async () => {
  try {
    isLoadingCloud.value = true;
    const settings = await fetchUserSettings();
    applyLoadedSettings(settings);
    savedSnapshot.value = snapshot.value;
  } catch {
    savedSnapshot.value = snapshot.value;
    ElMessage.warning(
      label(
        '云端外观设置加载失败，已使用本地设置',
        'Cloud appearance settings failed to load; local settings are used',
      ),
    );
  } finally {
    isLoadingCloud.value = false;
  }
};

const saveAppearance = async () => {
  try {
    isSaving.value = true;
    await updateUserSettings([
      { key: 'appearanceTheme', value: currentTheme.value },
      { key: 'appearanceBackground', value: currentBackground.value },
      { key: 'appearanceAccent', value: currentAccent.value },
      { key: 'appearanceLanguage', value: currentLanguage.value },
      { key: 'appearanceAccentMode', value: currentAccentMode.value },
      { key: 'appearanceAccentInterval', value: currentAccentInterval.value },
      { key: 'layoutSidebarMode', value: currentSidebarMode.value },
    ]);
    savedSnapshot.value = snapshot.value;
    ElMessage.success(label('外观与布局设置已同步', 'Appearance & layout settings synced'));
  } catch {
    ElMessage.error(label('同步外观设置失败', 'Failed to sync appearance settings'));
  } finally {
    isSaving.value = false;
  }
};

const resetLocal = () => {
  applyTheme('glass-dark');
  applyBackground('grid');
  applyAccentColor('#2563eb');
  applyAccentMode('static');
  applyAccentInterval('1m');
  applyLanguage('zh-CN');
  applySidebarMode('classic');
};

const handleAccentColorApplied = (e: Event) => {
  activeAccentColor.value = (e as CustomEvent<string>).detail;
};

onMounted(() => {
  loadCloudSettings();
  window.addEventListener('accent-color-applied', handleAccentColorApplied);
  const applied = document.documentElement.style.getPropertyValue('--accent').trim();
  if (applied) {
    activeAccentColor.value = applied;
  }
});

onUnmounted(() => {
  window.removeEventListener('accent-color-applied', handleAccentColorApplied);
});
</script>

<template>
  <div class="appearance-section mobile-adaptive">
    <section class="appearance-overview">
      <div>
        <p class="section-kicker">{{ label('外观语言', 'Appearance') }}</p>
        <h3 class="truncate">
          {{ currentAccentName }} ·
          {{ currentLanguage === 'zh-CN' ? label('简体中文', 'Chinese') : 'English' }}
        </h3>
        <span>{{
          isLoadingCloud
            ? label('正在读取云端偏好...', 'Loading cloud preferences...')
            : label(
                '本地立即生效，保存后同步到你的账号。',
                'Changes apply immediately and sync after saving.',
              )
        }}</span>
      </div>
      <div class="overview-actions mobile-row">
        <Button variant="secondary" :icon="RotateCcw" @click="resetLocal">
          {{ label('重置', 'Reset') }}
        </Button>
        <Button
          variant="primary"
          :disabled="!hasChanges || isSaving"
          :loading="isSaving"
          :icon="Save"
          @click="saveAppearance"
        >
          {{ label('保存到云端', 'Save to Cloud') }}
        </Button>
      </div>
    </section>

    <!-- 导航布局方案 (3套方案切换) -->
    <section class="theme-panel layout-panel p-4">
      <div class="panel-title mobile-row mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <LayoutGrid class="w-4 h-4 text-[var(--accent)]" />
          <span class="text-xs font-bold text-[var(--text-primary)]">{{
            label('导航布局方案', 'Navigation Layout Style')
          }}</span>
        </div>
        <strong class="truncate text-xs text-[var(--accent)] font-semibold">{{
          layoutOptions.find((item) => item.id === currentSidebarMode)?.label
        }}</strong>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          v-for="layout in layoutOptions"
          :key="layout.id"
          type="button"
          class="relative flex flex-col text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden group"
          :class="[
            currentSidebarMode === layout.id
              ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-sm shadow-[var(--accent)]/10'
              : 'border-[var(--border-base)] bg-[var(--bg-card)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]/30',
          ]"
          @click="applySidebarMode(layout.id)"
        >
          <div class="flex items-center justify-between w-full mb-2">
            <div class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                :class="[
                  currentSidebarMode === layout.id
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]',
                ]"
              >
                <component :is="layout.icon" class="w-3.5 h-3.5" />
              </div>
              <strong class="text-xs font-semibold text-[var(--text-primary)]">{{
                layout.label
              }}</strong>
            </div>
            <span
              class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
              :class="[
                currentSidebarMode === layout.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-hover)] text-[var(--text-muted)]',
              ]"
            >
              {{ layout.tag }}
            </span>
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-1 flex-1">
            {{ layout.description }}
          </p>
          <div
            class="flex items-center justify-between pt-2.5 mt-2.5 border-t border-[var(--border-base)]/40 w-full text-[10.5px]"
          >
            <span class="text-[var(--text-muted)]">
              {{ layout.styleTag }}
            </span>
            <CheckCircle2
              v-if="currentSidebarMode === layout.id"
              class="w-3.5 h-3.5 text-[var(--accent)]"
            />
          </div>
        </button>
      </div>
    </section>

    <section class="appearance-grid">
      <div class="theme-panel">
        <div class="panel-title mobile-row">
          <span>{{ label('主题模式', 'Theme Mode') }}</span>
          <strong class="truncate">{{
            themeOptions.find((item) => item.id === currentTheme)?.label
          }}</strong>
        </div>
        <div class="theme-options">
          <button
            v-for="theme in themeOptions"
            :key="theme.id"
            type="button"
            :class="{ active: currentTheme === theme.id }"
            @click="applyTheme(theme.id)"
          >
            <component :is="theme.icon" />
            <strong>{{ theme.label }}</strong>
            <span>{{ theme.description }}</span>
            <CheckCircle2 v-if="currentTheme === theme.id" class="check-icon" />
          </button>
        </div>

        <div
          class="panel-title mobile-row mt-6 pt-6 border-t"
          style="border-color: var(--border-base)"
        >
          <span>{{ label('背景画布', 'Background Canvas') }}</span>
          <strong class="truncate">{{
            backgroundOptions.find((item) => item.id === currentBackground)?.label
          }}</strong>
        </div>
        <div class="theme-options background-options">
          <button
            v-for="bg in backgroundOptions"
            :key="bg.id"
            type="button"
            :class="{ active: currentBackground === bg.id }"
            @click="applyBackground(bg.id)"
          >
            <i class="background-preview" :class="`background-preview--${bg.id}`"></i>
            <component :is="bg.icon" />
            <strong>{{ bg.label }}</strong>
            <span>{{ bg.description }}</span>
            <CheckCircle2 v-if="currentBackground === bg.id" class="check-icon" />
          </button>
        </div>
      </div>

      <div class="accent-panel">
        <div class="panel-title mobile-row">
          <span>{{ label('强调色', 'Accent Color') }}</span>
          <strong class="truncate">{{ currentAccentName }}</strong>
        </div>
        <div class="accent-grid">
          <button
            v-for="color in accentColors"
            :key="color.value"
            type="button"
            :class="{ active: activeAccentColor === color.value }"
            :style="{ '--swatch': color.value }"
            @click="applyAccentColor(color.value)"
          >
            <i></i>
            <span>{{ color.name }}</span>
          </button>
        </div>

        <div class="auto-switch-section">
          <div class="panel-title mb-2 mobile-row">
            <span>{{ label('切换模式', 'Switching Mode') }}</span>
          </div>
          <div class="mode-options">
            <button
              v-for="mode in modeOptions"
              :key="mode.id"
              type="button"
              class="mode-btn"
              :class="{ active: currentAccentMode === mode.id }"
              @click="applyAccentMode(mode.id)"
            >
              <span>{{ mode.label }}</span>
            </button>
          </div>

          <div v-if="currentAccentMode === 'interval'" class="interval-options-container">
            <div class="panel-title mb-2 mt-3 mobile-row">
              <span>{{ label('切换间隔', 'Interval') }}</span>
            </div>
            <div class="interval-options">
              <button
                v-for="opt in intervalOptions"
                :key="opt.value"
                type="button"
                class="interval-btn"
                :class="{ active: currentAccentInterval === opt.value }"
                @click="applyAccentInterval(opt.value)"
              >
                <span>{{ opt.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="language-panel">
        <div class="panel-title mobile-row">
          <span>{{ label('语言偏好', 'Language') }}</span>
          <Languages />
        </div>
        <div class="language-options">
          <button
            v-for="lang in languageOptions"
            :key="lang.value"
            type="button"
            :class="{ active: currentLanguage === lang.value }"
            @click="applyLanguage(lang.value)"
          >
            {{ lang.label }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.appearance-section {
  display: grid;
  gap: 12px;
}

.appearance-overview,
.theme-panel,
.accent-panel,
.language-panel {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.appearance-overview {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
}

.section-kicker,
.panel-title,
.appearance-overview span,
.theme-options span {
  color: var(--text-muted);
  font-size: 11px;
}

.section-kicker,
.panel-title {
  font-size: 11px;
  font-weight: 900;
}

h3 {
  margin: 1px 0 2px;
  font-size: 18px;
  font-weight: 900;
}

.overview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-action,
.secondary-action {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  padding: 0 12px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
}

.primary-action {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.secondary-action {
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
}

.primary-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

button svg {
  width: 14px;
  height: 14px;
}

.appearance-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.8fr);
  gap: 12px;
}

.theme-panel,
.accent-panel,
.language-panel {
  padding: 10px 12px;
}

.language-panel {
  grid-column: 1 / -1;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.panel-title strong {
  color: var(--text-primary);
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.theme-options button {
  position: relative;
  min-height: 88px;
  display: grid;
  align-content: center;
  gap: 4px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 10px;
  background: var(--bg-app);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.theme-options button.active {
  border-color: color-mix(in srgb, var(--accent) 72%, var(--border-base));
  background: color-mix(in srgb, var(--accent) 3%, var(--bg-app));
}

.theme-options button > svg:first-child {
  width: 20px;
  height: 20px;
  color: var(--accent);
}

.theme-options strong {
  font-size: 12.5px;
  font-weight: 900;
}

.background-options button {
  min-height: 122px;
  align-content: start;
}

.background-preview {
  position: relative;
  display: block;
  width: 100%;
  height: 42px;
  margin-bottom: 3px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border-base) 82%, transparent);
  border-radius: var(--radius-control);
  background: var(--bg-subtle);
}

.background-preview::before,
.background-preview::after {
  position: absolute;
  inset: 0;
  content: '';
}

.background-preview--grid {
  background-image:
    linear-gradient(color-mix(in srgb, var(--accent) 20%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--accent) 20%, transparent) 1px, transparent 1px);
  background-size: 10px 10px;
}

.background-preview--aurora {
  background:
    radial-gradient(
      ellipse at 78% 20%,
      color-mix(in srgb, var(--accent) 42%, transparent),
      transparent 56%
    ),
    radial-gradient(
      ellipse at 18% 85%,
      color-mix(in srgb, #38bdf8 26%, transparent),
      transparent 54%
    ),
    var(--bg-subtle);
}

.background-preview--blobs {
  background:
    radial-gradient(
      circle at 22% 80%,
      color-mix(in srgb, var(--accent) 52%, transparent),
      transparent 30%
    ),
    radial-gradient(
      circle at 84% 18%,
      color-mix(in srgb, #f472b6 38%, transparent),
      transparent 34%
    ),
    var(--bg-subtle);
}

.background-preview--dots {
  background:
    radial-gradient(
      ellipse at 88% 4%,
      color-mix(in srgb, var(--accent) 30%, transparent),
      transparent 70%
    ),
    linear-gradient(128deg, color-mix(in srgb, var(--bg-subtle) 84%, white), var(--bg-subtle));
}

.background-preview--prism {
  background:
    conic-gradient(
      from 210deg at 78% 24%,
      color-mix(in srgb, var(--accent) 44%, transparent),
      transparent 20%,
      color-mix(in srgb, #38bdf8 36%, transparent),
      transparent 48%,
      color-mix(in srgb, var(--accent) 38%, transparent)
    ),
    var(--bg-subtle);
}

.background-preview--prism::after {
  background: linear-gradient(
    115deg,
    transparent 28%,
    rgba(255, 255, 255, 0.7) 46%,
    transparent 58%
  );
}

.background-preview--solid {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bg-subtle) 92%, var(--accent)),
    var(--bg-subtle)
  );
}

.check-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  color: #047857;
}

.accent-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.accent-grid button {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--bg-app);
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}

.accent-grid button.active {
  border-color: var(--swatch);
  box-shadow: 0 0 0 1px var(--swatch) inset;
}

.accent-grid i {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--swatch);
}

.auto-switch-section {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-base);
}

.mode-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.mode-btn {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 11.5px;
  font-weight: 700;
  transition: all 0.2s ease;
  width: 100%;
}

.mode-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-app));
}

.interval-options-container {
  margin-top: 8px;
}

.interval-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.interval-btn {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 10.5px;
  font-weight: 700;
  transition: all 0.2s ease;
  width: 100%;
}

.interval-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-app));
}

.language-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.language-options button {
  height: 36px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: 900;
}

.language-options button.active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-app));
}

@media (max-width: 960px) {
  .appearance-overview {
    align-items: flex-start;
    flex-direction: column;
  }

  .appearance-grid,
  .theme-options {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .language-options,
  .accent-grid {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .overview-actions {
    width: 100%;
  }

  .primary-action,
  .secondary-action {
    justify-content: center;
    width: 100%;
  }
}
</style>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { CheckCircle2, Languages, Moon, RotateCcw, Save, Sun, SunMoon } from 'lucide-vue-next';
import {
  preferences,
  type LocalePreference,
  type ThemePreference,
  type AccentColorModePreference,
  type AccentColorIntervalPreference,
} from '@/utils/preferences';
import { applyAccentColorToDocument, applyThemeToDocument } from '@/composables/useAppearance';
import { fetchUserSettings, updateUserSettings } from '@/services/account.service';
import { setLocale } from '@/i18n';
import Button from '@/components/ui/Button.vue';

const currentTheme = ref<ThemePreference>(preferences.getTheme());
const currentAccent = ref(preferences.getAccentColor());
const activeAccentColor = ref(currentAccent.value);
const currentLanguage = ref<LocalePreference>(preferences.getLanguage());

const currentAccentMode = ref<AccentColorModePreference>(preferences.getAccentColorMode());
const currentAccentInterval = ref<AccentColorIntervalPreference>(preferences.getAccentColorInterval());

const savedSnapshot = ref('');
const isLoadingCloud = ref(false);
const isSaving = ref(false);
const { locale } = useI18n();
const label = (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);

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

const snapshot = computed(() =>
  JSON.stringify({
    theme: currentTheme.value,
    accent: currentAccent.value,
    language: currentLanguage.value,
    accentMode: currentAccentMode.value,
    accentInterval: currentAccentInterval.value,
  }),
);

const hasChanges = computed(() => snapshot.value !== savedSnapshot.value);

const currentAccentName = computed(() => {
  if (currentAccentMode.value === 'refresh') {
    return label('刷新随机', 'Random on Refresh');
  }
  if (currentAccentMode.value === 'interval') {
    const duration = currentAccentInterval.value === '10s' ? '10s' : 
                     currentAccentInterval.value === '1m' ? '1m' :
                     currentAccentInterval.value === '5m' ? '5m' : '30m';
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
    })
  );
};

const applyAccentMode = (mode: AccentColorModePreference) => {
  currentAccentMode.value = mode;
  preferences.setAccentColorMode(mode);

  window.dispatchEvent(
    new CustomEvent('accent-settings-changed', {
      detail: {
        color: currentAccent.value,
        mode: mode,
        interval: currentAccentInterval.value,
      },
    })
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
    })
  );
};

const applyLanguage = (lang: LocalePreference) => {
  currentLanguage.value = lang;
  void setLocale(lang);
};

const applyLoadedSettings = (settings: Record<string, string>) => {
  const theme = settings.appearanceTheme as ThemePreference | undefined;
  const accent = settings.appearanceAccent;
  const language = settings.appearanceLanguage as LocalePreference | undefined;
  const accentMode = settings.appearanceAccentMode as AccentColorModePreference | undefined;
  const accentInterval = settings.appearanceAccentInterval as AccentColorIntervalPreference | undefined;

  if (theme === 'glass-light' || theme === 'glass-dark' || theme === 'glass-auto') {
    applyTheme(theme);
  }
  if (language === 'zh-CN' || language === 'en-US') {
    applyLanguage(language);
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

  if (accentInterval === '10s' || accentInterval === '1m' || accentInterval === '5m' || accentInterval === '30m') {
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
    })
  );
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
      { key: 'appearanceAccent', value: currentAccent.value },
      { key: 'appearanceLanguage', value: currentLanguage.value },
      { key: 'appearanceAccentMode', value: currentAccentMode.value },
      { key: 'appearanceAccentInterval', value: currentAccentInterval.value },
    ]);
    savedSnapshot.value = snapshot.value;
    ElMessage.success(label('外观设置已同步', 'Appearance settings synced'));
  } catch {
    ElMessage.error(label('同步外观设置失败', 'Failed to sync appearance settings'));
  } finally {
    isSaving.value = false;
  }
};

const resetLocal = () => {
  applyTheme('glass-dark');
  applyAccentColor('#2563eb');
  applyAccentMode('static');
  applyAccentInterval('1m');
  applyLanguage('zh-CN');
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
  <div class="appearance-section">
    <section class="appearance-overview">
      <div>
        <p class="section-kicker">{{ label('外观语言', 'Appearance') }}</p>
        <h3>
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
      <div class="overview-actions">
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

    <section class="appearance-grid">
      <div class="theme-panel">
        <div class="panel-title">
          <span>{{ label('主题模式', 'Theme Mode') }}</span>
          <strong>{{ themeOptions.find((item) => item.id === currentTheme)?.label }}</strong>
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
      </div>

      <div class="accent-panel">
        <div class="panel-title">
          <span>{{ label('强调色', 'Accent Color') }}</span>
          <strong>{{ currentAccentName }}</strong>
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
          <div class="panel-title mb-2">
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
            <div class="panel-title mb-2 mt-3">
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
        <div class="panel-title">
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
  min-height: 82px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
}

.section-kicker,
.panel-title,
.appearance-overview span,
.theme-options span {
  color: var(--text-muted);
  font-size: 12px;
}

.section-kicker,
.panel-title {
  font-size: 11px;
  font-weight: 900;
}

h3 {
  margin: 2px 0 4px;
  font-size: 20px;
  font-weight: 900;
}

.overview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-action,
.secondary-action {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  padding: 0 12px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
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
  width: 15px;
  height: 15px;
}

.appearance-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.8fr);
  gap: 12px;
}

.theme-panel,
.accent-panel,
.language-panel {
  padding: 12px;
}

.language-panel {
  grid-column: 1 / -1;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
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
  min-height: 112px;
  display: grid;
  align-content: center;
  gap: 7px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-app);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.theme-options button.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-app));
}

.theme-options button > svg:first-child {
  width: 22px;
  height: 22px;
  color: var(--accent);
}

.theme-options strong {
  font-size: 13px;
  font-weight: 900;
}

.check-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  color: #047857;
}

.accent-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.accent-grid button {
  min-height: 48px;
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
  font-size: 13px;
  font-weight: 900;
}

.accent-grid button.active {
  border-color: var(--swatch);
  box-shadow: 0 0 0 1px var(--swatch) inset;
}

.accent-grid i {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--swatch);
}

.auto-switch-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-base);
}

.mode-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.mode-btn {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
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
  margin-top: 12px;
}

.interval-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.interval-btn {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
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
  height: 44px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
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
  .overview-actions,
  .language-options,
  .accent-grid {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .overview-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .primary-action,
  .secondary-action {
    justify-content: center;
    width: 100%;
  }
}
</style>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, onMounted, watch, computed } from 'vue';
import { Mail, Settings, Sparkles, Shield, Eye, EyeOff } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { useSettingsSync } from '@/composables/useSettingsSync';

interface SmtpConfig {
  id: string;
  name: string;
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

interface MicrosoftAccount {
  id: string;
  email?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'ERROR' | string;
  sentCountToday?: number;
  dailyLimit?: number;
  proxy?: string | null;
}

const props = defineProps<{
  settings: {
    SMTP_HOST: string;
    SMTP_PORT: string;
    SMTP_USER: string;
    SMTP_PASS: string;
    SMTP_FROM: string;
    SMTP_FROM_NAME: string;
    SMTP_SECURE: boolean;
    SMTP_CONFIGS: string;
    SMTP_ACTIVE_CONFIG_ID: string;
    SYSTEM_EMAIL_PROVIDER: string;
    MICROSOFT_POOL_FAILBACK: boolean;
  };
}>();

const emit = defineEmits<{
  (e: 'update:settings', val: typeof props.settings): void;
}>();

const { localSettings } = useSettingsSync(props, emit);

const showPassword = ref(false);
const isTestingSmtp = ref(false);
const smtpConfigs = ref<SmtpConfig[]>([]);
const activeConfigId = ref<string>('');

const selectSmtpConfig = (configId: string) => {
  const cfg = smtpConfigs.value.find((c) => c.id === configId);
  if (cfg) {
    activeConfigId.value = cfg.id;
    localSettings.SMTP_ACTIVE_CONFIG_ID = cfg.id;

    // Copy values to form fields
    localSettings.SMTP_HOST = cfg.host;
    localSettings.SMTP_PORT = cfg.port;
    localSettings.SMTP_USER = cfg.user;
    localSettings.SMTP_PASS = cfg.pass;
    localSettings.SMTP_FROM = cfg.from;
    localSettings.SMTP_SECURE = cfg.secure;
  }
};

const addNewSmtpConfig = async () => {
  try {
    const { value: name } = await ElMessageBox.prompt(
      t('admin.please_enter_a_new'),
      t('admin.added_email_configuration_plan'),
      {
        confirmButtonText: t('admin.ok'),
        cancelButtonText: t('admin.cancel'),
        inputPattern: /\S+/,
        inputErrorMessage: t('admin.scheme_name_cannot_be'),
      },
    );

    const newId = 'cfg_' + Date.now();
    const newCfg: SmtpConfig = {
      id: newId,
      name: name || '',
      host: '',
      port: '465',
      user: '',
      pass: '',
      from: '',
      secure: true,
    };

    smtpConfigs.value.push(newCfg);
    localSettings.SMTP_CONFIGS = JSON.stringify(smtpConfigs.value);

    // Auto select the new configuration
    selectSmtpConfig(newId);
    ElMessage.success(t('admin.scheme_name_has_been', { name: name }));
  } catch {
    // User canceled
  }
};

const renameSmtpConfig = async () => {
  const activeCfg = smtpConfigs.value.find((c) => c.id === activeConfigId.value);
  if (!activeCfg) return;

  try {
    const { value: name } = await ElMessageBox.prompt(
      t('admin.please_enter_a_new'),
      t('admin.rename_configuration_scheme'),
      {
        confirmButtonText: t('admin.ok'),
        cancelButtonText: t('admin.cancel'),
        inputPattern: /\S+/,
        inputErrorMessage: t('admin.scheme_name_cannot_be'),
        inputValue: activeCfg.name,
      },
    );

    activeCfg.name = name || '';
    localSettings.SMTP_CONFIGS = JSON.stringify(smtpConfigs.value);
    ElMessage.success(t('admin.scheme_renamed_successfully'));
  } catch {
    // User canceled
  }
};

const deleteSmtpConfig = async () => {
  if (smtpConfigs.value.length <= 1) {
    return ElMessage.warning(t('admin.at_least_one_configuration'));
  }

  const activeCfg = smtpConfigs.value.find((c) => c.id === activeConfigId.value);
  if (!activeCfg) return;

  try {
    await ElMessageBox.confirm(
      t('admin.are_you_sure_you_17', { activeCfgname: activeCfg.name }),
      t('admin.delete_configuration_plan'),
      {
        confirmButtonText: t('admin.confirm_deletion'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
      },
    );

    const index = smtpConfigs.value.findIndex((c) => c.id === activeConfigId.value);
    if (index !== -1) {
      smtpConfigs.value.splice(index, 1);
      localSettings.SMTP_CONFIGS = JSON.stringify(smtpConfigs.value);

      // Select the first configuration
      selectSmtpConfig(smtpConfigs.value[0].id);
      ElMessage.success(t('admin.plan_deleted'));
    }
  } catch {
    // User canceled
  }
};

watch(
  [
    () => localSettings.SMTP_HOST,
    () => localSettings.SMTP_PORT,
    () => localSettings.SMTP_USER,
    () => localSettings.SMTP_PASS,
    () => localSettings.SMTP_FROM,
    () => localSettings.SMTP_SECURE,
  ],
  () => {
    const activeCfg = smtpConfigs.value.find((cfg) => cfg.id === activeConfigId.value);
    if (activeCfg) {
      activeCfg.host = localSettings.SMTP_HOST || '';
      activeCfg.port = localSettings.SMTP_PORT || '465';
      activeCfg.user = localSettings.SMTP_USER || '';
      activeCfg.pass = localSettings.SMTP_PASS || '';
      activeCfg.from = localSettings.SMTP_FROM || '';
      activeCfg.secure = !!localSettings.SMTP_SECURE;

      localSettings.SMTP_CONFIGS = JSON.stringify(smtpConfigs.value);
    }
  },
);

watch(
  () => localSettings.SMTP_CONFIGS,
  (newVal) => {
    try {
      const parsed = JSON.parse(newVal || '[]');
      if (JSON.stringify(parsed) !== JSON.stringify(smtpConfigs.value)) {
        smtpConfigs.value = parsed;
      }
    } catch {
      smtpConfigs.value = [];
    }
  },
  { immediate: true },
);

watch(
  () => localSettings.SMTP_ACTIVE_CONFIG_ID,
  (newVal) => {
    if (newVal && newVal !== activeConfigId.value) {
      activeConfigId.value = newVal;
    }
  },
  { immediate: true },
);

// Microsoft accounts pool state
const microsoftAccounts = ref<MicrosoftAccount[]>([]);
const isLoadingAccounts = ref(false);

const fetchMicrosoftAccounts = async () => {
  try {
    isLoadingAccounts.value = true;
    const { data } = await api.get('/api/email/accounts');
    microsoftAccounts.value = data;
  } catch (error) {
    logError(error, { operation: 'admin.fetchMicrosoftAccounts', component: 'SmtpSettingsTab' });
  } finally {
    isLoadingAccounts.value = false;
  }
};

const microsoftPoolStats = computed(() => {
  const accounts = microsoftAccounts.value || [];
  const total = accounts.length;
  const active = accounts.filter((a) => a.status === 'ACTIVE').length;
  const expired = accounts.filter((a) => a.status === 'EXPIRED').length;
  const error = accounts.filter((a) => a.status === 'ERROR').length;

  const totalSentToday = accounts.reduce((acc, curr) => acc + (curr.sentCountToday || 0), 0);
  const totalDailyLimit = accounts.reduce((acc, curr) => acc + (curr.dailyLimit || 50), 0);

  const activeWithProxy = accounts.filter((a) => a.status === 'ACTIVE' && a.proxy).length;

  return {
    total,
    active,
    expired,
    error,
    totalSentToday,
    totalDailyLimit,
    activeWithProxy,
  };
});

const testSmtp = async () => {
  try {
    const { value: testRecipient } = await ElMessageBox.prompt(
      t('admin.please_enter_the_email'),
      t('admin.test_smtp_connection'),
      {
        confirmButtonText: t('admin.start_testing'),
        cancelButtonText: t('admin.cancel'),
        inputPattern:
          /[\w!#$%&'*+/=?^_`{|}~-]+(?:\.[\w!#$%&'*+/=?^_`{|}~-]+)*@(?:[\w](?:[\w-]*[\w])?\.)+[\w](?:[\w-]*[\w])?/,
        inputErrorMessage: t('admin.email_format_is_incorrect'),
        inputValue: localSettings.SMTP_FROM || localSettings.SMTP_USER || '',
      },
    );

    isTestingSmtp.value = true;
    const { data } = await api.post('/api/admin/settings/test-smtp', {
      host: localSettings.SMTP_HOST,
      port: localSettings.SMTP_PORT,
      user: localSettings.SMTP_USER,
      pass: localSettings.SMTP_PASS,
      from: localSettings.SMTP_FROM,
      secure: !!localSettings.SMTP_SECURE,
      to: testRecipient,
    });
    ElMessage.success(data.message);
  } catch (error) {
    if (error === 'cancel') return;
    logError(error, { operation: 'admin.testSmtp', component: 'SmtpSettingsTab' });
    ElMessage.error(getApiErrorMessage(error, t('admin.smtp_test_failed')));
  } finally {
    isTestingSmtp.value = false;
  }
};

onMounted(async () => {
  await fetchMicrosoftAccounts();
});
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- Mode selection -->
    <section
      class="p-4 sm:p-5 rounded-2xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-2 mb-4">
        <Settings class="w-4 h-4 text-indigo-500" />
        <h2 class="text-sm font-bold" style="color: var(--text-primary)">系统发信模式选择</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mobile-grid">
        <!-- Option 1: SMTP -->
        <div
          class="p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-4"
          :style="
            localSettings.SYSTEM_EMAIL_PROVIDER === 'SMTP'
              ? { borderColor: 'var(--accent)', backgroundColor: 'rgba(99,102,241,0.04)' }
              : { borderColor: 'var(--border-base)', backgroundColor: 'transparent' }
          "
          @click="localSettings.SYSTEM_EMAIL_PROVIDER = 'SMTP'"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0"
            >
              <Mail class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-xs font-bold" style="color: var(--text-primary)">标准 SMTP 发信</h3>
              <p class="text-[10px] mt-0.5 leading-normal" style="color: var(--text-muted)">
                通过独立 SMTP 服务器进行发信，支持 SSL/TLS 握手
              </p>
            </div>
          </div>
          <div class="shrink-0 flex items-center">
            <div
              class="w-4 h-4 rounded-full border flex items-center justify-center transition-all"
              :style="
                localSettings.SYSTEM_EMAIL_PROVIDER === 'SMTP'
                  ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent)' }
                  : { borderColor: 'var(--border-base)' }
              "
            >
              <div
                v-if="localSettings.SYSTEM_EMAIL_PROVIDER === 'SMTP'"
                class="w-1.5 h-1.5 rounded-full bg-white"
              ></div>
            </div>
          </div>
        </div>

        <!-- Option 2: Microsoft Account Pool -->
        <div
          class="p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-4"
          :style="
            localSettings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'
              ? { borderColor: 'var(--accent)', backgroundColor: 'rgba(99,102,241,0.04)' }
              : { borderColor: 'var(--border-base)', backgroundColor: 'transparent' }
          "
          @click="localSettings.SYSTEM_EMAIL_PROVIDER = 'MICROSOFT_POOL'"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0"
            >
              <Sparkles class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-xs font-bold" style="color: var(--text-primary)">
                微软 Graph 账号池 (防封版)
              </h3>
              <p class="text-[10px] mt-0.5 leading-normal" style="color: var(--text-muted)">
                支持 Outlook/Hotmail 轮询发信，抗封锁且支持代理
              </p>
            </div>
          </div>
          <div class="shrink-0 flex items-center">
            <div
              class="w-4 h-4 rounded-full border flex items-center justify-center transition-all"
              :style="
                localSettings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'
                  ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent)' }
                  : { borderColor: 'var(--border-base)' }
              "
            >
              <div
                v-if="localSettings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'"
                class="w-1.5 h-1.5 rounded-full bg-white"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Microsoft Account Pool Settings -->
    <section
      v-if="localSettings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'"
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300 space-y-6 animate-in"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Sparkles class="w-5 h-5 text-indigo-500" />
          <h2 class="text-lg font-bold" style="color: var(--text-primary)">
            微软邮箱账号池统计与配置
          </h2>
        </div>
        <router-link
          to="/tools/email"
          class="text-xs font-bold text-accent px-4 py-2 rounded-lg border border-accent/20 hover:bg-accent/5 transition-colors"
        >
          去账号池管理中心
        </router-link>
      </div>

      <!-- Pool Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mobile-grid">
        <div
          class="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
        >
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">{{
            $t('admin.total_account_in_the')
          }}</span>
          <span class="text-xl font-bold mt-2" style="color: var(--text-primary)">{{
            $t('admin.microsoftpoolstats_total', { count: microsoftPoolStats.total })
          }}</span>
        </div>
        <div
          class="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col justify-between"
        >
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
            >{{ $t('admin.running_healthily') }}</span
          >
          <span class="text-xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">{{
            $t('admin.microsoftpoolstats_active', { count: microsoftPoolStats.active })
          }}</span>
        </div>
        <div
          class="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col justify-between"
        >
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400"
            >{{ $t('admin.today_s_delivery_ratio') }}</span
          >
          <span class="text-xl font-bold mt-2 text-amber-600 dark:text-amber-400">
            {{ microsoftPoolStats.totalSentToday }} / {{ microsoftPoolStats.totalDailyLimit }} 封
          </span>
        </div>
        <div
          class="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col justify-between"
        >
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold"
            >{{ $t('admin.proxy_server_protection') }}</span
          >
          <span class="text-xl font-bold mt-2 text-indigo-600 dark:text-indigo-400">{{
            $t('admin.microsoftpoolstats_activewithproxy', {
              count: microsoftPoolStats.activeWithProxy,
            })
          }}</span>
        </div>
      </div>

      <!-- Anti-Ban Configurations -->
      <div class="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Shield class="w-4 h-4 text-indigo-600" />
            <div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                $t('admin.automatic_downgrade_and_disaster')
              }}</span>
              <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                当账号池为空、所有账号均达到每日限量，或发信异常时，系统自动切换为传统的 SMTP
                通道发送以防漏信
              </p>
            </div>
          </div>
          <Switch v-model="localSettings.MICROSOFT_POOL_FAILBACK" active-color="#6366f1" />
        </div>
      </div>

      <!-- Active Accounts List -->
      <div class="space-y-3">
        <h3 class="text-xs font-bold" style="color: var(--text-secondary)">发信账户池负载列表</h3>
        <div
          v-if="microsoftAccounts.length === 0"
          class="text-center py-6 text-xs text-slate-400 border border-dashed rounded-2xl"
        >
          暂无微软邮箱账号，请点击右上角去“账号池管理中心”导入账号
        </div>
        <div
          v-else
          class="max-h-60 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800"
        >
          <div
            v-for="account in microsoftAccounts"
            :key="account.id"
            class="p-3.5 flex items-center justify-between text-xs"
          >
            <div class="flex items-center gap-2.5">
              <span class="font-medium" style="color: var(--text-primary)">{{
                account.email
              }}</span>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-bold"
                :class="{
                  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':
                    account.status === 'ACTIVE',
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400':
                    account.status === 'EXPIRED',
                  'bg-rose-500/10 text-rose-600 dark:text-rose-400': account.status === 'ERROR',
                }"
              >
                {{
                  account.status === 'ACTIVE'
                    ? t('admin.normal')
                    : account.status === 'EXPIRED'
                      ? t('admin.token_expires')
                      : $t('admin.abnormal')
                }}
              </span>
            </div>
            <div class="flex items-center gap-4 text-slate-400 text-[10px]">
              <span v-if="account.proxy">{{
                $t('admin.proxy_account_proxy_split', { host: account.proxy.split('@').pop() })
              }}</span>
              <span
                >今日发信:
                <strong style="color: var(--text-secondary)">{{ account.sentCountToday }}</strong>
                / {{ account.dailyLimit }} 封</span
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SMTP Settings -->
    <section
      v-if="localSettings.SYSTEM_EMAIL_PROVIDER === 'SMTP' || localSettings.MICROSOFT_POOL_FAILBACK"
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300 animate-in"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 dark:border-white/5 pb-4"
      >
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <Mail class="w-5 h-5 text-accent" />
            <h2
              class="text-sm sm:text-base font-bold whitespace-nowrap"
              style="color: var(--text-primary)"
            >
              SMTP 配置
              <span
                v-if="localSettings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'"
                class="text-[10px] font-normal text-amber-500 ml-1"
                >{{ $t('admin.standby') }}</span
              >
            </h2>
          </div>

          <!-- 分割线 -->
          <span class="text-slate-300 dark:text-white/10">|</span>

          <!-- 一行展示：配置方案与管理按钮 -->
          <div class="flex items-center gap-2 text-xs">
            <span class="font-bold text-slate-400 whitespace-nowrap">{{
              $t('admin.solution')
            }}</span>
            <Select
              v-model="activeConfigId"
              :placeholder="$t('admin.options')"
              size="small"
              style="width: 110px"
              class="shrink-0 cursor-pointer"
              @change="selectSmtpConfig"
            >
              <SelectOption
                v-for="cfg in smtpConfigs"
                :key="cfg.id"
                :label="cfg.name"
                :value="cfg.id"
              />
            </Select>

            <button
              type="button"
              class="text-accent hover:underline font-medium px-1 whitespace-nowrap cursor-pointer bg-transparent border-none"
              @click="addNewSmtpConfig"
            >
              新增
            </button>
            <button
              type="button"
              class="text-amber-500 hover:underline font-medium px-1 whitespace-nowrap cursor-pointer bg-transparent border-none"
              @click="renameSmtpConfig"
            >
              重命名
            </button>
            <button
              type="button"
              :disabled="smtpConfigs.length <= 1"
              class="text-rose-500 hover:underline font-medium px-1 whitespace-nowrap disabled:opacity-30 disabled:no-underline cursor-pointer bg-transparent border-none"
              @click="deleteSmtpConfig"
            >
              删除
            </button>
          </div>
        </div>

        <button
          type="button"
          :disabled="isTestingSmtp"
          class="text-xs font-bold text-accent px-4 py-2 rounded-lg border border-accent/20 hover:bg-accent/5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer bg-transparent"
          @click="testSmtp"
        >
          {{ isTestingSmtp ? t('admin.trying_to_shake_hands') : $t('admin.test_connection') }}
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mobile-grid">
        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.server_address')
          }}</label>
          <input
            v-model="localSettings.SMTP_HOST"
            type="text"
            placeholder="smtp.gmail.com"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.port')
          }}</label>
          <input
            v-model="localSettings.SMTP_PORT"
            type="text"
            placeholder="465"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.account_user')
          }}</label>
          <input
            v-model="localSettings.SMTP_USER"
            type="text"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.authorization_code_pass')
          }}</label>
          <div class="relative">
            <input
              v-model="localSettings.SMTP_PASS"
              :type="showPassword ? 'text' : 'password'"
              class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
            <button
              type="button"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 bg-transparent border-none cursor-pointer"
              @click="showPassword = !showPassword"
            >
              <Eye v-if="!showPassword" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.sender_name')
          }}</label>
          <input
            v-model="localSettings.SMTP_FROM_NAME"
            type="text"
            placeholder="3D Learning Hub"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
          <p class="text-[10px] px-1" style="color: var(--text-muted)">收件人看到的发件人名称</p>
        </div>
        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">{{
            $t('admin.sender_email_from')
          }}</label>
          <input
            v-model="localSettings.SMTP_FROM"
            type="text"
            placeholder="noreply@example.com"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div class="flex items-center gap-3 pt-4 md:col-span-2">
          <Switch
            v-model="localSettings.SMTP_SECURE"
            :active-value="true"
            :inactive-value="false"
            active-color="#6366f1"
          />
          <span class="text-xs font-bold" style="color: var(--text-primary)">{{
            $t('admin.enable_ssl_tls_connections')
          }}</span>
          <span class="text-[10px] ml-2" style="color: var(--text-muted)">{{
            $t('admin.port_465_usually_needs')
          }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

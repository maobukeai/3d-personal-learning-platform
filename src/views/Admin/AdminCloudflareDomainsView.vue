<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import {
  Globe2,
  RefreshCw,
  ShieldCheck,
  Search,
  Plus,
  ExternalLink,
  KeyRound,
  Pause,
  Play,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { fetchManagementInsights } from './adminManagementInsights';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import UiButton from '@/components/ui/Button.vue';
import UiInput from '@/components/ui/Input.vue';
import AdminHeader from './components/AdminHeader.vue';
import DnsRecordList from './components/DnsRecordList.vue';
import DnsRecordForm, {
  type CloudflareDnsRecord,
  type DnsFormSubmitData,
} from './components/DnsRecordForm.vue';

interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  plan: string;
  nameServers: string[];
  createdOn: string;
  modifiedOn: string;
}

const savingConfig = ref(false);
const verifyingToken = ref(false);
const loadingZones = ref(false);
const loadingDns = ref(false);
const submittingDns = ref(false);
const togglingPause = ref(false);
const loadingZoneSettings = ref(false);

const hasToken = ref(false);
const accountId = ref('');
const apiTokenInput = ref('');

const zones = ref<CloudflareZone[]>([]);
const zoneSearch = ref('');
const selectedZone = ref<CloudflareZone | null>(null);
const dnsRecords = ref<CloudflareDnsRecord[]>([]);
const dnsSearch = ref('');
const searchQuery = ref('');

watch(searchQuery, (val) => {
  zoneSearch.value = val;
  dnsSearch.value = val;
});

const zoneSslMode = ref('');
const zoneSslStatus = ref('');

const dnsDialogVisible = ref(false);
const dnsDialogMode = ref<'create' | 'edit'>('create');
const editingRecord = ref<CloudflareDnsRecord | null>(null);

const consolidatedCards = computed(() => {
  const totalCount = zones.value.length;
  const activeCount = zones.value.filter((z) => z.status === 'active').length;
  const pausedCount = zones.value.filter((z) => z.paused).length;
  const apiStatus = hasToken.value ? '已配置' : '未配置';

  return [
    {
      label: '托管域名',
      value: totalCount,
      hint: `活跃: ${activeCount} / 暂停: ${pausedCount}`,
      icon: Globe2,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      health: { label: totalCount > 0 ? '已连接' : '无域名' },
    },
    {
      label: '活跃 Zone',
      value: activeCount,
      hint: '正常接收解析请求',
      icon: ShieldCheck,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: activeCount > 0 ? '正常' : '无活跃' },
    },
    {
      label: '暂停域名',
      value: pausedCount,
      hint: '流量绕过 Cloudflare',
      icon: Pause,
      color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      health: { label: pausedCount > 0 ? '有暂停' : '无暂停' },
    },
    {
      label: 'API Token',
      value: apiStatus,
      hint: accountId.value
        ? `Account ID: ${accountId.value.slice(0, 8)}...`
        : '独立于 R2 存储配置',
      icon: KeyRound,
      color: hasToken.value
        ? 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20'
        : 'text-rose-600 bg-rose-500/10 border-rose-500/20',
      health: { label: apiStatus },
    },
  ];
});

const filteredZones = computed(() => {
  const q = zoneSearch.value.trim().toLowerCase();
  if (!q) return zones.value;
  return zones.value.filter((zone) => zone.name.toLowerCase().includes(q));
});

const filteredDnsRecords = computed(() => {
  const q = dnsSearch.value.trim().toLowerCase();
  if (!q) return dnsRecords.value;
  return dnsRecords.value.filter(
    (record) =>
      record.name.toLowerCase().includes(q) ||
      record.content.toLowerCase().includes(q) ||
      record.type.toLowerCase().includes(q),
  );
});

const sslModeLabel = (mode: string) => {
  const map: Record<string, string> = {
    off: '关闭',
    flexible: '灵活',
    full: '完全',
    strict: '严格',
  };
  return map[mode] || mode || '未知';
};

const sslStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    active: '证书有效',
    pending_validation: '待验证',
    pending_issuance: '签发中',
    pending_deployment: '部署中',
    disabled: '已关闭',
    unknown: '未知',
  };
  return map[status] || status || '未知';
};

const loadingRevealedSecrets = ref(false);
const showPlaintextSecrets = ref(false);

const handleRevealSecrets = async () => {
  if (showPlaintextSecrets.value) {
    showPlaintextSecrets.value = false;
    apiTokenInput.value = '';
    return;
  }

  loadingRevealedSecrets.value = true;
  try {
    const { data } = await api.get('/api/admin/cloudflare/config/reveal-secrets');
    apiTokenInput.value = data.apiToken || '';
    showPlaintextSecrets.value = true;
    ElMessage.success('已成功解密并解封显示 Cloudflare API Token！');
  } catch (err) {
    ElMessage.error(getApiErrorMessage(err, '读取或解密密钥失败'));
  } finally {
    loadingRevealedSecrets.value = false;
  }
};

const fetchConfig = async () => {
  try {
    const { data } = await api.get('/api/admin/cloudflare/config');
    hasToken.value = !!data.hasToken;
    accountId.value = data.accountId || '';
    apiTokenInput.value = '';
    showPlaintextSecrets.value = false;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '获取 Cloudflare 配置失败'));
  }
};

const clearingConfig = ref(false);

const saveConfig = async () => {
  const tokenToSave = apiTokenInput.value.trim();
  if (!tokenToSave && !hasToken.value) {
    return ElMessage.warning('请填写 Cloudflare API Token');
  }

  savingConfig.value = true;
  try {
    const { data } = await api.put('/api/admin/cloudflare/config', {
      ...(tokenToSave ? { apiToken: tokenToSave } : {}),
      accountId: accountId.value.trim() || null,
    });
    hasToken.value = !!data.hasToken;
    accountId.value = data.accountId || '';
    apiTokenInput.value = '';
    showPlaintextSecrets.value = false;
    ElMessage.success('Cloudflare 配置已保存');
    await fetchZones();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存配置失败'));
  } finally {
    savingConfig.value = false;
  }
};

const clearConfig = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空 Cloudflare 域名管理的 API Token 和 Account ID 配置吗？该操作不可撤销。',
      '确认清空',
      {
        type: 'warning',
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
      },
    );
  } catch {
    return;
  }

  clearingConfig.value = true;
  try {
    await api.delete('/api/admin/cloudflare/config');
    hasToken.value = false;
    accountId.value = '';
    apiTokenInput.value = '';
    showPlaintextSecrets.value = false;
    zones.value = [];
    selectedZone.value = null;
    dnsRecords.value = [];
    ElMessage.success('配置已成功清空');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '清空配置失败'));
  } finally {
    clearingConfig.value = false;
  }
};

const verifyToken = async () => {
  verifyingToken.value = true;
  try {
    await api.post('/api/admin/cloudflare/verify', {
      apiToken: apiTokenInput.value.trim() || undefined,
    });
    ElMessage.success('Token 验证通过');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, 'Token 验证失败'));
  } finally {
    verifyingToken.value = false;
  }
};

const fetchZones = async () => {
  if (!hasToken.value) return;
  loadingZones.value = true;
  try {
    const { data } = await api.get('/api/admin/cloudflare/zones');
    zones.value = data;
    if (selectedZone.value) {
      selectedZone.value =
        data.find((z: CloudflareZone) => z.id === selectedZone.value?.id) || null;
    }
    fetchManagementInsights(true);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '获取域名列表失败'));
  } finally {
    loadingZones.value = false;
  }
};

const fetchZoneSettings = async () => {
  if (!selectedZone.value) return;
  loadingZoneSettings.value = true;
  try {
    const { data } = await api.get(`/api/admin/cloudflare/zones/${selectedZone.value.id}/settings`);
    zoneSslMode.value = data.sslMode || '';
    zoneSslStatus.value = data.sslStatus || '';
  } catch (error) {
    zoneSslMode.value = '';
    zoneSslStatus.value = '';
    ElMessage.error(getApiErrorMessage(error, '获取 SSL 状态失败'));
  } finally {
    loadingZoneSettings.value = false;
  }
};

const selectZone = async (zone: CloudflareZone) => {
  selectedZone.value = zone;
  dnsSearch.value = '';
  await Promise.all([fetchDnsRecords(), fetchZoneSettings()]);
};

const fetchDnsRecords = async () => {
  if (!selectedZone.value) return;
  loadingDns.value = true;
  try {
    const { data } = await api.get(`/api/admin/cloudflare/zones/${selectedZone.value.id}/dns`);
    dnsRecords.value = data;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '获取 DNS 记录失败'));
  } finally {
    loadingDns.value = false;
  }
};

const toggleZonePause = async () => {
  if (!selectedZone.value) return;
  const nextPaused = !selectedZone.value.paused;
  const actionLabel = nextPaused ? '暂停' : '恢复';

  try {
    await ElMessageBox.confirm(
      `确定要${actionLabel}域名 ${selectedZone.value.name} 吗？${nextPaused ? '暂停后该域名将不再代理流量。' : ''}`,
      `${actionLabel} Zone`,
      { type: 'warning', confirmButtonText: actionLabel, cancelButtonText: '取消' },
    );
  } catch {
    return;
  }

  togglingPause.value = true;
  try {
    const { data } = await api.patch(`/api/admin/cloudflare/zones/${selectedZone.value.id}/pause`, {
      paused: nextPaused,
    });
    selectedZone.value = {
      ...selectedZone.value,
      paused: data.paused,
      status: data.status || selectedZone.value.status,
    };
    zones.value = zones.value.map((zone) =>
      zone.id === selectedZone.value?.id
        ? { ...zone, paused: data.paused, status: data.status || zone.status }
        : zone,
    );
    ElMessage.success(`域名已${actionLabel}`);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, `${actionLabel}失败`));
  } finally {
    togglingPause.value = false;
  }
};

const openCreateDns = () => {
  if (!selectedZone.value) return;
  dnsDialogMode.value = 'create';
  editingRecord.value = null;
  dnsDialogVisible.value = true;
};

const openEditDns = (record: CloudflareDnsRecord) => {
  if (!selectedZone.value) return;
  dnsDialogMode.value = 'edit';
  editingRecord.value = record;
  dnsDialogVisible.value = true;
};

const submitDnsForm = async (data: DnsFormSubmitData) => {
  if (!selectedZone.value) return;

  submittingDns.value = true;
  try {
    if (data.mode === 'create') {
      await api.post(`/api/admin/cloudflare/zones/${selectedZone.value.id}/dns`, data.payload);
      ElMessage.success('DNS 记录已创建');
    } else if (data.recordId) {
      await api.patch(
        `/api/admin/cloudflare/zones/${selectedZone.value.id}/dns/${data.recordId}`,
        data.payload,
      );
      ElMessage.success('DNS 记录已更新');
    }

    dnsDialogVisible.value = false;
    await fetchDnsRecords();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存 DNS 记录失败'));
  } finally {
    submittingDns.value = false;
  }
};

const deleteDnsRecord = async (record: CloudflareDnsRecord) => {
  if (!selectedZone.value) return;
  try {
    await ElMessageBox.confirm(`确定删除 DNS 记录 ${record.type} ${record.name} 吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
    await api.delete(`/api/admin/cloudflare/zones/${selectedZone.value.id}/dns/${record.id}`);
    ElMessage.success('DNS 记录已删除');
    await fetchDnsRecords();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '删除 DNS 记录失败'));
    }
  }
};

const openCloudflareDashboard = (zone?: CloudflareZone) => {
  const url = zone
    ? `https://dash.cloudflare.com/?to=/:${zone.id}/dns/records`
    : 'https://dash.cloudflare.com/';
  window.open(url, '_blank', 'noopener,noreferrer');
};

onMounted(async () => {
  await fetchConfig();
  if (hasToken.value) {
    await fetchZones();
  }
});
</script>

<template>
  <div
    class="admin-cloudflare-page flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)] mobile-adaptive"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide">
      <!-- Ultra-Compact Single Row Header -->
      <AdminHeader
        title="Cloudflare 域名管理"
        :cards="consolidatedCards"
        v-model="searchQuery"
        placeholder="搜索域名/DNS记录..."
      >
        <template #title-badge>
          <div class="flex flex-wrap items-center gap-1.5">
            <Badge variant="info"> 域名数: {{ zones.length }} </Badge>
          </div>
        </template>

        <UiButton
          variant="outline"
          size="sm"
          :icon="ExternalLink"
          @click="openCloudflareDashboard()"
          class="!h-7.5 !text-xs !px-2.5"
        >
          <span class="hidden sm:inline">控制台</span>
        </UiButton>
        <UiButton
          variant="primary"
          size="sm"
          :icon="RefreshCw"
          :loading="loadingZones"
          :disabled="!hasToken"
          @click="fetchZones"
          class="!h-7.5 !text-xs !px-2.5"
        >
          刷新
        </UiButton>
      </AdminHeader>
      <!-- Workspace layout: Single Column Workspace -->
      <div class="mt-3 w-full min-w-0">
        <div class="space-y-3 min-w-0">
          <Card padding="md" class="blender-card mb-3">
            <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4">
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <div
                    class="flex items-center gap-2 text-xs font-bold"
                    style="color: var(--text-primary)"
                  >
                    <KeyRound class="w-4 h-4 text-accent" />
                    API Token 配置
                    <span
                      v-if="hasToken"
                      class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600"
                    >
                      已配置
                    </span>
                    <span
                      v-else
                      class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600"
                    >
                      未配置
                    </span>
                  </div>

                  <button
                    v-if="hasToken"
                    type="button"
                    class="text-[11px] text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 font-medium transition-colors outline-none"
                    @click="handleRevealSecrets"
                  >
                    <component :is="showPlaintextSecrets ? EyeOff : Eye" class="w-3.5 h-3.5" />
                    <span>{{
                      loadingRevealedSecrets
                        ? '正在解密...'
                        : showPlaintextSecrets
                          ? '隐藏明文 Token'
                          : '管理员查看已存密钥'
                    }}</span>
                  </button>
                </div>

                <UiInput
                  v-model="apiTokenInput"
                  :type="showPlaintextSecrets ? 'text' : 'password'"
                  :placeholder="
                    hasToken
                      ? showPlaintextSecrets
                        ? '已成功解密 API Token，可直接编辑修改'
                        : '已保存 Token，输入新 Token 可覆盖'
                      : 'Cloudflare API Token（Zone:Read, DNS:Edit）'
                  "
                  :glass="false"
                  input-class="text-xs font-mono"
                />

                <div class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2">
                  <UiInput
                    v-model="accountId"
                    placeholder="Account ID（可选）"
                    :glass="false"
                    input-class="text-xs font-mono"
                  />
                  <UiButton
                    variant="outline"
                    size="sm"
                    :disabled="verifyingToken"
                    @click="verifyToken"
                  >
                    {{ verifyingToken ? '验证中...' : '验证' }}
                  </UiButton>
                  <UiButton
                    variant="primary"
                    size="sm"
                    :disabled="savingConfig"
                    @click="saveConfig"
                  >
                    {{ savingConfig ? '保存中...' : '保存' }}
                  </UiButton>
                  <UiButton
                    v-if="hasToken"
                    variant="danger"
                    size="sm"
                    :disabled="clearingConfig"
                    @click="clearConfig"
                  >
                    {{ clearingConfig ? '清空中...' : '清空' }}
                  </UiButton>
                </div>
              </div>

              <div
                class="text-[11px] leading-relaxed rounded-xl border p-3"
                style="border-color: var(--border-base); color: var(--text-secondary)"
              >
                <p class="font-bold mb-1.5" style="color: var(--text-primary)">功能说明</p>
                <ul class="space-y-1">
                  <li>· 支持 DNS 增删改、SSL 状态查看、Zone 暂停/恢复</li>
                  <li>· SSL/TLS 模式修改、Page Rules 等请在 Cloudflare 控制台操作</li>
                  <li>· 此 Token 独立于 R2 存储配置</li>
                </ul>
              </div>
            </div>
          </Card>

          <div class="grid grid-cols-1 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-3">
            <Card padding="md" class="flex flex-col min-h-[420px]">
              <div class="flex items-center justify-between gap-2 mb-3">
                <h2 class="text-sm font-black" style="color: var(--text-primary)">域名列表</h2>
                <span
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5"
                  style="color: var(--text-secondary)"
                >
                  {{ zones.length }} 个
                </span>
              </div>

              <div
                v-if="!hasToken"
                class="flex-1 grid place-items-center text-xs text-center px-4"
                style="color: var(--text-muted)"
              >
                请先配置并保存 Cloudflare API Token
              </div>
              <div v-else-if="loadingZones" class="flex-1 grid place-items-center">
                <RefreshCw class="w-5 h-5 animate-spin text-accent" />
              </div>
              <div v-else class="flex-1 overflow-y-auto space-y-2 pr-1">
                <button
                  v-for="zone in filteredZones"
                  :key="zone.id"
                  type="button"
                  class="w-full text-left rounded-xl border px-3 py-2.5 transition-all cursor-pointer"
                  :class="
                    selectedZone?.id === zone.id ? 'border-accent bg-accent/5' : 'hover:bg-hover'
                  "
                  :style="{
                    borderColor: selectedZone?.id === zone.id ? undefined : 'var(--border-base)',
                  }"
                  @click="selectZone(zone)"
                >
                  <div class="flex items-center justify-between gap-2">
                    <strong class="text-xs truncate" style="color: var(--text-primary)">{{
                      zone.name
                    }}</strong>
                    <span
                      class="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      :class="
                        zone.status === 'active'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-amber-50 text-amber-600'
                      "
                    >
                      {{ zone.status }}
                    </span>
                  </div>
                  <div
                    class="mt-1 text-[10px] flex flex-wrap items-center gap-1.5"
                    style="color: var(--text-secondary)"
                  >
                    <span>{{ zone.plan }} · {{ zone.type }}</span>
                    <span
                      v-if="zone.paused"
                      class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600"
                      >已暂停</span
                    >
                  </div>
                </button>
              </div>
            </Card>

            <Card v-if="selectedZone" padding="md" class="flex flex-col min-h-[420px]">
              <div
                class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3 pb-3 border-b"
                style="border-color: var(--border-base)"
              >
                <div class="min-w-0">
                  <h2 class="text-sm font-black truncate" style="color: var(--text-primary)">
                    {{ selectedZone.name }}
                  </h2>
                  <p class="text-[10px] mt-0.5 truncate" style="color: var(--text-secondary)">
                    NS: {{ selectedZone.nameServers.join(', ') || '—' }}
                  </p>
                  <div class="flex flex-wrap items-center gap-2 mt-2">
                    <span
                      v-if="loadingZoneSettings"
                      class="text-[10px]"
                      style="color: var(--text-muted)"
                    >
                      SSL 加载中...
                    </span>
                    <template v-else-if="zoneSslMode">
                      <span
                        class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600"
                      >
                        <Lock class="w-3 h-3" />
                        SSL: {{ sslModeLabel(zoneSslMode) }}
                      </span>
                      <span
                        class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600"
                      >
                        {{ sslStatusLabel(zoneSslStatus) }}
                      </span>
                    </template>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    :disabled="togglingPause"
                    class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer disabled:opacity-50"
                    :class="
                      selectedZone.paused
                        ? 'text-emerald-600 border-emerald-500/30'
                        : 'text-amber-600 border-amber-500/30'
                    "
                    style="border-color: var(--border-base)"
                    @click="toggleZonePause"
                  >
                    <Play v-if="selectedZone.paused" class="w-3 h-3" />
                    <Pause v-else class="w-3 h-3" />
                    {{ selectedZone.paused ? '恢复 Zone' : '暂停 Zone' }}
                  </button>
                  <UiButton
                    variant="outline"
                    size="sm"
                    :icon="ExternalLink"
                    @click="openCloudflareDashboard(selectedZone)"
                  >
                    控制台
                  </UiButton>
                  <UiButton variant="primary" size="sm" :icon="Plus" @click="openCreateDns">
                    添加 DNS
                  </UiButton>
                </div>
              </div>

              <DnsRecordList
                :records="filteredDnsRecords"
                :loading="loadingDns"
                @edit="openEditDns"
                @delete="deleteDnsRecord"
              />
            </Card>

            <Card v-else padding="md" class="flex flex-col min-h-[420px]">
              <div
                class="flex-1 grid place-items-center text-xs text-center px-6"
                style="color: var(--text-muted)"
              >
                <div class="space-y-2">
                  <ShieldCheck class="w-8 h-8 mx-auto opacity-40" />
                  <p>从左侧选择一个域名，查看 DNS 与 SSL 状态</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>

    <DnsRecordForm
      v-model="dnsDialogVisible"
      :mode="dnsDialogMode"
      :zone-name="selectedZone?.name || ''"
      :record="editingRecord"
      :loading="submittingDns"
      @submit="submitDnsForm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import {
  Globe2,
  RefreshCw,
  ShieldCheck,
  Search,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  KeyRound,
  Pause,
  Play,
  Lock,
  Cloud,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import AdminOpsPanel from './components/AdminOpsPanel.vue';
import { fetchManagementInsights } from './adminManagementInsights';

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

interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  priority?: number;
  data?: any;
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
const zoneSslMode = ref('');
const zoneSslStatus = ref('');

const dnsDialogVisible = ref(false);
const dnsDialogMode = ref<'create' | 'edit'>('create');
const editingRecord = ref<CloudflareDnsRecord | null>(null);
const dnsForm = ref({
  type: 'A',
  name: '',
  content: '',
  proxied: true,
  ttl: 1,
  priority: 10,
  // SRV fields
  srvService: '_sip',
  srvProtocol: '_tcp',
  srvWeight: 5,
  srvPort: 5060,
  srvTarget: '',
  // CAA fields
  caaFlags: 0,
  caaTag: 'issue',
  caaValue: '',
});

const contentLabel = computed(() => {
  const map: Record<string, string> = {
    A: 'IPv4 地址',
    AAAA: 'IPv6 地址',
    CNAME: '目标域名',
    TXT: 'TXT 内容',
    NS: '名称服务器',
    MX: '邮件服务器',
  };
  return map[dnsForm.value.type] || '内容';
});

const contentPlaceholder = computed(() => {
  const map: Record<string, string> = {
    A: '例如：192.0.2.1',
    AAAA: '例如：2001:db8::1',
    CNAME: '例如：cdn.example.com',
    TXT: 'TXT 记录的文本内容',
    NS: '例如：ns1.cloudflare.com',
    MX: '例如：mail.example.com',
  };
  return map[dnsForm.value.type] || '输入记录内容';
});

const namePreview = computed(() => {
  const name = dnsForm.value.name.trim();
  const zoneName = selectedZone.value?.name || '';
  
  if (dnsForm.value.type === 'SRV') {
    const service = dnsForm.value.srvService.trim();
    const proto = dnsForm.value.srvProtocol.trim();
    let domainPart = name;
    if (domainPart === '@' || !domainPart) {
      domainPart = zoneName;
    } else if (!domainPart.endsWith(zoneName)) {
      domainPart = `${domainPart}.${zoneName}`;
    }
    if (service && proto) {
      return `${service}.${proto}.${domainPart}`;
    }
    return domainPart;
  }
  
  if (!name || name === '@') return zoneName;
  if (name.endsWith(zoneName)) return name;
  return `${name}.${zoneName}`;
});

// Watch type change to reset proxy status
watch(() => dnsForm.value.type, (newType) => {
  if (!['A', 'AAAA', 'CNAME'].includes(newType)) {
    dnsForm.value.proxied = false;
  } else {
    dnsForm.value.proxied = true;
  }
});

// Watch proxied to force TTL to Auto
watch(() => dnsForm.value.proxied, (isProxied) => {
  if (isProxied && ['A', 'AAAA', 'CNAME'].includes(dnsForm.value.type)) {
    dnsForm.value.ttl = 1;
  }
});

const validateDnsForm = (): boolean => {
  const type = dnsForm.value.type;
  const name = dnsForm.value.name.trim();

  if (!name) {
    ElMessage.warning('请填写名称');
    return false;
  }

  if (name !== '@') {
    const nameRegex = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/;
    if (!nameRegex.test(name)) {
      ElMessage.warning('名称格式不正确（只能包含字母、数字、下划线、横杠和点）');
      return false;
    }
  }

  if (type === 'A') {
    const ip = dnsForm.value.content.trim();
    const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    if (!ipv4Regex.test(ip)) {
      ElMessage.warning('请输入有效的 IPv4 地址');
      return false;
    }
  } else if (type === 'AAAA') {
    const ip = dnsForm.value.content.trim();
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    if (!ipv6Regex.test(ip)) {
      ElMessage.warning('请输入有效的 IPv6 地址');
      return false;
    }
  } else if (type === 'CNAME' || type === 'NS') {
    const target = dnsForm.value.content.trim();
    if (!target) {
      ElMessage.warning('请填写目标内容');
      return false;
    }
    const domainRegex = /^([a-zA-Z0-9_-]+\.)*[a-zA-Z0-9_-]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(target)) {
      ElMessage.warning('请输入有效的目标域名');
      return false;
    }
  } else if (type === 'MX') {
    const server = dnsForm.value.content.trim();
    if (!server) {
      ElMessage.warning('请填写邮件服务器');
      return false;
    }
    const domainRegex = /^([a-zA-Z0-9_-]+\.)*[a-zA-Z0-9_-]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(server)) {
      ElMessage.warning('请输入有效的邮件服务器域名');
      return false;
    }
    if (dnsForm.value.priority === undefined || dnsForm.value.priority < 0 || dnsForm.value.priority > 65535) {
      ElMessage.warning('优先级必须在 0 到 65535 之间');
      return false;
    }
  } else if (type === 'TXT') {
    if (!dnsForm.value.content.trim()) {
      ElMessage.warning('请填写 TXT 内容');
      return false;
    }
  } else if (type === 'SRV') {
    if (!dnsForm.value.srvService.trim()) {
      ElMessage.warning('请填写服务名称（如 _sip）');
      return false;
    }
    if (!dnsForm.value.srvProtocol.trim()) {
      ElMessage.warning('请选择协议');
      return false;
    }
    if (!dnsForm.value.srvTarget.trim()) {
      ElMessage.warning('请填写目标主机');
      return false;
    }
    const domainRegex = /^([a-zA-Z0-9_-]+\.)*[a-zA-Z0-9_-]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(dnsForm.value.srvTarget.trim())) {
      ElMessage.warning('请输入有效的目标主机域名');
      return false;
    }
    if (dnsForm.value.priority === undefined || dnsForm.value.priority < 0 || dnsForm.value.priority > 65535) {
      ElMessage.warning('优先级必须在 0 到 65535 之间');
      return false;
    }
    if (dnsForm.value.srvWeight === undefined || dnsForm.value.srvWeight < 0 || dnsForm.value.srvWeight > 65535) {
      ElMessage.warning('权重必须在 0 到 65535 之间');
      return false;
    }
    if (dnsForm.value.srvPort === undefined || dnsForm.value.srvPort < 1 || dnsForm.value.srvPort > 65535) {
      ElMessage.warning('端口必须在 1 到 65535 之间');
      return false;
    }
  } else if (type === 'CAA') {
    if (!dnsForm.value.caaValue.trim()) {
      ElMessage.warning('请填写 CA 域名值');
      return false;
    }
    if (dnsForm.value.caaFlags === undefined || dnsForm.value.caaFlags < 0 || dnsForm.value.caaFlags > 255) {
      ElMessage.warning('标志位必须在 0 到 255 之间');
      return false;
    }
  }

  return true;
};

const formatTtl = (ttl: number) => {
  if (ttl === 1) return 'Auto';
  if (ttl >= 86400) return `${ttl / 86400} day`;
  if (ttl >= 3600) return `${ttl / 3600} hr`;
  if (ttl >= 60) return `${ttl / 60} min`;
  return `${ttl}s`;
};

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

const fetchConfig = async () => {
  try {
    const { data } = await api.get('/api/admin/cloudflare/config');
    hasToken.value = !!data.hasToken;
    accountId.value = data.accountId || '';
    apiTokenInput.value = '';
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
    await ElMessageBox.confirm('确定要清空 Cloudflare 域名管理的 API Token 和 Account ID 配置吗？该操作不可撤销。', '确认清空', {
      type: 'warning',
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }

  clearingConfig.value = true;
  try {
    await api.delete('/api/admin/cloudflare/config');
    hasToken.value = false;
    accountId.value = '';
    apiTokenInput.value = '';
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
      selectedZone.value = data.find((z: CloudflareZone) => z.id === selectedZone.value?.id) || null;
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
    selectedZone.value = { ...selectedZone.value, paused: data.paused, status: data.status || selectedZone.value.status };
    zones.value = zones.value.map((zone) =>
      zone.id === selectedZone.value?.id ? { ...zone, paused: data.paused, status: data.status || zone.status } : zone,
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
  dnsForm.value = {
    type: 'A',
    name: '@',
    content: '',
    proxied: true,
    ttl: 1,
    priority: 10,
    srvService: '_sip',
    srvProtocol: '_tcp',
    srvWeight: 5,
    srvPort: 5060,
    srvTarget: '',
    caaFlags: 0,
    caaTag: 'issue',
    caaValue: '',
  };
  dnsDialogVisible.value = true;
};

const openEditDns = (record: CloudflareDnsRecord) => {
  if (!selectedZone.value) return;
  dnsDialogMode.value = 'edit';
  editingRecord.value = record;

  let displayName = record.name;
  if (record.type === 'SRV' && record.data?.service && record.data?.proto) {
    const prefix = `${record.data.service}.${record.data.proto}.`;
    if (displayName.startsWith(prefix)) {
      displayName = displayName.slice(prefix.length);
    }
  }

  const zoneName = selectedZone.value.name;
  if (displayName === zoneName) {
    displayName = '@';
  } else if (displayName.endsWith('.' + zoneName)) {
    displayName = displayName.slice(0, -(zoneName.length + 1));
  }

  dnsForm.value = {
    type: record.type,
    name: displayName,
    content: record.content,
    proxied: record.proxied,
    ttl: record.ttl,
    priority: record.priority ?? 10,
    // SRV
    srvService: record.data?.service || '',
    srvProtocol: record.data?.proto || '_tcp',
    srvWeight: record.data?.weight ?? 5,
    srvPort: record.data?.port ?? 5060,
    srvTarget: record.data?.target || '',
    // CAA
    caaFlags: record.data?.flags ?? 0,
    caaTag: record.data?.tag || 'issue',
    caaValue: record.data?.value || '',
  };
  dnsDialogVisible.value = true;
};

const submitDnsForm = async () => {
  if (!selectedZone.value) return;
  
  if (!validateDnsForm()) {
    return;
  }

  const type = dnsForm.value.type;
  const rawName = dnsForm.value.name.trim();
  let relativeName = rawName;
  if (rawName === '@' || !rawName) {
    relativeName = selectedZone.value.name;
  } else if (!rawName.endsWith(selectedZone.value.name)) {
    relativeName = `${rawName}.${selectedZone.value.name}`;
  }

  submittingDns.value = true;
  try {
    const isProxyable = ['A', 'AAAA', 'CNAME'].includes(type);
    
    let payload: any = {
      type,
      name: relativeName,
      ttl: dnsForm.value.ttl,
    };

    if (type === 'SRV') {
      const service = dnsForm.value.srvService.trim();
      const proto = dnsForm.value.srvProtocol.trim();
      let fullName = relativeName;
      if (service && proto) {
        const prefix = `${service}.${proto}.`;
        if (!relativeName.startsWith(prefix)) {
          fullName = `${prefix}${relativeName}`;
        }
      }
      
      payload.name = fullName;
      payload.data = {
        service,
        proto,
        name: relativeName,
        priority: dnsForm.value.priority,
        weight: dnsForm.value.srvWeight,
        port: dnsForm.value.srvPort,
        target: dnsForm.value.srvTarget.trim(),
      };
    } else if (type === 'CAA') {
      payload.data = {
        flags: dnsForm.value.caaFlags,
        tag: dnsForm.value.caaTag,
        value: dnsForm.value.caaValue.trim(),
      };
    } else {
      payload.content = dnsForm.value.content.trim();
      payload.proxied = isProxyable ? dnsForm.value.proxied : false;
      if (type === 'MX') {
        payload.priority = dnsForm.value.priority;
      }
    }

    if (dnsDialogMode.value === 'create') {
      await api.post(`/api/admin/cloudflare/zones/${selectedZone.value.id}/dns`, payload);
      ElMessage.success('DNS 记录已创建');
    } else if (editingRecord.value) {
      await api.patch(
        `/api/admin/cloudflare/zones/${selectedZone.value.id}/dns/${editingRecord.value.id}`,
        payload,
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
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <div
      class="relative shrink-0 border-b overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-orange-500/10 via-indigo-500/5 to-transparent pointer-events-none"
      ></div>

      <div class="px-4 sm:px-8 py-3 flex flex-row items-center justify-between gap-3 relative z-10">
        <div class="flex items-center gap-3 min-w-0">
          <span class="p-1.5 rounded-xl bg-orange-500/10 text-orange-500 shadow-sm border border-orange-500/20 shrink-0">
            <Globe2 class="w-4.5 h-4.5" />
          </span>
          <div class="min-w-0">
            <h1 class="text-sm sm:text-base font-black tracking-tight truncate" style="color: var(--text-primary)">
              Cloudflare 域名管理
            </h1>
            <p class="text-[10px] hidden sm:block truncate" style="color: var(--text-muted)">
              Zone / DNS / SSL 状态 · 复杂配置请跳转 Cloudflare 控制台
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-xs font-bold shadow-sm cursor-pointer"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="openCloudflareDashboard()"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">控制台</span>
          </button>
          <button
            type="button"
            :disabled="!hasToken || loadingZones"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
            @click="fetchZones"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingZones }" />
            <span>刷新</span>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <AdminOpsPanel scope="cloudflare" />

      <div class="blender-card p-4 mb-4">
        <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4">
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-xs font-bold" style="color: var(--text-primary)">
              <KeyRound class="w-4 h-4 text-accent" />
              API Token 配置
              <span
                v-if="hasToken"
                class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600"
              >
                已配置
              </span>
              <span v-else class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                未配置
              </span>
            </div>

            <input
              v-model="apiTokenInput"
              type="password"
              :placeholder="hasToken ? '已保存 Token，输入新 Token 可覆盖' : 'Cloudflare API Token（Zone:Read, DNS:Edit）'"
              class="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono outline-none focus:ring-2 focus:ring-accent/20"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />

            <div class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2">
              <input
                v-model="accountId"
                type="text"
                placeholder="Account ID（可选）"
                class="w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none"
                style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
              />
              <button
                type="button"
                :disabled="verifyingToken"
                class="px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer disabled:opacity-50"
                style="border-color: var(--border-base); color: var(--text-secondary)"
                @click="verifyToken"
              >
                {{ verifyingToken ? '验证中...' : '验证' }}
              </button>
              <button
                type="button"
                :disabled="savingConfig"
                class="px-3 py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                @click="saveConfig"
              >
                {{ savingConfig ? '保存中...' : '保存' }}
              </button>
              <button
                v-if="hasToken"
                type="button"
                :disabled="clearingConfig"
                class="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-colors"
                @click="clearConfig"
              >
                {{ clearingConfig ? '清空中...' : '清空' }}
              </button>
            </div>
          </div>

          <div class="text-[11px] leading-relaxed rounded-xl border p-3" style="border-color: var(--border-base); color: var(--text-secondary)">
            <p class="font-bold mb-1.5" style="color: var(--text-primary)">功能说明</p>
            <ul class="space-y-1">
              <li>· 支持 DNS 增删改、SSL 状态查看、Zone 暂停/恢复</li>
              <li>· SSL/TLS 模式修改、Page Rules 等请在 Cloudflare 控制台操作</li>
              <li>· 此 Token 独立于 R2 存储配置</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-4">
        <div class="blender-card p-4 flex flex-col min-h-[420px]">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h2 class="text-sm font-black" style="color: var(--text-primary)">域名列表</h2>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5" style="color: var(--text-secondary)">
              {{ zones.length }} 个
            </span>
          </div>

          <div class="relative mb-3">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="zoneSearch"
              type="text"
              placeholder="搜索域名..."
              class="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>

          <div v-if="!hasToken" class="flex-1 grid place-items-center text-xs text-center px-4" style="color: var(--text-muted)">
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
              :class="selectedZone?.id === zone.id ? 'border-accent bg-accent/5' : 'hover:bg-hover'"
              :style="{ borderColor: selectedZone?.id === zone.id ? undefined : 'var(--border-base)' }"
              @click="selectZone(zone)"
            >
              <div class="flex items-center justify-between gap-2">
                <strong class="text-xs truncate" style="color: var(--text-primary)">{{ zone.name }}</strong>
                <span
                  class="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  :class="zone.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'"
                >
                  {{ zone.status }}
                </span>
              </div>
              <div class="mt-1 text-[10px] flex flex-wrap items-center gap-1.5" style="color: var(--text-secondary)">
                <span>{{ zone.plan }} · {{ zone.type }}</span>
                <span v-if="zone.paused" class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">已暂停</span>
              </div>
            </button>
          </div>
        </div>

        <div v-if="selectedZone" class="blender-card p-4 flex flex-col min-h-[420px]">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3 pb-3 border-b" style="border-color: var(--border-base)">
            <div class="min-w-0">
              <h2 class="text-sm font-black truncate" style="color: var(--text-primary)">{{ selectedZone.name }}</h2>
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
                  <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600">
                    <Lock class="w-3 h-3" />
                    SSL: {{ sslModeLabel(zoneSslMode) }}
                  </span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
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
                :class="selectedZone.paused ? 'text-emerald-600 border-emerald-500/30' : 'text-amber-600 border-amber-500/30'"
                style="border-color: var(--border-base)"
                @click="toggleZonePause"
              >
                <Play v-if="selectedZone.paused" class="w-3 h-3" />
                <Pause v-else class="w-3 h-3" />
                {{ selectedZone.paused ? '恢复 Zone' : '暂停 Zone' }}
              </button>
              <button
                type="button"
                class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer"
                style="border-color: var(--border-base); color: var(--text-secondary)"
                @click="openCloudflareDashboard(selectedZone)"
              >
                <ExternalLink class="w-3 h-3" />
                控制台
              </button>
              <button
                type="button"
                class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-[10px] font-bold cursor-pointer"
                @click="openCreateDns"
              >
                <Plus class="w-3 h-3" />
                添加 DNS
              </button>
            </div>
          </div>

          <div class="relative mb-3">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="dnsSearch"
              type="text"
              placeholder="搜索 DNS 记录..."
              class="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>

          <div class="flex-1 overflow-auto border rounded-xl" style="border-color: var(--border-base)">
            <table class="w-full text-left text-xs">
              <thead class="sticky top-0 z-10" style="background-color: var(--bg-hover)">
                <tr>
                  <th class="px-3 py-2 font-bold">类型</th>
                  <th class="px-3 py-2 font-bold">名称</th>
                  <th class="px-3 py-2 font-bold">内容</th>
                  <th class="px-3 py-2 font-bold">代理</th>
                  <th class="px-3 py-2 font-bold">TTL</th>
                  <th class="px-3 py-2 font-bold text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loadingDns">
                  <td colspan="6" class="px-3 py-10 text-center" style="color: var(--text-muted)">
                    <RefreshCw class="w-4 h-4 animate-spin inline-block" />
                  </td>
                </tr>
                <tr v-else-if="filteredDnsRecords.length === 0">
                  <td colspan="6" class="px-3 py-10 text-center" style="color: var(--text-muted)">暂无 DNS 记录</td>
                </tr>
                <tr
                  v-for="record in filteredDnsRecords"
                  :key="record.id"
                  class="border-t"
                  style="border-color: var(--border-base)"
                >
                  <td class="px-3 py-2 font-bold">{{ record.type }}</td>
                  <td class="px-3 py-2 font-mono text-[11px]">{{ record.name }}</td>
                  <td class="px-3 py-2 font-mono text-[11px] max-w-[280px] truncate" :title="record.content">
                    {{ record.content }}
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-1.5">
                      <span class="transition-colors duration-200"
                            :class="record.proxied ? 'text-orange-500' : 'text-slate-400'"
                            :title="record.proxied ? '已代理: 加速并受保护' : '仅 DNS: 绕过代理'">
                        <Cloud class="w-4 h-4 inline-block" />
                      </span>
                      <span class="text-[10px] font-bold"
                            :style="{ color: record.proxied ? 'var(--text-primary)' : 'var(--text-secondary)' }">
                        {{ record.proxied ? '已代理' : '仅 DNS' }}
                      </span>
                    </div>
                  </td>
                  <td class="px-3 py-2">{{ formatTtl(record.ttl) }}</td>
                  <td class="px-3 py-2">
                    <div class="flex items-center justify-end gap-1">
                      <button type="button" class="p-1 rounded hover:bg-hover cursor-pointer" @click="openEditDns(record)">
                        <Edit2 class="w-3.5 h-3.5" />
                      </button>
                      <button type="button" class="p-1 rounded hover:bg-rose-50 text-rose-500 cursor-pointer" @click="deleteDnsRecord(record)">
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else class="blender-card p-4 flex flex-col min-h-[420px]">
          <div class="flex-1 grid place-items-center text-xs text-center px-6" style="color: var(--text-muted)">
            <div class="space-y-2">
              <ShieldCheck class="w-8 h-8 mx-auto opacity-40" />
              <p>从左侧选择一个域名，查看 DNS 与 SSL 状态</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="dnsDialogVisible" :title="dnsDialogMode === 'create' ? '添加 DNS 记录' : '编辑 DNS 记录'" width="560px" align-center>
      <div class="space-y-4 py-2">
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">类型</label>
            <select v-model="dnsForm.type" class="w-full px-3 py-2 rounded-xl border text-xs bg-card border-base text-primary">
              <option value="A">A</option>
              <option value="AAAA">AAAA</option>
              <option value="CNAME">CNAME</option>
              <option value="TXT">TXT</option>
              <option value="MX">MX</option>
              <option value="NS">NS</option>
              <option value="SRV">SRV</option>
              <option value="CAA">CAA</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">TTL</label>
            <select v-model="dnsForm.ttl" :disabled="['A', 'AAAA', 'CNAME'].includes(dnsForm.type) && dnsForm.proxied" class="w-full px-3 py-2 rounded-xl border text-xs bg-card border-base text-primary disabled:opacity-60 disabled:cursor-not-allowed">
              <option :value="1">Auto (自动)</option>
              <option :value="120">2 minutes</option>
              <option :value="300">5 minutes</option>
              <option :value="600">10 minutes</option>
              <option :value="900">15 minutes</option>
              <option :value="1800">30 minutes</option>
              <option :value="3600">1 hour</option>
              <option :value="7200">2 hours</option>
              <option :value="18000">5 hours</option>
              <option :value="43200">12 hours</option>
              <option :value="86400">1 day</option>
            </select>
          </div>
        </div>

        <!-- SRV specific fields -->
        <template v-if="dnsForm.type === 'SRV'">
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-500">服务 (Service) *</label>
              <input v-model="dnsForm.srvService" type="text" placeholder="例如: _sip" class="w-full px-3 py-2 rounded-xl border text-xs font-mono text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-500">协议 (Protocol) *</label>
              <select v-model="dnsForm.srvProtocol" class="w-full px-3 py-2 rounded-xl border text-xs bg-card border-base text-primary">
                <option value="_tcp">_tcp</option>
                <option value="_udp">_udp</option>
                <option value="_tls">_tls</option>
              </select>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">名称 (Name/域) *</label>
            <input v-model="dnsForm.name" type="text" class="w-full px-3 py-2 rounded-xl border text-xs font-mono text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
            <div class="mt-1 text-[10px]" style="color: var(--text-muted)">
              解析为: <span class="font-mono font-bold text-accent">{{ namePreview }}</span>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">目标 (Target) *</label>
            <input v-model="dnsForm.srvTarget" type="text" placeholder="例如: sipserver.example.com" class="w-full px-3 py-2 rounded-xl border text-xs font-mono text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-500">优先级 (Priority) *</label>
              <input v-model.number="dnsForm.priority" type="number" min="0" max="65535" class="w-full px-3 py-2 rounded-xl border text-xs text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-500">权重 (Weight) *</label>
              <input v-model.number="dnsForm.srvWeight" type="number" min="0" max="65535" class="w-full px-3 py-2 rounded-xl border text-xs text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-500">端口 (Port) *</label>
              <input v-model.number="dnsForm.srvPort" type="number" min="1" max="65535" class="w-full px-3 py-2 rounded-xl border text-xs text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
            </div>
          </div>
        </template>

        <!-- CAA specific fields -->
        <template v-else-if="dnsForm.type === 'CAA'">
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">名称 (Name) *</label>
            <input v-model="dnsForm.name" type="text" class="w-full px-3 py-2 rounded-xl border text-xs font-mono text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
            <div class="mt-1 text-[10px]" style="color: var(--text-muted)">
              解析为: <span class="font-mono font-bold text-accent">{{ namePreview }}</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-500">标志 (Flags) *</label>
              <input v-model.number="dnsForm.caaFlags" type="number" min="0" max="255" class="w-full px-3 py-2 rounded-xl border text-xs text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-500">标签 (Tag) *</label>
              <select v-model="dnsForm.caaTag" class="w-full px-3 py-2 rounded-xl border text-xs bg-card border-base text-primary">
                <option value="issue">issue (允许单个 CA)</option>
                <option value="issuewild">issuewild (允许通配符证书)</option>
                <option value="iodef">iodef (报告违规行为 URL)</option>
              </select>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">值 (Value/CA域名) *</label>
            <input v-model="dnsForm.caaValue" type="text" placeholder="例如: letsencrypt.org" class="w-full px-3 py-2 rounded-xl border text-xs font-mono text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
          </div>
        </template>

        <!-- Standard DNS record fields (A, AAAA, CNAME, TXT, MX, NS) -->
        <template v-else>
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">名称 (Name) *</label>
            <input v-model="dnsForm.name" type="text" class="w-full px-3 py-2 rounded-xl border text-xs font-mono text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
            <div class="mt-1 text-[10px]" style="color: var(--text-muted)">
              解析为: <span class="font-mono font-bold text-accent">{{ namePreview }}</span>
              <span class="ml-1">(输入 @ 代表根域名)</span>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">{{ contentLabel }} *</label>
            <textarea v-if="dnsForm.type === 'TXT'" v-model="dnsForm.content" rows="3" :placeholder="contentPlaceholder" class="w-full px-3 py-2 rounded-xl border text-xs font-mono text-primary outline-none resize-none" style="background-color: var(--bg-card); border-color: var(--border-base)"></textarea>
            <input v-else v-model="dnsForm.content" type="text" :placeholder="contentPlaceholder" class="w-full px-3 py-2 rounded-xl border text-xs font-mono text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
          </div>
          <div v-if="dnsForm.type === 'MX'" class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">优先级 (Priority) *</label>
            <input v-model.number="dnsForm.priority" type="number" min="0" max="65535" class="w-full px-3 py-2 rounded-xl border text-xs text-primary" style="background-color: var(--bg-card); border-color: var(--border-base)" />
          </div>

          <!-- Cloudflare Proxy Toggle Card -->
          <div v-if="['A', 'AAAA', 'CNAME'].includes(dnsForm.type)" class="pt-2 animate-fade-in">
            <div class="p-3 rounded-xl border flex items-center justify-between gap-4 transition-all duration-200"
                 :style="{
                   borderColor: dnsForm.proxied ? 'rgba(249, 115, 22, 0.3)' : 'var(--border-base)',
                   backgroundColor: dnsForm.proxied ? 'rgba(249, 115, 22, 0.03)' : 'var(--bg-card)'
                 }">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg transition-colors duration-200"
                     :class="dnsForm.proxied ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-500/10 text-slate-400'">
                  <Cloud class="w-5 h-5" />
                </div>
                <div>
                  <div class="text-xs font-bold" :style="{ color: dnsForm.proxied ? 'var(--text-primary)' : 'var(--text-secondary)' }">
                    代理状态: {{ dnsForm.proxied ? '已代理' : '仅 DNS' }}
                  </div>
                  <div class="text-[10px]" style="color: var(--text-muted)">
                    {{ dnsForm.proxied ? '已加速并受到 Cloudflare 保护' : '绕过 Cloudflare 代理，流量直达源站' }}
                  </div>
                </div>
              </div>
              <el-switch v-model="dnsForm.proxied" active-color="#f97316" inactive-color="#94a3b8" />
            </div>
          </div>
        </template>
      </div>
      <template #footer>
        <button type="button" class="px-4 py-2 rounded-xl border text-xs font-bold mr-2 cursor-pointer" @click="dnsDialogVisible = false">
          取消
        </button>
        <button
          type="button"
          :disabled="submittingDns"
          class="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
          @click="submitDnsForm"
        >
          {{ submittingDns ? '保存中...' : '保存' }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

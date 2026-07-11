<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Cloud } from 'lucide-vue-next';
import FormDialog from '@/components/FormDialog.vue';
import UiInput from '@/components/ui/Input.vue';
import { ElMessage } from '@/utils/feedbackBridge';

interface SrvData {
  service: string;
  proto: string;
  weight: number;
  port: number;
  target: string;
}

interface CaaData {
  flags: number;
  tag: string;
  value: string;
}

export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  priority?: number;
  data?: SrvData | CaaData | Record<string, unknown> | null;
  createdOn: string;
  modifiedOn: string;
}

export interface DnsFormSubmitData {
  mode: 'create' | 'edit';
  recordId?: string;
  payload: {
    type: string;
    name: string;
    ttl: number;
    content?: string;
    proxied?: boolean;
    priority?: number;
    data?: unknown;
  };
}

interface Props {
  modelValue: boolean;
  mode: 'create' | 'edit';
  zoneName: string;
  record?: CloudflareDnsRecord | null;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  record: null,
  loading: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', data: DnsFormSubmitData): void;
}>();

const dnsForm = ref({
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
});

const resetForm = () => {
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
};

const isSrvData = (data: unknown): data is SrvData =>
  typeof data === 'object' && data !== null && 'service' in data && 'proto' in data;

const isCaaData = (data: unknown): data is CaaData =>
  typeof data === 'object' && data !== null && 'flags' in data && 'tag' in data && 'value' in data;

const initFromRecord = (record: CloudflareDnsRecord) => {
  let displayName = record.name;
  if (record.type === 'SRV' && isSrvData(record.data)) {
    const prefix = `${record.data.service}.${record.data.proto}.`;
    if (displayName.startsWith(prefix)) {
      displayName = displayName.slice(prefix.length);
    }
  }

  if (displayName === props.zoneName) {
    displayName = '@';
  } else if (displayName.endsWith('.' + props.zoneName)) {
    displayName = displayName.slice(0, -(props.zoneName.length + 1));
  }

  const srvData = isSrvData(record.data) ? record.data : null;
  const caaData = isCaaData(record.data) ? record.data : null;

  dnsForm.value = {
    type: record.type,
    name: displayName,
    content: record.content,
    proxied: record.proxied,
    ttl: record.ttl,
    priority: record.priority ?? 10,
    srvService: srvData?.service || '',
    srvProtocol: srvData?.proto || '_tcp',
    srvWeight: srvData?.weight ?? 5,
    srvPort: srvData?.port ?? 5060,
    srvTarget: srvData?.target || '',
    caaFlags: caaData?.flags ?? 0,
    caaTag: caaData?.tag || 'issue',
    caaValue: caaData?.value || '',
  };
};

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return;
    if (props.mode === 'edit' && props.record) {
      initFromRecord(props.record);
    } else {
      resetForm();
    }
  },
);

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
  const zoneName = props.zoneName;

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

watch(
  () => dnsForm.value.type,
  (newType) => {
    if (!['A', 'AAAA', 'CNAME'].includes(newType)) {
      dnsForm.value.proxied = false;
    } else {
      dnsForm.value.proxied = true;
    }
  },
);

watch(
  () => dnsForm.value.proxied,
  (isProxied) => {
    if (isProxied && ['A', 'AAAA', 'CNAME'].includes(dnsForm.value.type)) {
      dnsForm.value.ttl = 1;
    }
  },
);

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
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
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
    if (
      dnsForm.value.priority === undefined ||
      dnsForm.value.priority < 0 ||
      dnsForm.value.priority > 65535
    ) {
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
    if (
      dnsForm.value.priority === undefined ||
      dnsForm.value.priority < 0 ||
      dnsForm.value.priority > 65535
    ) {
      ElMessage.warning('优先级必须在 0 到 65535 之间');
      return false;
    }
    if (
      dnsForm.value.srvWeight === undefined ||
      dnsForm.value.srvWeight < 0 ||
      dnsForm.value.srvWeight > 65535
    ) {
      ElMessage.warning('权重必须在 0 到 65535 之间');
      return false;
    }
    if (
      dnsForm.value.srvPort === undefined ||
      dnsForm.value.srvPort < 1 ||
      dnsForm.value.srvPort > 65535
    ) {
      ElMessage.warning('端口必须在 1 到 65535 之间');
      return false;
    }
  } else if (type === 'CAA') {
    if (!dnsForm.value.caaValue.trim()) {
      ElMessage.warning('请填写 CA 域名值');
      return false;
    }
    if (
      dnsForm.value.caaFlags === undefined ||
      dnsForm.value.caaFlags < 0 ||
      dnsForm.value.caaFlags > 255
    ) {
      ElMessage.warning('标志位必须在 0 到 255 之间');
      return false;
    }
  }

  return true;
};

const handleSubmit = () => {
  if (!validateDnsForm()) return;

  const type = dnsForm.value.type;
  const rawName = dnsForm.value.name.trim();
  let relativeName = rawName;
  if (rawName === '@' || !rawName) {
    relativeName = props.zoneName;
  } else if (!rawName.endsWith(props.zoneName)) {
    relativeName = `${rawName}.${props.zoneName}`;
  }

  const isProxyable = ['A', 'AAAA', 'CNAME'].includes(type);
  const payload: DnsFormSubmitData['payload'] = {
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

  emit('submit', {
    mode: props.mode,
    recordId: props.record?.id,
    payload,
  });
};

const close = () => {
  emit('update:modelValue', false);
};
</script>

<template>
  <FormDialog
    :visible="modelValue"
    :title="mode === 'create' ? '添加 DNS 记录' : '编辑 DNS 记录'"
    :loading="loading"
    @update:visible="emit('update:modelValue', $event)"
    @cancel="close"
    @submit="handleSubmit"
  >
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3 mobile-grid">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >类型</label
          >
          <Select v-model="dnsForm.type" class="w-full" size="large">
            <SelectOption value="A" label="A" />
            <SelectOption value="AAAA" label="AAAA" />
            <SelectOption value="CNAME" label="CNAME" />
            <SelectOption value="TXT" label="TXT" />
            <SelectOption value="MX" label="MX" />
            <SelectOption value="NS" label="NS" />
            <SelectOption value="SRV" label="SRV" />
            <SelectOption value="CAA" label="CAA" />
          </Select>
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >TTL</label
          >
          <Select
            v-model="dnsForm.ttl"
            :disabled="['A', 'AAAA', 'CNAME'].includes(dnsForm.type) && dnsForm.proxied"
            class="w-full"
            size="large"
          >
            <SelectOption :value="1" label="Auto (自动)" />
            <SelectOption :value="120" label="2 minutes" />
            <SelectOption :value="300" label="5 minutes" />
            <SelectOption :value="600" label="10 minutes" />
            <SelectOption :value="900" label="15 minutes" />
            <SelectOption :value="1800" label="30 minutes" />
            <SelectOption :value="3600" label="1 hour" />
            <SelectOption :value="7200" label="2 hours" />
            <SelectOption :value="18000" label="5 hours" />
            <SelectOption :value="43200" label="12 hours" />
            <SelectOption :value="86400" label="1 day" />
          </Select>
        </div>
      </div>

      <template v-if="dnsForm.type === 'SRV'">
        <div class="grid grid-cols-2 gap-3 mobile-grid">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
              >服务 (Service) *</label
            >
            <UiInput
              v-model="dnsForm.srvService"
              placeholder="例如: _sip"
              input-class="text-xs font-mono"
            />
          </div>
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
              >协议 (Protocol) *</label
            >
            <Select v-model="dnsForm.srvProtocol" class="w-full" size="large">
              <SelectOption value="_tcp" label="_tcp" />
              <SelectOption value="_udp" label="_udp" />
              <SelectOption value="_tls" label="_tls" />
            </Select>
          </div>
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >名称 (Name/域) *</label
          >
          <UiInput v-model="dnsForm.name" input-class="text-xs font-mono" />
          <div class="mt-1 text-[10px]" style="color: var(--text-muted)">
            解析为: <span class="font-mono font-bold text-accent">{{ namePreview }}</span>
          </div>
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >目标 (Target) *</label
          >
          <UiInput
            v-model="dnsForm.srvTarget"
            placeholder="例如: sipserver.example.com"
            input-class="text-xs font-mono"
          />
        </div>
        <div class="grid grid-cols-3 gap-3 mobile-grid">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
              >优先级 (Priority) *</label
            >
            <UiInput v-model.number="dnsForm.priority" type="number" input-class="text-xs" />
          </div>
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
              >权重 (Weight) *</label
            >
            <UiInput v-model.number="dnsForm.srvWeight" type="number" input-class="text-xs" />
          </div>
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
              >端口 (Port) *</label
            >
            <UiInput v-model.number="dnsForm.srvPort" type="number" input-class="text-xs" />
          </div>
        </div>
      </template>

      <template v-else-if="dnsForm.type === 'CAA'">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >名称 (Name) *</label
          >
          <UiInput v-model="dnsForm.name" input-class="text-xs font-mono" />
          <div class="mt-1 text-[10px]" style="color: var(--text-muted)">
            解析为: <span class="font-mono font-bold text-accent">{{ namePreview }}</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 mobile-grid">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
              >标志 (Flags) *</label
            >
            <UiInput v-model.number="dnsForm.caaFlags" type="number" input-class="text-xs" />
          </div>
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
              >标签 (Tag) *</label
            >
            <Select v-model="dnsForm.caaTag" class="w-full" size="large">
              <SelectOption value="issue" label="issue (允许单个 CA)" />
              <SelectOption value="issuewild" label="issuewild (允许通配符证书)" />
              <SelectOption value="iodef" label="iodef (报告违规行为 URL)" />
            </Select>
          </div>
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >值 (Value/CA域名) *</label
          >
          <UiInput
            v-model="dnsForm.caaValue"
            placeholder="例如: letsencrypt.org"
            input-class="text-xs font-mono"
          />
        </div>
      </template>

      <template v-else>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >名称 (Name) *</label
          >
          <UiInput v-model="dnsForm.name" input-class="text-xs font-mono" />
          <div class="mt-1 text-[10px]" style="color: var(--text-muted)">
            解析为: <span class="font-mono font-bold text-accent">{{ namePreview }}</span>
            <span class="ml-1">(输入 @ 代表根域名)</span>
          </div>
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >{{ contentLabel }} *</label
          >
          <textarea
            v-if="dnsForm.type === 'TXT'"
            v-model="dnsForm.content"
            rows="3"
            :placeholder="contentPlaceholder"
            class="w-full px-4 py-3 rounded-2xl border text-sm font-mono transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          ></textarea>
          <UiInput
            v-else
            v-model="dnsForm.content"
            :placeholder="contentPlaceholder"
            input-class="text-xs font-mono"
          />
        </div>
        <div v-if="dnsForm.type === 'MX'">
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
            >优先级 (Priority) *</label
          >
          <UiInput v-model.number="dnsForm.priority" type="number" input-class="text-xs" />
        </div>

        <div v-if="['A', 'AAAA', 'CNAME'].includes(dnsForm.type)" class="pt-2 animate-fade-in">
          <div
            class="p-3 rounded-xl border flex items-center justify-between gap-4 transition-all duration-200"
            :style="{
              borderColor: dnsForm.proxied ? 'rgba(249, 115, 22, 0.3)' : 'var(--border-base)',
              backgroundColor: dnsForm.proxied ? 'rgba(249, 115, 22, 0.03)' : 'var(--bg-card)',
            }"
          >
            <div class="flex items-center gap-3">
              <div
                class="p-2 rounded-lg transition-colors duration-200"
                :class="
                  dnsForm.proxied
                    ? 'bg-orange-500/10 text-orange-500'
                    : 'bg-slate-500/10 text-slate-400'
                "
              >
                <Cloud class="w-5 h-5" />
              </div>
              <div>
                <div
                  class="text-xs font-bold"
                  :style="{
                    color: dnsForm.proxied ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }"
                >
                  代理状态: {{ dnsForm.proxied ? '已代理' : '仅 DNS' }}
                </div>
                <div class="text-[10px]" style="color: var(--text-muted)">
                  {{
                    dnsForm.proxied
                      ? '已加速并受到 Cloudflare 保护'
                      : '绕过 Cloudflare 代理，流量直达源站'
                  }}
                </div>
              </div>
            </div>
            <Switch v-model="dnsForm.proxied" active-color="#f97316" inactive-color="#94a3b8" />
          </div>
        </div>
      </template>
    </div>
  </FormDialog>
</template>

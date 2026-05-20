<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Users,
  Zap,
  Crown,
  Check,
  X,
  DollarSign,
  HardDrive,
  FolderOpen,
  Box,
  Save,
  Search,
  Copy,
  Ticket,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';

const plans = ref<any[]>([]);
const subscriptions = ref<any[]>([]);
const users = ref<any[]>([]);
const activationCodes = ref<any[]>([]);
const isLoading = ref(true);
const activeTab = ref('plans');
const showPlanDialog = ref(false);
const showSubDialog = ref(false);
const showCodeDialog = ref(false);
const isGeneratingCodes = ref(false);
const editingPlan = ref<any>(null);
const editingSubscription = ref<any>(null);
const userSearchQuery = ref('');
const codeSearchQuery = ref('');

const codeForm = ref({
  planId: '',
  durationPreset: '30',
  durationDays: 30,
  quantity: 5,
  expiresAt: '',
  bindEmail: '',
  description: '',
  prefix: '',
});

watch(() => codeForm.value.durationPreset, (newVal) => {
  if (newVal !== 'custom') {
    codeForm.value.durationDays = parseInt(newVal, 10);
  }
});

const defaultPlanForm = {
  name: '',
  displayName: '',
  price: 0,
  yearlyPrice: 0,
  interval: 'MONTHLY',
  features: [] as string[],
  maxStorage: 1,
  maxTeams: 1,
  maxProjects: 5,
  maxAssets: 50,
  priority: 0,
  isPopular: false,
  badgeColor: '#8b5cf6',
};

const defaultSubForm = {
  userId: '',
  planId: '',
  status: 'ACTIVE',
  interval: 'MONTHLY',
  startDate: '',
  endDate: '',
  autoRenew: true,
  cancelAtPeriodEnd: false,
  paymentMethod: 'ADMIN_ASSIGN',
};

const planForm = ref({ ...defaultPlanForm });
const subForm = ref({ ...defaultSubForm });
const newFeature = ref('');

const filteredUsers = computed(() => {
  if (!userSearchQuery.value) return users.value;
  const q = userSearchQuery.value.toLowerCase();
  return users.value.filter(
    (u: any) =>
      (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q),
  );
});

const filteredCodes = computed(() => {
  if (!codeSearchQuery.value) return activationCodes.value;
  const q = codeSearchQuery.value.toLowerCase();
  return activationCodes.value.filter(
    (c: any) =>
      c.code.toLowerCase().includes(q) ||
      (c.plan?.displayName || c.plan?.name || '').toLowerCase().includes(q) ||
      (c.usedBy?.name || c.usedBy?.email || '').toLowerCase().includes(q),
  );
});

const subscribedUserIds = computed(() => new Set(subscriptions.value.map((s: any) => s.userId)));

const availableUsers = computed(() => {
  if (editingSubscription.value) return users.value;
  return filteredUsers.value.filter((u: any) => !subscribedUserIds.value.has(u.id));
});

const fetchData = async () => {
  isLoading.value = true;
  try {
    const [plansRes, subsRes, codesRes] = await Promise.all([
      api.get('/api/admin/subscription-plans'),
      api.get('/api/admin/subscriptions'),
      api.get('/api/admin/activation-codes').catch(() => ({ data: [] })),
    ]);
    plans.value = plansRes.data;
    subscriptions.value = subsRes.data;
    activationCodes.value = codesRes.data;
  } catch (error) {
    ElMessage.error('获取数据失败');
  } finally {
    isLoading.value = false;
  }
};

const fetchUsers = async () => {
  try {
    const res = await api.get('/api/admin/users');
    users.value = res.data;
  } catch (error) {
    ElMessage.error('获取用户列表失败');
  }
};

const openCreatePlan = () => {
  editingPlan.value = null;
  planForm.value = { ...defaultPlanForm, features: [] };
  showPlanDialog.value = true;
};

const openEditPlan = (plan: any) => {
  editingPlan.value = plan;
  planForm.value = {
    name: plan.name,
    displayName: plan.displayName || '',
    price: plan.price,
    yearlyPrice: plan.yearlyPrice || 0,
    interval: plan.interval,
    features: Array.isArray(plan.features) ? [...plan.features] : [],
    maxStorage: plan.maxStorage,
    maxTeams: plan.maxTeams,
    maxProjects: plan.maxProjects || 5,
    maxAssets: plan.maxAssets || 50,
    priority: plan.priority || 0,
    isPopular: plan.isPopular || false,
    badgeColor: plan.badgeColor || '#8b5cf6',
  };
  showPlanDialog.value = true;
};

const addFeature = () => {
  if (!newFeature.value.trim()) return;
  planForm.value.features.push(newFeature.value.trim());
  newFeature.value = '';
};

const removeFeature = (index: number) => {
  planForm.value.features.splice(index, 1);
};

const handleSavePlan = async () => {
  if (!planForm.value.name) {
    ElMessage.warning('请填写计划名称');
    return;
  }
  try {
    if (editingPlan.value) {
      await api.put(`/api/admin/subscription-plans/${editingPlan.value.id}`, planForm.value);
      ElMessage.success('计划已更新');
    } else {
      await api.post('/api/admin/subscription-plans', planForm.value);
      ElMessage.success('计划已创建');
    }
    showPlanDialog.value = false;
    fetchData();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '保存失败');
  }
};

const handleDeletePlan = async (plan: any) => {
  if (plan.subscriberCount > 0) {
    ElMessage.warning(`该计划仍有 ${plan.subscriberCount} 名订阅者，无法删除`);
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${plan.displayName || plan.name} 计划吗？此操作不可恢复。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
    await api.delete(`/api/admin/subscription-plans/${plan.id}`);
    ElMessage.success('计划已删除');
    fetchData();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败');
    }
  }
};

const openCreateSubscription = async () => {
  editingSubscription.value = null;
  subForm.value = { ...defaultSubForm };
  userSearchQuery.value = '';
  if (users.value.length === 0) await fetchUsers();
  showSubDialog.value = true;
};

const openEditSubscription = async (sub: any) => {
  editingSubscription.value = sub;
  subForm.value = {
    userId: sub.userId,
    planId: sub.planId,
    status: sub.status,
    interval: sub.interval,
    startDate: sub.startDate ? new Date(sub.startDate).toISOString().slice(0, 16) : '',
    endDate: sub.endDate ? new Date(sub.endDate).toISOString().slice(0, 16) : '',
    autoRenew: sub.autoRenew,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    paymentMethod: sub.paymentMethod || 'ADMIN_ASSIGN',
  };
  userSearchQuery.value = '';
  if (users.value.length === 0) await fetchUsers();
  showSubDialog.value = true;
};

const handleSaveSubscription = async () => {
  if (!subForm.value.userId) {
    ElMessage.warning('请选择用户');
    return;
  }
  if (!subForm.value.planId) {
    ElMessage.warning('请选择订阅计划');
    return;
  }
  try {
    if (editingSubscription.value) {
      const payload: any = { ...subForm.value };
      if (!payload.endDate) payload.endDate = null;
      await api.put(`/api/admin/subscriptions/${editingSubscription.value.id}`, payload);
      ElMessage.success('订阅已更新');
    } else {
      await api.post('/api/admin/subscriptions', subForm.value);
      ElMessage.success('订阅已创建');
    }
    showSubDialog.value = false;
    fetchData();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '保存失败');
  }
};

const handleDeleteSubscription = async (sub: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 ${sub.user?.name || sub.user?.email} 的订阅吗？此操作不可恢复。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
    await api.delete(`/api/admin/subscriptions/${sub.id}`);
    ElMessage.success('订阅已删除');
    fetchData();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败');
    }
  }
};

const getPlanIcon = (name: string) => {
  if (name === 'VIP') return Zap;
  if (name === 'SVIP') return Crown;
  return CreditCard;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-500/10 text-emerald-500';
    case 'CANCELED':
      return 'bg-rose-500/10 text-rose-500';
    case 'EXPIRED':
      return 'bg-slate-500/10 text-slate-500';
    case 'PAST_DUE':
      return 'bg-amber-500/10 text-amber-500';
    default:
      return 'bg-slate-500/10 text-slate-500';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return '活跃';
    case 'CANCELED':
      return '已取消';
    case 'EXPIRED':
      return '已过期';
    case 'PAST_DUE':
      return '逾期';
    default:
      return status;
  }
};

const openCreateCodes = () => {
  codeForm.value = {
    planId: plans.value[0]?.id || '',
    durationPreset: '30',
    durationDays: 30,
    quantity: 5,
    expiresAt: '',
    bindEmail: '',
    description: '',
    prefix: '',
  };
  showCodeDialog.value = true;
};

const handleGenerateCodes = async () => {
  if (!codeForm.value.planId) {
    ElMessage.warning('请选择订阅计划');
    return;
  }
  isGeneratingCodes.value = true;
  try {
    await api.post('/api/admin/activation-codes', codeForm.value);
    ElMessage.success('激活码生成成功');
    showCodeDialog.value = false;
    await fetchData();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '生成激活码失败');
  } finally {
    isGeneratingCodes.value = false;
  }
};

const handleDeleteCode = async (code: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除/失效该激活码 (${code.code}) 吗？此操作不可恢复。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
    await api.delete(`/api/admin/activation-codes/${code.id}`);
    ElMessage.success('激活码已删除');
    fetchData();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败');
    }
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(
    () => ElMessage.success('已复制到剪贴板'),
    () => ElMessage.error('复制失败'),
  );
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)]">
    <div
      class="min-h-16 py-3 lg:py-0 lg:h-16 px-4 sm:px-8 flex flex-row items-center justify-between gap-2 shrink-0 border-b border-[var(--border-base)] bg-[var(--bg-card)]"
    >
      <div class="flex items-center gap-1.5 shrink-0">
        <div class="hidden sm:block p-2 bg-violet-50 dark:bg-violet-900/20 rounded-xl text-violet-600">
          <CreditCard class="w-5 h-5" />
        </div>
        <h1 class="text-sm xs:text-base sm:text-xl font-bold text-[var(--text-primary)]">订阅管理</h1>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <div class="flex bg-[var(--bg-app)] rounded-xl p-0.5 sm:p-1">
          <button
            class="px-2 py-1 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all shrink-0"
            :class="
              activeTab === 'plans'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)]'
            "
            @click="activeTab = 'plans'"
          >
            <span class="xs:hidden">计划</span>
            <span class="hidden xs:inline">订阅计划</span>
          </button>
          <button
            class="px-2 py-1 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all shrink-0"
            :class="
              activeTab === 'subscriptions'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)]'
            "
            @click="activeTab = 'subscriptions'"
          >
            <span class="xs:hidden">订阅</span>
            <span class="hidden xs:inline">用户订阅</span>
          </button>
          <button
            class="px-2 py-1 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all shrink-0"
            :class="
              activeTab === 'codes'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)]'
            "
            @click="activeTab = 'codes'"
          >
            <span class="xs:hidden">激活码</span>
            <span class="hidden xs:inline">激活码管理</span>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <div class="max-w-6xl mx-auto">
        <!-- Plans Tab -->
        <div v-if="activeTab === 'plans'" class="space-y-6">
          <div class="flex items-center justify-between gap-4">
            <p class="hidden sm:block text-sm text-[var(--text-secondary)]">管理平台订阅计划，配置价格和功能权限</p>
            <div class="flex items-center justify-between w-full sm:w-auto sm:justify-end">
              <span class="sm:hidden text-xs font-bold text-[var(--text-secondary)]">订阅计划列表</span>
              <button
                class="px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-accent/20 shrink-0"
                @click="openCreatePlan"
              >
                <Plus class="w-4 h-4" /> 新建计划
              </button>
            </div>
          </div>

          <div class="grid gap-4">
            <div
              v-for="plan in plans"
              :key="plan.id"
              class="p-6 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] hover:shadow-lg transition-all"
            >
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="flex items-start gap-4">
                  <div
                    class="p-3 rounded-2xl shrink-0"
                    :style="{
                      backgroundColor: (plan.badgeColor || '#8b5cf6') + '15',
                      color: plan.badgeColor || '#8b5cf6',
                    }"
                  >
                    <component :is="getPlanIcon(plan.name)" class="w-6 h-6" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="text-lg font-black text-[var(--text-primary)]">
                        {{ plan.displayName || plan.name }}
                      </h3>
                      <span
                        class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        :style="{
                          backgroundColor: (plan.badgeColor || '#8b5cf6') + '15',
                          color: plan.badgeColor || '#8b5cf6',
                        }"
                        >{{ plan.name }}</span
                      >
                      <span
                        v-if="plan.isPopular"
                        class="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-full"
                        >推荐</span
                      >
                    </div>
                    <div class="flex flex-nowrap items-center gap-x-1.5 xs:gap-x-2 mt-2 text-[9px] xs:text-[10px] sm:text-xs text-[var(--text-secondary)] overflow-x-auto scrollbar-hide min-w-0">
                      <span class="flex items-center gap-0.5 shrink-0"
                        ><DollarSign class="w-3 h-3 shrink-0" />月付 ￥{{ plan.price
                        }}{{ plan.yearlyPrice ? ` / 年付 ￥${plan.yearlyPrice}` : '' }}</span
                      >
                      <span class="flex items-center gap-0.5 shrink-0"
                        ><HardDrive class="w-3 h-3 shrink-0" />{{
                          plan.maxStorage >= 9999 ? '无限' : plan.maxStorage + 'GB'
                        }}</span
                      >
                      <span class="flex items-center gap-0.5 shrink-0"
                        ><Users class="w-3 h-3 shrink-0" />{{
                          plan.maxTeams >= 999 ? '无限' : plan.maxTeams + '团队'
                        }}</span
                      >
                      <span class="flex items-center gap-0.5 shrink-0"
                        ><FolderOpen class="w-3 h-3 shrink-0" />{{
                          plan.maxProjects >= 9999 ? '无限' : plan.maxProjects + '项目'
                        }}</span
                      >
                      <span class="flex items-center gap-0.5 shrink-0"
                        ><Box class="w-3 h-3 shrink-0" />{{
                          plan.maxAssets >= 9999 ? '无限' : plan.maxAssets + '资产'
                        }}</span
                      >
                    </div>
                  </div>
                </div>
                <div class="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-0 border-[var(--border-base)] shrink-0">
                  <span class="text-xs text-[var(--text-muted)]"
                    >{{ plan.subscriberCount || 0 }} 订阅者</span
                  >
                  <div class="flex items-center gap-1">
                    <button
                      class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-accent transition-all"
                      @click="openEditPlan(plan)"
                    >
                      <Pencil class="w-4 h-4" />
                    </button>
                    <button
                      class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-500 transition-all"
                      @click="handleDeletePlan(plan)"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div
                v-if="plan.features && plan.features.length > 0"
                class="mt-4 pt-4 border-t border-[var(--border-base)]"
              >
                <div class="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-hide">
                  <span
                    v-for="(feature, idx) in plan.features"
                    :key="idx"
                    class="px-2 py-1 bg-[var(--bg-app)] rounded-lg text-[9px] xs:text-[10px] font-medium text-[var(--text-secondary)] shrink-0"
                  >
                    {{ feature }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Subscriptions Tab -->
        <div v-if="activeTab === 'subscriptions'" class="space-y-6">
          <div class="flex items-center justify-between gap-4">
            <p class="hidden sm:block text-sm text-[var(--text-secondary)]">
              管理所有用户的订阅状态，可新增、编辑或删除订阅
            </p>
            <div class="flex items-center justify-between w-full sm:w-auto sm:justify-end">
              <span class="sm:hidden text-xs font-bold text-[var(--text-secondary)]">用户订阅列表</span>
              <button
                class="px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-accent/20 shrink-0"
                @click="openCreateSubscription"
              >
                <Plus class="w-4 h-4" /> 新增订阅
              </button>
            </div>
          </div>

          <!-- Desktop Table View -->
          <div
            class="hidden md:block rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] overflow-hidden overflow-x-auto scrollbar-hide"
          >
            <table class="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr class="bg-[var(--bg-app)]/50 border-b border-[var(--border-base)]">
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    用户
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    计划
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    状态
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    周期
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    开始日期
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    到期日期
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    自动续费
                  </th>
                  <th
                    class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    操作
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--border-base)]">
                <tr
                  v-for="sub in subscriptions"
                  :key="sub.id"
                  class="hover:bg-[var(--bg-app)]/30 transition-colors"
                >
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500"
                      >
                        {{ (sub.user?.name || sub.user?.email || '?').charAt(0).toUpperCase() }}
                      </div>
                      <div>
                        <p class="text-sm font-bold text-[var(--text-primary)]">
                           {{ sub.user?.name || '未命名' }}
                        </p>
                        <p class="text-[10px] text-[var(--text-muted)]">{{ sub.user?.email }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      :style="{
                        backgroundColor: (sub.plan?.badgeColor || '#8b5cf6') + '15',
                        color: sub.plan?.badgeColor || '#8b5cf6',
                      }"
                    >
                      {{ sub.plan?.displayName || sub.plan?.name }}
                    </span>
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      :class="getStatusColor(sub.status)"
                    >
                      {{ getStatusLabel(sub.status) }}
                    </span>
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-[var(--text-secondary)]">
                    {{ sub.interval === 'YEARLY' ? '年付' : '月付' }}
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
                    {{ new Date(sub.startDate).toLocaleDateString() }}
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
                    {{ sub.endDate ? new Date(sub.endDate).toLocaleDateString() : '-' }}
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4">
                    <component
                      :is="sub.autoRenew ? Check : X"
                      class="w-4 h-4"
                      :class="sub.autoRenew ? 'text-emerald-500' : 'text-slate-400'"
                    />
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4">
                    <div class="flex items-center gap-1">
                      <button
                        class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-accent transition-all"
                        title="编辑"
                        @click="openEditSubscription(sub)"
                      >
                        <Pencil class="w-4 h-4" />
                      </button>
                      <button
                        class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-500 transition-all"
                        title="删除"
                        @click="handleDeleteSubscription(sub)"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="subscriptions.length === 0">
                  <td colspan="8" class="px-6 py-16 text-center">
                    <div class="flex flex-col items-center gap-3 opacity-20">
                      <Users class="w-10 h-10" />
                      <p class="text-sm font-medium">暂无订阅数据</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Card View -->
          <div class="md:hidden space-y-4">
            <div
              v-for="sub in subscriptions"
              :key="sub.id"
              class="p-5 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] space-y-4"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0"
                  >
                    {{ (sub.user?.name || sub.user?.email || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <h4 class="text-sm font-black text-[var(--text-primary)] truncate">
                      {{ sub.user?.name || '未命名' }}
                    </h4>
                    <p class="text-[10px] text-[var(--text-muted)] truncate">{{ sub.user?.email }}</p>
                  </div>
                </div>
                <div class="flex flex-row items-center gap-1.5 shrink-0">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    :style="{
                      backgroundColor: (sub.plan?.badgeColor || '#8b5cf6') + '15',
                      color: sub.plan?.badgeColor || '#8b5cf6',
                    }"
                  >
                    {{ sub.plan?.displayName || sub.plan?.name }}
                  </span>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    :class="getStatusColor(sub.status)"
                  >
                    {{ getStatusLabel(sub.status) }}
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2 text-[10px] xs:text-xs border-t border-b border-[var(--border-base)] py-3">
                <div>
                  <span class="text-[var(--text-muted)] block mb-0.5 truncate">周期 / 续费</span>
                  <span class="font-bold text-[var(--text-secondary)] flex flex-wrap items-center gap-0.5">
                    <span>{{ sub.interval === 'YEARLY' ? '年付' : '月付' }}</span>
                    <span class="text-[var(--text-muted)] hidden xs:inline">|</span>
                    <span :class="sub.autoRenew ? 'text-emerald-500' : 'text-slate-400'">
                      {{ sub.autoRenew ? '自动续期' : '手动' }}
                    </span>
                  </span>
                </div>
                <div>
                  <span class="text-[var(--text-muted)] block mb-0.5 truncate">开始日期</span>
                  <span class="font-bold text-[var(--text-secondary)]">
                    {{ new Date(sub.startDate).toLocaleDateString() }}
                  </span>
                </div>
                <div>
                  <span class="text-[var(--text-muted)] block mb-0.5 truncate">到期日期</span>
                  <span class="font-bold text-[var(--text-secondary)]">
                    {{ sub.endDate ? new Date(sub.endDate).toLocaleDateString() : '永久' }}
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2">
                <button
                  class="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl border border-[var(--border-base)] text-xs text-[var(--text-secondary)] font-bold transition-all"
                  @click="openEditSubscription(sub)"
                >
                  <Pencil class="w-3.5 h-3.5" />
                  编辑
                </button>
                <button
                  class="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold transition-all"
                  @click="handleDeleteSubscription(sub)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  删除
                </button>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="subscriptions.length === 0" class="py-16 text-center">
              <div class="flex flex-col items-center gap-3 opacity-20">
                <Users class="w-10 h-10" />
                <p class="text-sm font-medium">暂无订阅数据</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Codes Tab -->
        <div v-if="activeTab === 'codes'" class="space-y-6">
          <div class="flex items-center justify-between gap-4">
            <p class="hidden sm:block text-sm text-[var(--text-secondary)]">
              生成并管理用于激活订阅计划的激活码，支持批量生成与删除
            </p>
            <div class="flex items-center gap-3 w-full sm:w-auto">
              <div class="relative flex-1 sm:w-64">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  v-model="codeSearchQuery"
                  type="text"
                  class="w-full pl-9 pr-4 py-2 rounded-xl border text-xs transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 bg-[var(--bg-card)] border-[var(--border-base)] text-[var(--text-primary)]"
                  placeholder="搜索激活码、计划或使用者..."
                />
              </div>
              <button
                class="px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-accent/20 shrink-0"
                @click="openCreateCodes"
              >
                <Plus class="w-4 h-4" /> 生成激活码
              </button>
            </div>
          </div>

          <!-- Desktop Table View -->
          <div
            class="hidden md:block rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] overflow-hidden overflow-x-auto scrollbar-hide"
          >
            <table class="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr class="bg-[var(--bg-app)]/50 border-b border-[var(--border-base)]">
                  <th class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">激活码</th>
                  <th class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">订阅计划</th>
                  <th class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">天数</th>
                  <th class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">绑定邮箱</th>
                  <th class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">过期时间</th>
                  <th class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">备注</th>
                  <th class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">状态</th>
                  <th class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">使用者</th>
                  <th class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">生成时间</th>
                  <th class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--border-base)]">
                <tr v-for="c in filteredCodes" :key="c.id" class="hover:bg-[var(--bg-app)]/30 transition-colors">
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4">
                    <div class="flex items-center gap-2">
                      <code class="text-xs font-mono font-bold text-[var(--text-primary)] select-all">{{ c.code }}</code>
                      <button
                        class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 hover:text-accent transition-all"
                        title="复制激活码"
                        @click="copyToClipboard(c.code)"
                      >
                        <Copy class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      :style="{
                        backgroundColor: (c.plan?.badgeColor || '#8b5cf6') + '15',
                        color: c.plan?.badgeColor || '#8b5cf6',
                      }"
                    >
                      {{ c.plan?.displayName || c.plan?.name }}
                    </span>
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs font-bold text-[var(--text-secondary)]">
                    {{ c.durationDays }} 天
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
                    {{ c.bindEmail || '无限制' }}
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
                    {{ c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '永久有效' }}
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)] max-w-[150px] truncate" :title="c.description">
                    {{ c.description || '-' }}
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      :class="
                        c.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : c.status === 'USED'
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-slate-500/10 text-slate-500'
                      "
                    >
                      {{ c.status === 'ACTIVE' ? '未使用' : c.status === 'USED' ? '已使用' : '已失效' }}
                    </span>
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
                    <div v-if="c.usedBy">
                      <p class="font-bold text-[var(--text-primary)]">{{ c.usedBy.name || '已使用' }}</p>
                      <p class="text-[9px] text-[var(--text-muted)]">{{ c.usedBy.email }}</p>
                    </div>
                    <div v-else>-</div>
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
                    {{ new Date(c.createdAt).toLocaleString() }}
                  </td>
                  <td class="px-4 sm:px-6 py-3.5 sm:py-4">
                    <button
                      class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-500 transition-all"
                      title="删除"
                      @click="handleDeleteCode(c)"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredCodes.length === 0">
                  <td colspan="8" class="px-6 py-16 text-center">
                    <div class="flex flex-col items-center gap-3 opacity-20">
                      <Ticket class="w-10 h-10" />
                      <p class="text-sm font-medium">暂无激活码记录</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Card View -->
          <div class="md:hidden space-y-4">
            <div
              v-for="c in filteredCodes"
              :key="c.id"
              class="p-5 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] space-y-4 text-xs"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2 min-w-0">
                  <code class="text-xs font-mono font-bold text-[var(--text-primary)] select-all truncate">{{ c.code }}</code>
                  <button
                    class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 hover:text-accent transition-all shrink-0"
                    title="复制激活码"
                    @click="copyToClipboard(c.code)"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
                <div class="flex flex-row items-center gap-1.5 shrink-0">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    :style="{
                      backgroundColor: (c.plan?.badgeColor || '#8b5cf6') + '15',
                      color: c.plan?.badgeColor || '#8b5cf6',
                    }"
                  >
                    {{ c.plan?.displayName || c.plan?.name }}
                  </span>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    :class="
                      c.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : c.status === 'USED'
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-slate-500/10 text-slate-500'
                    "
                  >
                    {{ c.status === 'ACTIVE' ? '未使用' : c.status === 'USED' ? '已使用' : '已失效' }}
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-4 gap-1.5 text-[9px] xs:text-[10px] border-t border-[var(--border-base)] pt-3 min-w-0">
                <div class="min-w-0">
                  <span class="text-[var(--text-muted)] block mb-0.5 truncate">天数</span>
                  <span class="font-bold text-[var(--text-secondary)] truncate block">{{ c.durationDays }}天</span>
                </div>
                <div class="min-w-0">
                  <span class="text-[var(--text-muted)] block mb-0.5 truncate">绑定邮箱</span>
                  <span class="font-bold text-[var(--text-secondary)] truncate block" :title="c.bindEmail || '无限制'">
                    {{ c.bindEmail || '无限制' }}
                  </span>
                </div>
                <div class="min-w-0">
                  <span class="text-[var(--text-muted)] block mb-0.5 truncate">过期时间</span>
                  <span class="font-bold text-[var(--text-secondary)] truncate block">
                    {{ c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '永久有效' }}
                  </span>
                </div>
                <div class="min-w-0">
                  <span class="text-[var(--text-muted)] block mb-0.5 truncate">生成时间</span>
                  <span class="font-bold text-[var(--text-secondary)] truncate block">
                    {{ new Date(c.createdAt).toLocaleDateString() }}
                  </span>
                </div>
                <div class="col-span-2 border-t border-[var(--border-base)] pt-2.5">
                  <span class="text-[var(--text-muted)] block mb-0.5">备注</span>
                  <p class="text-[var(--text-secondary)] text-xs line-clamp-2">{{ c.description || '-' }}</p>
                </div>
                <div v-if="c.usedBy" class="col-span-2 border-t border-[var(--border-base)] pt-2.5 min-w-0">
                  <span class="text-[var(--text-muted)] block mb-0.5">使用者</span>
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="font-bold text-[var(--text-primary)] text-xs truncate">{{ c.usedBy.name || '已使用' }}</span>
                    <span class="text-[var(--text-muted)] text-[10px] font-mono truncate">({{ c.usedBy.email }})</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end pt-3 border-t border-[var(--border-base)]">
                <button
                  class="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold transition-all"
                  @click="handleDeleteCode(c)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  删除激活码
                </button>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="filteredCodes.length === 0" class="py-16 text-center">
              <div class="flex flex-col items-center gap-3 opacity-20">
                <Ticket class="w-10 h-10" />
                <p class="text-sm font-medium">暂无激活码记录</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Plan Edit/Create Dialog -->
    <Transition name="fade">
      <div v-if="showPlanDialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="showPlanDialog = false"
        ></div>
        <div
          class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-8 rounded-3xl shadow-2xl space-y-6 bg-[var(--bg-card)]"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold text-[var(--text-primary)]">
              {{ editingPlan ? '编辑计划' : '新建计划' }}
            </h3>
            <button class="text-[var(--text-secondary)]" @click="showPlanDialog = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >计划标识 (英文)</label
              >
              <input
                v-model="planForm.name"
                type="text"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="e.g. VIP"
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >显示名称</label
              >
              <input
                v-model="planForm.displayName"
                type="text"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="e.g. 专业版"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >月付价格 (￥)</label
              >
              <input
                v-model.number="planForm.price"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >年付价格 (￥)</label
              >
              <input
                v-model.number="planForm.yearlyPrice"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="留空则不支持年付"
              />
            </div>
          </div>

          <div class="grid grid-cols-4 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >存储 (GB)</label
              >
              <input
                v-model.number="planForm.maxStorage"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >团队数</label
              >
              <input
                v-model.number="planForm.maxTeams"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >项目数</label
              >
              <input
                v-model.number="planForm.maxProjects"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >资产数</label
              >
              <input
                v-model.number="planForm.maxAssets"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >排序优先级</label
              >
              <input
                v-model.number="planForm.priority"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >徽章颜色</label
              >
              <input
                v-model="planForm.badgeColor"
                type="color"
                class="w-full h-12 rounded-2xl border cursor-pointer"
                style="border-color: var(--border-base)"
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >推荐标记</label
              >
              <button
                class="w-full h-12 rounded-2xl border flex items-center justify-center gap-2 transition-all"
                :class="
                  planForm.isPopular
                    ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                    : 'border-[var(--border-base)] text-[var(--text-muted)]'
                "
                style="border-color: planForm.isPopular ? undefined : 'var(--border-base)'"
                @click="planForm.isPopular = !planForm.isPopular"
              >
                <component :is="planForm.isPopular ? Check : X" class="w-4 h-4" />
                <span class="text-xs font-bold">{{ planForm.isPopular ? '推荐' : '普通' }}</span>
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >功能特性</label
            >
            <div class="flex gap-2">
              <input
                v-model="newFeature"
                type="text"
                class="flex-1 px-4 py-2 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="输入功能描述后按回车添加"
                @keyup.enter="addFeature"
              />
              <button
                class="px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold"
                @click="addFeature"
              >
                添加
              </button>
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              <span
                v-for="(feature, idx) in planForm.features"
                :key="idx"
                class="flex items-center gap-1 px-3 py-1 bg-[var(--bg-app)] rounded-lg text-xs text-[var(--text-secondary)]"
              >
                {{ feature }}
                <button class="text-slate-400 hover:text-rose-500" @click="removeFeature(idx)">
                  <X class="w-3 h-3" />
                </button>
              </span>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button
              class="flex-1 py-3 rounded-2xl font-bold text-sm border border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-all"
              @click="showPlanDialog = false"
            >
              取消
            </button>
            <button
              class="flex-1 py-3 rounded-2xl font-bold text-sm bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2"
              @click="handleSavePlan"
            >
              <Save class="w-4 h-4" /> {{ editingPlan ? '保存更改' : '创建计划' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Subscription Edit/Create Dialog -->
    <Transition name="fade">
      <div v-if="showSubDialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="showSubDialog = false"
        ></div>
        <div
          class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-8 rounded-3xl shadow-2xl space-y-6 bg-[var(--bg-card)]"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold text-[var(--text-primary)]">
              {{ editingSubscription ? '编辑订阅' : '新增订阅' }}
            </h3>
            <button class="text-[var(--text-secondary)]" @click="showSubDialog = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- User Selection -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >用户</label
            >
            <div
              v-if="editingSubscription"
              class="px-4 py-3 rounded-2xl border bg-[var(--bg-app)] border-[var(--border-base)]"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500"
                >
                  {{
                    (editingSubscription.user?.name || editingSubscription.user?.email || '?')
                      .charAt(0)
                      .toUpperCase()
                  }}
                </div>
                <div>
                  <p class="text-sm font-bold text-[var(--text-primary)]">
                    {{ editingSubscription.user?.name || '未命名' }}
                  </p>
                  <p class="text-[10px] text-[var(--text-muted)]">
                    {{ editingSubscription.user?.email }}
                  </p>
                </div>
              </div>
            </div>
            <div v-else class="space-y-2">
              <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  v-model="userSearchQuery"
                  type="text"
                  class="w-full pl-10 pr-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                  placeholder="搜索用户名或邮箱..."
                />
              </div>
              <div
                class="max-h-48 overflow-y-auto rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] scrollbar-hide"
              >
                <button
                  v-for="user in availableUsers"
                  :key="user.id"
                  class="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-card)] transition-all text-left"
                  :class="subForm.userId === user.id ? 'bg-accent/5 ring-1 ring-accent/20' : ''"
                  @click="subForm.userId = user.id"
                >
                  <div
                    class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0"
                  >
                    {{ (user.name || user.email || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-[var(--text-primary)] truncate">
                      {{ user.name || '未命名' }}
                    </p>
                    <p class="text-[10px] text-[var(--text-muted)] truncate">{{ user.email }}</p>
                  </div>
                  <Check
                    v-if="subForm.userId === user.id"
                    class="w-4 h-4 text-accent ml-auto shrink-0"
                  />
                </button>
                <div
                  v-if="availableUsers.length === 0"
                  class="px-4 py-8 text-center text-xs text-[var(--text-muted)]"
                >
                  {{ userSearchQuery ? '未找到匹配用户' : '所有用户已有订阅' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Plan Selection -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >订阅计划</label
            >
            <div class="grid grid-cols-3 gap-3">
              <button
                v-for="plan in plans"
                :key="plan.id"
                class="p-4 rounded-2xl border-2 transition-all text-left"
                :class="
                  subForm.planId === plan.id
                    ? 'border-accent bg-accent/5'
                    : 'border-[var(--border-base)] hover:border-accent/30'
                "
                @click="subForm.planId = plan.id"
              >
                <div class="flex items-center gap-2 mb-1">
                  <component
                    :is="getPlanIcon(plan.name)"
                    class="w-4 h-4"
                    :style="{ color: plan.badgeColor || '#8b5cf6' }"
                  />
                  <span class="text-xs font-black text-[var(--text-primary)]">{{
                    plan.displayName || plan.name
                  }}</span>
                </div>
                <p class="text-[10px] text-[var(--text-muted)]">￥{{ plan.price }}/月</p>
              </button>
            </div>
          </div>

          <!-- Status & Interval -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >订阅状态</label
              >
              <select
                v-model="subForm.status"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              >
                <option value="ACTIVE">活跃</option>
                <option value="CANCELED">已取消</option>
                <option value="EXPIRED">已过期</option>
                <option value="PAST_DUE">逾期</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >计费周期</label
              >
              <select
                v-model="subForm.interval"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              >
                <option value="MONTHLY">月付</option>
                <option value="YEARLY">年付</option>
              </select>
            </div>
          </div>

          <!-- Dates -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >开始日期</label
              >
              <input
                v-model="subForm.startDate"
                type="datetime-local"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >到期日期</label
              >
              <input
                v-model="subForm.endDate"
                type="datetime-local"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
          </div>

          <!-- Payment Method -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >支付方式</label
            >
            <select
              v-model="subForm.paymentMethod"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            >
              <option value="ADMIN_ASSIGN">管理员分配</option>
              <option value="ALIPAY">支付宝</option>
              <option value="WECHAT">微信支付</option>
              <option value="CARD">银行卡</option>
              <option value="MOCK_PAYMENT">模拟支付</option>
            </select>
          </div>

          <!-- Toggles -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >自动续费</label
              >
              <button
                class="w-full h-12 rounded-2xl border flex items-center justify-center gap-2 transition-all"
                :class="
                  subForm.autoRenew
                    ? 'border-emerald-500 bg-emerald-500/5 text-emerald-500'
                    : 'border-[var(--border-base)] text-[var(--text-muted)]'
                "
                style="border-color: subForm.autoRenew ? undefined : 'var(--border-base)'"
                @click="subForm.autoRenew = !subForm.autoRenew"
              >
                <component :is="subForm.autoRenew ? Check : X" class="w-4 h-4" />
                <span class="text-xs font-bold">{{ subForm.autoRenew ? '已开启' : '已关闭' }}</span>
              </button>
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >周期结束取消</label
              >
              <button
                class="w-full h-12 rounded-2xl border flex items-center justify-center gap-2 transition-all"
                :class="
                  subForm.cancelAtPeriodEnd
                    ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                    : 'border-[var(--border-base)] text-[var(--text-muted)]'
                "
                style="border-color: subForm.cancelAtPeriodEnd ? undefined : 'var(--border-base)'"
                @click="subForm.cancelAtPeriodEnd = !subForm.cancelAtPeriodEnd"
              >
                <component :is="subForm.cancelAtPeriodEnd ? Check : X" class="w-4 h-4" />
                <span class="text-xs font-bold">{{
                  subForm.cancelAtPeriodEnd ? '将取消' : '不取消'
                }}</span>
              </button>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button
              class="flex-1 py-3 rounded-2xl font-bold text-sm border border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-all"
              @click="showSubDialog = false"
            >
              取消
            </button>
            <button
              class="flex-1 py-3 rounded-2xl font-bold text-sm bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2"
              @click="handleSaveSubscription"
            >
              <Save class="w-4 h-4" /> {{ editingSubscription ? '保存更改' : '创建订阅' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Code Generate Dialog -->
    <Transition name="fade">
      <div v-if="showCodeDialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="showCodeDialog = false"
        ></div>
        <div
          class="relative w-full max-w-md p-5 sm:p-8 rounded-3xl shadow-2xl space-y-6 bg-[var(--bg-card)] max-h-[85vh] overflow-y-auto scrollbar-hide"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold text-[var(--text-primary)]">
              生成激活码
            </h3>
            <button class="text-[var(--text-secondary)]" @click="showCodeDialog = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Plan Selection -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">订阅计划</label>
            <select
              v-model="codeForm.planId"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            >
              <option v-for="plan in plans" :key="plan.id" :value="plan.id">
                {{ plan.displayName || plan.name }} (￥{{ plan.price }}/月)
              </option>
            </select>
          </div>

          <!-- Duration Preset & Custom Days -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">卡片类型 / 持续时间</label>
            <div class="grid grid-cols-5 gap-2">
              <button
                v-for="preset in [
                  { label: '月卡', value: '30' },
                  { label: '季卡', value: '90' },
                  { label: '半年', value: '180' },
                  { label: '年卡', value: '365' },
                  { label: '自定义', value: 'custom' }
                ]"
                :key="preset.value"
                type="button"
                class="py-2 text-[10px] font-bold rounded-xl border transition-all"
                :style="{
                  backgroundColor: codeForm.durationPreset === preset.value ? 'rgba(var(--color-primary-rgb, 14, 165, 233), 0.15)' : 'var(--bg-app)',
                  borderColor: codeForm.durationPreset === preset.value ? 'var(--accent)' : 'var(--border-base)',
                  color: codeForm.durationPreset === preset.value ? 'var(--accent)' : 'var(--text-secondary)'
                }"
                @click="codeForm.durationPreset = preset.value"
              >
                {{ preset.label }}
              </button>
            </div>
            <!-- Custom Days Input -->
            <div v-if="codeForm.durationPreset === 'custom'" class="pt-2">
              <input
                v-model.number="codeForm.durationDays"
                type="number"
                min="1"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="请输入自定义天数，例如 15 天"
              />
            </div>
            <div v-else class="text-[10px] text-emerald-500 font-bold ml-1">
              已选择: {{ codeForm.durationDays }} 天
            </div>
          </div>

          <!-- Code Prefix -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">激活码前缀 (可选)</label>
            <input
              v-model="codeForm.prefix"
              type="text"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="如 'VIP'，格式将为 VIP-PLAN-XXXX..."
            />
          </div>

          <!-- Bind Email -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">绑定邮箱限制 (可选)</label>
            <input
              v-model="codeForm.bindEmail"
              type="email"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="仅限指定邮箱用户兑换"
            />
          </div>

          <!-- Expiration Date -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">过期失效日期 (可选)</label>
            <input
              v-model="codeForm.expiresAt"
              type="date"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>

          <!-- Description -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">使用备注 (可选)</label>
            <input
              v-model="codeForm.description"
              type="text"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="如 '活动赠送'、'测试激活码'"
            />
          </div>

          <!-- Quantity -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">生成数量</label>
            <input
              v-model.number="codeForm.quantity"
              type="number"
              min="1"
              max="100"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="如 5"
            />
          </div>

          <div class="flex gap-3 pt-4">
            <button
              class="flex-1 py-3 rounded-2xl font-bold text-sm border border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-all"
              @click="showCodeDialog = false"
            >
              取消
            </button>
            <button
              :disabled="isGeneratingCodes"
              class="flex-1 py-3 rounded-2xl font-bold text-sm bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              @click="handleGenerateCodes"
            >
              <template v-if="isGeneratingCodes">
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                生成中...
              </template>
              <template v-else>
                生成激活码
              </template>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

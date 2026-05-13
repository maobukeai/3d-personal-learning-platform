<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  CreditCard, 
  Check, 
  Zap, 
  Crown, 
  History, 
  ShieldCheck, 
  ArrowUpRight,
  Download,
  X,
  ToggleLeft,
  ToggleRight,
  FolderOpen,
  Box,
  Shield,
  KeyRound,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Users
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const plans = ref<any[]>([])
const mySubscription = ref<any>(null)
const transactions = ref<any[]>([])
const selectedPlanId = ref('')
const billingInterval = ref<'MONTHLY' | 'YEARLY'>('MONTHLY')
const storageUsage = ref<any>(null)
const subscriptionLimits = ref<any>(null)
const showCancelDialog = ref(false)
const cancelType = ref<'immediate' | 'end_of_period'>('end_of_period')
const cancelRequires2FA = ref(false)
const twoFactorCode = ref('')
const isVerifying2FA = ref(false)
const cancelStep = ref<'confirm' | '2fa' | 'success'>('confirm')
const showUpgradeDialog = ref(false)
const upgradePlan = ref<any>(null)

const fetchBillingData = async () => {
  isLoading.value = true
  try {
    const [plansRes, subRes, transRes, storageRes, limitsRes] = await Promise.all([
      api.get('/api/subscriptions/plans'),
      api.get('/api/subscriptions/me'),
      api.get('/api/subscriptions/transactions'),
      api.get('/api/subscriptions/storage-usage'),
      api.get('/api/subscriptions/limits')
    ])
    plans.value = plansRes.data
    mySubscription.value = subRes.data
    transactions.value = transRes.data
    storageUsage.value = storageRes.data
    subscriptionLimits.value = limitsRes.data
    selectedPlanId.value = subRes.data.plan?.id || plans.value.find((p: any) => p.name === 'FREE')?.id
    billingInterval.value = subRes.data.interval || 'MONTHLY'
  } catch (error) {
    ElMessage.error('获取账单数据失败')
  } finally {
    isLoading.value = false
  }
}

const checkCancel2FA = async () => {
  try {
    const res = await api.get('/api/subscriptions/cancel-requires-2fa')
    cancelRequires2FA.value = res.data.requires2FA
  } catch (error) {
    cancelRequires2FA.value = false
  }
}

const handleSubscribe = async (plan: any) => {
  if (plan.id === mySubscription.value?.plan?.id && mySubscription.value?.status === 'ACTIVE') {
    ElMessage.info('您已订阅此计划')
    return
  }

  const currentPriority = mySubscription.value?.plan?.priority || 0
  const newPriority = plan.priority || 0
  const isUpgrade = newPriority > currentPriority && mySubscription.value?.plan?.name !== 'FREE'
  const isRenewal = newPriority === currentPriority && mySubscription.value?.status === 'ACTIVE'

  if (isUpgrade || isRenewal) {
    upgradePlan.value = plan
    showUpgradeDialog.value = true
    return
  }

  try {
    const { data } = await api.post('/api/subscriptions/create-order', {
      planId: plan.id,
      interval: billingInterval.value
    })
    
    router.push({
      name: 'Checkout',
      query: {
        orderId: data.orderId,
        amount: data.amount,
        planName: plan.displayName || plan.name
      }
    })
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '创建订单失败')
  }
}

const handleConfirmUpgrade = async () => {
  if (!upgradePlan.value) return

  try {
    const { data } = await api.post('/api/subscriptions/create-order', {
      planId: upgradePlan.value.id,
      interval: billingInterval.value
    })

    router.push({
      name: 'Checkout',
      query: {
        orderId: data.orderId,
        amount: data.amount,
        planName: upgradePlan.value.displayName || upgradePlan.value.name
      }
    })
    showUpgradeDialog.value = false
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败')
  }
}

const openCancelDialog = async () => {
  cancelStep.value = 'confirm'
  twoFactorCode.value = ''
  cancelType.value = 'end_of_period'
  showCancelDialog.value = true
  await checkCancel2FA()
}

const handleCancelSubscription = async () => {
  if (cancelRequires2FA.value) {
    cancelStep.value = '2fa'
    return
  }

  try {
    const res = await api.post('/api/subscriptions/cancel', {
      immediate: cancelType.value === 'immediate'
    })
    ElMessage.success(res.data.message)
    showCancelDialog.value = false
    cancelStep.value = 'success'
    const authStore = useAuthStore()
    await authStore.fetchMe()
    fetchBillingData()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '取消订阅失败')
  }
}

const handleCancelWith2FA = async () => {
  if (!twoFactorCode.value || twoFactorCode.value.length < 6) {
    ElMessage.warning('请输入6位验证码')
    return
  }

  isVerifying2FA.value = true
  try {
    const res = await api.post('/api/subscriptions/cancel-with-2fa', {
      immediate: cancelType.value === 'immediate',
      twoFactorCode: twoFactorCode.value
    })
    ElMessage.success(res.data.message)
    showCancelDialog.value = false
    cancelStep.value = 'success'
    const authStore = useAuthStore()
    await authStore.fetchMe()
    fetchBillingData()
  } catch (error: any) {
    if (error.response?.data?.requires2FA) {
      ElMessage.error('需要两步验证')
    } else {
      ElMessage.error(error.response?.data?.error || '验证失败，请重试')
    }
  } finally {
    isVerifying2FA.value = false
  }
}

const handleToggleAutoRenew = async () => {
  if (!mySubscription.value) return
  const newValue = !mySubscription.value.autoRenew
  try {
    const res = await api.post('/api/subscriptions/auto-renew', { autoRenew: newValue })
    ElMessage.success(res.data.message)
    mySubscription.value.autoRenew = newValue
    mySubscription.value.cancelAtPeriodEnd = !newValue
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败')
  }
}

const handleExportBilling = () => {
  if (transactions.value.length === 0) {
    ElMessage.info('暂无交易记录可导出')
    return
  }
  const headers = ['日期', '项目描述', '金额', '状态', '支付方式', '发票号']
  const rows = transactions.value.map((tx: any) => [
    new Date(tx.createdAt).toLocaleDateString(),
    tx.description || '',
    `￥${tx.amount}`,
    tx.status === 'COMPLETED' ? '已支付' : tx.status === 'PENDING' ? '处理中' : '失败',
    tx.paymentMethod || '-',
    tx.invoiceNo || '-'
  ])
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `billing_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('账单已导出')
}

const getPlanIcon = (name: string) => {
  if (name === 'VIP') return Zap
  if (name === 'SVIP') return Crown
  return CreditCard
}

const getPlanColor = (name: string) => {
  if (name === 'VIP') return 'text-violet-500'
  if (name === 'SVIP') return 'text-amber-500'
  return 'text-blue-500'
}

const getPlanBgColor = (name: string) => {
  if (name === 'VIP') return 'bg-violet-500'
  if (name === 'SVIP') return 'bg-amber-500'
  return 'bg-blue-500'
}

const storageProgress = computed(() => {
  if (!storageUsage.value) return 0
  return storageUsage.value.usagePercent || 0
})

const storageDisplayText = computed(() => {
  if (!storageUsage.value) return '0 MB / 1 GB'
  const used = storageUsage.value.usedGB > 0
    ? `${storageUsage.value.usedGB} GB`
    : `${storageUsage.value.usedMB} MB`
  return `${used} / ${storageUsage.value.maxStorageGB} GB`
})

const isPaidPlan = computed(() => {
  return mySubscription.value?.plan?.name !== 'FREE' && mySubscription.value?.status === 'ACTIVE'
})

const isCancelPending = computed(() => {
  return mySubscription.value?.cancelAtPeriodEnd === true
})

const getDisplayPrice = (plan: any) => {
  if (billingInterval.value === 'YEARLY' && plan.yearlyPrice) {
    return plan.yearlyPrice
  }
  return plan.price
}

const getMonthlyEquivalent = (plan: any) => {
  if (billingInterval.value === 'YEARLY' && plan.yearlyPrice) {
    return Math.round(plan.yearlyPrice / 12)
  }
  return null
}

const isUpgradeAvailable = (plan: any) => {
  const currentPriority = mySubscription.value?.plan?.priority || 0
  return plan.priority > currentPriority && mySubscription.value?.status === 'ACTIVE' && mySubscription.value?.plan?.name !== 'FREE'
}

const isRenewalAvailable = (plan: any) => {
  return plan.id === mySubscription.value?.plan?.id && mySubscription.value?.status === 'ACTIVE'
}

const getUpgradePriceDiff = (plan: any) => {
  const currentPrice = mySubscription.value?.plan?.price || 0
  return plan.price - currentPrice
}

onMounted(() => {
  fetchBillingData()
  
  if (route.query.success === 'true') {
    ElMessage.success('支付成功！您的订阅权限已生效。')
    router.replace({ name: 'Billing' })
  }
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)]">
    <div class="h-16 px-8 flex items-center justify-between shrink-0 border-b border-[var(--border-base)] bg-[var(--bg-card)]">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600">
          <CreditCard class="w-5 h-5" />
        </div>
        <h1 class="text-xl font-bold text-[var(--text-primary)]">订阅与账单</h1>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-6xl mx-auto space-y-10">
        
        <!-- Current Status & Storage -->
        <div class="grid md:grid-cols-3 gap-6">
          <div class="md:col-span-2 p-8 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] shadow-sm relative overflow-hidden group">
            <div class="relative z-10">
              <div class="flex items-center justify-between mb-8">
                <div>
                  <h3 class="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest">当前订阅计划</h3>
                  <div class="flex items-baseline gap-2 mt-2">
                    <span class="text-4xl font-black text-[var(--text-primary)]">{{ mySubscription?.plan?.displayName || mySubscription?.plan?.name || '免费版' }}</span>
                    <span v-if="isPaidPlan" class="px-2 py-0.5 rounded-full text-[10px] font-black" :style="{ backgroundColor: (mySubscription?.plan?.badgeColor || '#8b5cf6') + '20', color: mySubscription?.plan?.badgeColor || '#8b5cf6' }">
                      {{ mySubscription?.interval === 'YEARLY' ? '年付' : '月付' }}
                    </span>
                    <span v-if="isCancelPending" class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-500">
                      待取消
                    </span>
                  </div>
                </div>
                <div class="p-4 rounded-2xl" :style="{ backgroundColor: (mySubscription?.plan?.badgeColor || '#3b82f6') + '15', color: mySubscription?.plan?.badgeColor || '#3b82f6' }">
                  <component :is="getPlanIcon(mySubscription?.plan?.name)" class="w-8 h-8" />
                </div>
              </div>

              <div class="space-y-4">
                <div class="flex items-center justify-between text-xs font-bold">
                  <span class="text-[var(--text-secondary)]">存储空间使用量</span>
                  <span class="text-[var(--text-primary)]">{{ storageDisplayText }}</span>
                </div>
                <div class="h-3 w-full bg-[var(--bg-app)] rounded-full overflow-hidden p-0.5 border border-[var(--border-base)]">
                  <div 
                    class="h-full rounded-full transition-all duration-1000 ease-out"
                    :class="storageProgress > 90 ? 'bg-rose-500' : storageProgress > 70 ? 'bg-amber-500' : 'bg-accent'"
                    :style="{ width: `${storageProgress}%` }"
                  ></div>
                </div>

                <div class="grid grid-cols-3 gap-4 pt-2">
                  <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <FolderOpen class="w-3.5 h-3.5" />
                    <span>项目: {{ subscriptionLimits?.currentProjects || 0 }}/{{ subscriptionLimits?.maxProjects === 9999 ? '∞' : subscriptionLimits?.maxProjects || 5 }}</span>
                  </div>
                  <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <Box class="w-3.5 h-3.5" />
                    <span>资产: {{ subscriptionLimits?.currentAssets || 0 }}/{{ subscriptionLimits?.maxAssets === 9999 ? '∞' : subscriptionLimits?.maxAssets || 50 }}</span>
                  </div>
                  <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <Users class="w-3.5 h-3.5" />
                    <span>团队: {{ subscriptionLimits?.currentTeams || 0 }}/{{ subscriptionLimits?.maxTeams === 999 ? '∞' : subscriptionLimits?.maxTeams || 1 }}</span>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-2">
                  <p class="text-[10px] text-[var(--text-muted)]">
                    <template v-if="mySubscription?.endDate && isPaidPlan">
                      {{ isCancelPending ? '取消日期' : '下次结算日期' }}: {{ new Date(mySubscription.endDate).toLocaleDateString() }}
                    </template>
                  </p>
                </div>
              </div>
            </div>
            
            <div class="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl group-hover:opacity-75 transition-opacity" :style="{ backgroundColor: (mySubscription?.plan?.badgeColor || '#3b82f6') + '08' }"></div>
          </div>

          <div class="p-8 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] shadow-sm flex flex-col justify-between">
            <div class="space-y-4">
              <div class="flex items-center gap-3 text-emerald-500">
                <ShieldCheck class="w-6 h-6" />
                <h3 class="font-bold">支付安全</h3>
              </div>
              <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
                我们采用业界标准的加密技术保护您的支付信息。所有交易均经过安全处理。
              </p>
            </div>

            <div v-if="isPaidPlan" class="space-y-3 mt-6">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-[var(--text-secondary)]">自动续费</span>
                <button @click="handleToggleAutoRenew" class="transition-colors">
                  <component :is="mySubscription?.autoRenew ? ToggleRight : ToggleLeft" class="w-8 h-8" :class="mySubscription?.autoRenew ? 'text-accent' : 'text-slate-400'" />
                </button>
              </div>
              <button @click="openCancelDialog" class="w-full py-3 border-2 border-dashed border-rose-200 dark:border-rose-900/30 rounded-2xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all flex items-center justify-center gap-2">
                <X class="w-3.5 h-3.5" /> 取消订阅
              </button>
            </div>
            <button v-else class="w-full py-4 mt-6 border-2 border-dashed border-[var(--border-base)] rounded-2xl text-xs font-bold text-[var(--text-secondary)] hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2">
              <History class="w-4 h-4" /> 管理付款方式
            </button>
          </div>
        </div>

        <!-- Pricing Plans -->
        <div class="space-y-6">
          <div class="text-center space-y-4">
            <h2 class="text-3xl font-black text-[var(--text-primary)]">选择适合您的方案</h2>
            <p class="text-[var(--text-secondary)]">解锁更多 3D 资产、高级材质和无限协作空间</p>
            
            <div class="flex items-center justify-center gap-3 pt-2">
              <span class="text-sm font-bold" :class="billingInterval === 'MONTHLY' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'">月付</span>
              <button 
                @click="billingInterval = billingInterval === 'MONTHLY' ? 'YEARLY' : 'MONTHLY'"
                class="relative w-14 h-7 rounded-full transition-colors duration-300"
                :class="billingInterval === 'YEARLY' ? 'bg-accent' : 'bg-slate-200 dark:bg-slate-700'"
              >
                <div class="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300" :class="billingInterval === 'YEARLY' ? 'translate-x-7' : 'translate-x-0.5'"></div>
              </button>
              <span class="text-sm font-bold" :class="billingInterval === 'YEARLY' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'">年付</span>
              <span v-if="billingInterval === 'YEARLY'" class="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full">省20%</span>
            </div>
          </div>

          <div class="grid md:grid-cols-3 gap-8 pt-6">
            <div 
              v-for="plan in plans" 
              :key="plan.id"
              class="relative p-8 rounded-[2.5rem] border transition-all duration-500 flex flex-col h-full overflow-hidden"
              :class="[
                plan.id === mySubscription?.plan?.id && mySubscription?.status === 'ACTIVE'
                  ? 'border-accent bg-accent/5 ring-1 ring-accent shadow-2xl shadow-accent/20' 
                  : 'border-[var(--border-base)] bg-[var(--bg-card)] hover:shadow-xl hover:scale-[1.02]'
              ]"
            >
              <div v-if="plan.isPopular" class="absolute top-6 right-6 px-3 py-1 text-white text-[10px] font-black rounded-full uppercase tracking-widest" :class="getPlanBgColor(plan.name)">
                推荐
              </div>

              <div v-if="isUpgradeAvailable(plan)" class="absolute top-6 left-6 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full flex items-center gap-1">
                <TrendingUp class="w-3 h-3" /> 可升级
              </div>

              <div class="mb-8">
                <div class="p-3 bg-[var(--bg-app)] w-fit rounded-2xl mb-4">
                  <component :is="getPlanIcon(plan.name)" class="w-6 h-6" :class="getPlanColor(plan.name)" />
                </div>
                <h3 class="text-xl font-black text-[var(--text-primary)]">{{ plan.displayName || plan.name }}</h3>
                <div class="mt-4 flex items-baseline gap-1">
                  <span class="text-4xl font-black text-[var(--text-primary)]">￥{{ getDisplayPrice(plan) }}</span>
                  <span class="text-sm font-medium text-[var(--text-secondary)]">/{{ billingInterval === 'YEARLY' ? '年' : '月' }}</span>
                </div>
                <p v-if="getMonthlyEquivalent(plan)" class="text-xs text-emerald-500 font-bold mt-1">
                  ≈ ￥{{ getMonthlyEquivalent(plan) }}/月，年付省 ￥{{ plan.price * 12 - plan.yearlyPrice }}
                </p>
                <p v-if="plan.yearlyDiscount && billingInterval === 'YEARLY'" class="text-[10px] text-[var(--text-muted)] mt-0.5">
                  相比月付节省 {{ plan.yearlyDiscount }}%
                </p>
                <p v-if="isUpgradeAvailable(plan)" class="text-xs text-amber-500 font-bold mt-2 flex items-center gap-1">
                  <TrendingUp class="w-3 h-3" /> 升级差价 ￥{{ getUpgradePriceDiff(plan) }}/月
                </p>
              </div>

              <ul class="space-y-4 mb-10 flex-1">
                <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-3">
                  <div class="p-1 bg-emerald-500/10 rounded-full text-emerald-500 shrink-0 mt-0.5">
                    <Check class="w-3 h-3" />
                  </div>
                  <span class="text-sm text-[var(--text-secondary)]">{{ feature }}</span>
                </li>
              </ul>

              <button 
                @click="handleSubscribe(plan)"
                class="w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                :class="[
                  plan.id === mySubscription?.plan?.id && mySubscription?.status === 'ACTIVE'
                    ? isRenewalAvailable(plan)
                      ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 cursor-pointer'
                      : 'bg-emerald-500 text-white cursor-default'
                    : plan.isPopular
                      ? 'bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20'
                      : 'bg-[var(--bg-app)] text-[var(--text-primary)] border border-[var(--border-base)] hover:border-accent hover:text-accent'
                ]"
              >
                <template v-if="plan.id === mySubscription?.plan?.id && mySubscription?.status === 'ACTIVE'">
                  <template v-if="isRenewalAvailable(plan)">
                    <RefreshCw class="w-4 h-4" /> 续费
                  </template>
                  <template v-else>
                    <Check class="w-4 h-4" /> 当前方案
                  </template>
                </template>
                <template v-else-if="isUpgradeAvailable(plan)">
                  升级 <TrendingUp class="w-4 h-4" />
                </template>
                <template v-else>
                  立即升级 <ArrowUpRight class="w-4 h-4" />
                </template>
              </button>
            </div>
          </div>
        </div>

        <!-- Plan Comparison Table -->
        <div class="space-y-6">
          <h2 class="text-xl font-bold text-[var(--text-primary)]">方案对比</h2>
          <div class="rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] overflow-hidden">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-[var(--bg-app)]/50 border-b border-[var(--border-base)]">
                  <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">功能</th>
                  <th v-for="plan in plans" :key="plan.id" class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-center" :class="getPlanColor(plan.name)">
                    {{ plan.displayName || plan.name }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--border-base)]">
                <tr v-for="row in [
                  { label: '存储空间', values: plans.map((p: any) => p.maxStorage >= 9999 ? '无限' : `${p.maxStorage} GB`) },
                  { label: '协作团队', values: plans.map((p: any) => p.maxTeams >= 999 ? '无限' : `${p.maxTeams} 个`) },
                  { label: '项目数量', values: plans.map((p: any) => p.maxProjects >= 9999 ? '无限' : `${p.maxProjects} 个`) },
                  { label: '资产数量', values: plans.map((p: any) => p.maxAssets >= 9999 ? '无限' : `${p.maxAssets} 个`) },
                  { label: '技术支持', values: ['社区支持', '1对1 支持', '专属客户经理'] },
                  { label: '渲染队列', values: ['标准', '优先', '独立服务器'] },
                ]" :key="row.label" class="hover:bg-[var(--bg-app)]/30 transition-colors">
                  <td class="px-8 py-4 text-sm font-bold text-[var(--text-primary)]">{{ row.label }}</td>
                  <td v-for="(val, idx) in row.values" :key="idx" class="px-8 py-4 text-sm text-center text-[var(--text-secondary)]">
                    {{ val }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Billing History -->
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-[var(--text-primary)]">账单历史</h2>
            <button @click="handleExportBilling" class="text-xs font-bold text-accent hover:underline flex items-center gap-1">
              <Download class="w-3.5 h-3.5" /> 导出所有账单
            </button>
          </div>

          <div class="rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] overflow-hidden">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-[var(--bg-app)]/50 border-b border-[var(--border-base)]">
                  <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">日期</th>
                  <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">项目描述</th>
                  <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">金额</th>
                  <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">状态</th>
                  <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">发票号</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--border-base)]">
                <tr v-for="tx in transactions" :key="tx.id" class="hover:bg-[var(--bg-app)]/30 transition-colors">
                  <td class="px-8 py-5 text-sm font-medium text-[var(--text-primary)]">
                    {{ new Date(tx.createdAt).toLocaleDateString() }}
                  </td>
                  <td class="px-8 py-5">
                    <p class="text-sm font-bold text-[var(--text-primary)]">{{ tx.description }}</p>
                    <p class="text-[10px] text-[var(--text-muted)] mt-0.5">{{ tx.paymentMethod || '-' }}</p>
                  </td>
                  <td class="px-8 py-5 text-sm font-black text-[var(--text-primary)]">
                    ￥{{ tx.amount }}
                  </td>
                  <td class="px-8 py-5">
                    <span 
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      :class="tx.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : tx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'"
                    >
                      {{ tx.status === 'COMPLETED' ? '已支付' : tx.status === 'PENDING' ? '处理中' : '失败' }}
                    </span>
                  </td>
                  <td class="px-8 py-5 text-xs text-[var(--text-muted)] font-mono">
                    {{ tx.invoiceNo || '-' }}
                  </td>
                </tr>
                <tr v-if="transactions.length === 0">
                  <td colspan="5" class="px-8 py-20 text-center">
                    <div class="flex flex-col items-center gap-4 opacity-20">
                      <History class="w-12 h-12" />
                      <p class="text-sm font-medium">暂无交易记录</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- FAQ or Support -->
        <div class="p-8 rounded-3xl bg-blue-600 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-blue-600/20">
          <div class="space-y-2 text-center md:text-left">
            <h3 class="text-xl font-bold">对订阅有疑问？</h3>
            <p class="text-sm text-blue-100 opacity-90">如果您对计划选择或账单有任何疑问，我们的支持团队随时为您提供帮助。</p>
          </div>
          <button @click="$router.push('/report-bug')" class="px-8 py-4 bg-white text-blue-600 font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg">
            联系客户支持
          </button>
        </div>

      </div>
    </div>

    <!-- Cancel Subscription Dialog -->
    <Transition name="fade">
      <div v-if="showCancelDialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showCancelDialog = false"></div>
        <div class="relative w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 bg-[var(--bg-card)]">
          
          <!-- Step 1: Confirm cancel type -->
          <template v-if="cancelStep === 'confirm'">
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-bold text-[var(--text-primary)]">取消订阅</h3>
              <button @click="showCancelDialog = false" class="text-[var(--text-secondary)]"><X class="w-5 h-5" /></button>
            </div>

            <div class="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-900/20">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p class="text-xs font-bold text-amber-800 dark:text-amber-400">取消后您将失去以下权益</p>
                  <ul class="mt-2 space-y-1">
                    <li v-for="(feature, idx) in (mySubscription?.plan?.features || []).slice(0, 3)" :key="idx" class="text-[10px] text-amber-700 dark:text-amber-500">
                      • {{ feature }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <label class="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all" :class="cancelType === 'end_of_period' ? 'border-accent bg-accent/5' : 'border-[var(--border-base)] hover:border-accent/50'">
                <input type="radio" v-model="cancelType" value="end_of_period" class="accent-[var(--accent)]" />
                <div>
                  <p class="text-sm font-bold text-[var(--text-primary)]">周期结束后取消</p>
                  <p class="text-[10px] text-[var(--text-secondary)]">继续享受权益至 {{ mySubscription?.endDate ? new Date(mySubscription.endDate).toLocaleDateString() : '当前周期结束' }}</p>
                </div>
              </label>
              <label class="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all" :class="cancelType === 'immediate' ? 'border-rose-500 bg-rose-500/5' : 'border-[var(--border-base)] hover:border-rose-300'">
                <input type="radio" v-model="cancelType" value="immediate" class="accent-rose-500" />
                <div>
                  <p class="text-sm font-bold text-[var(--text-primary)]">立即取消</p>
                  <p class="text-[10px] text-[var(--text-secondary)]">立即降级为免费版，剩余时间不退款</p>
                </div>
              </label>
            </div>

            <div v-if="cancelRequires2FA" class="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-900/20 flex items-center gap-2">
              <Shield class="w-4 h-4 text-blue-500 shrink-0" />
              <p class="text-[10px] text-blue-700 dark:text-blue-400 font-bold">您的账户已启用两步验证，取消订阅时需要验证身份</p>
            </div>

            <div class="flex gap-3">
              <button @click="showCancelDialog = false" class="flex-1 py-3 rounded-2xl font-bold text-sm border border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-all">
                继续使用
              </button>
              <button @click="handleCancelSubscription" class="flex-1 py-3 rounded-2xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 transition-all">
                {{ cancelRequires2FA ? '下一步' : '确认取消' }}
              </button>
            </div>
          </template>

          <!-- Step 2: 2FA Verification -->
          <template v-if="cancelStep === '2fa'">
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-bold text-[var(--text-primary)]">两步验证</h3>
              <button @click="cancelStep = 'confirm'" class="text-[var(--text-secondary)]"><X class="w-5 h-5" /></button>
            </div>

            <div class="text-center space-y-4 py-4">
              <div class="w-16 h-16 mx-auto bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                <KeyRound class="w-8 h-8 text-blue-500" />
              </div>
              <p class="text-sm text-[var(--text-secondary)]">请输入您的两步验证码以确认取消订阅</p>
              <p class="text-[10px] text-[var(--text-muted)]">打开您的身份验证器应用获取6位验证码</p>
            </div>

            <div class="space-y-4">
              <input
                v-model="twoFactorCode"
                type="text"
                maxlength="6"
                placeholder="输入6位验证码"
                class="w-full px-6 py-4 text-center text-2xl font-mono font-bold tracking-[0.5em] rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                @keyup.enter="handleCancelWith2FA"
              />
            </div>

            <div class="flex gap-3">
              <button @click="cancelStep = 'confirm'" class="flex-1 py-3 rounded-2xl font-bold text-sm border border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-all">
                返回
              </button>
              <button 
                @click="handleCancelWith2FA" 
                :disabled="isVerifying2FA || twoFactorCode.length < 6"
                class="flex-1 py-3 rounded-2xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <template v-if="isVerifying2FA">
                  <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  验证中...
                </template>
                <template v-else>
                  确认取消
                </template>
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>

    <!-- Upgrade/Renewal Dialog -->
    <Transition name="fade">
      <div v-if="showUpgradeDialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showUpgradeDialog = false"></div>
        <div class="relative w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 bg-[var(--bg-card)]">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold text-[var(--text-primary)]">
              {{ isUpgradeAvailable(upgradePlan) ? '升级订阅' : '续费订阅' }}
            </h3>
            <button @click="showUpgradeDialog = false" class="text-[var(--text-secondary)]"><X class="w-5 h-5" /></button>
          </div>

          <div v-if="upgradePlan" class="space-y-4">
            <div class="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-app)]">
              <div class="p-3 rounded-xl" :class="getPlanBgColor(upgradePlan.name)">
                <component :is="getPlanIcon(upgradePlan.name)" class="w-5 h-5 text-white" />
              </div>
              <div>
                <p class="font-bold text-[var(--text-primary)]">{{ upgradePlan.displayName || upgradePlan.name }}</p>
                <p class="text-xs text-[var(--text-secondary)]">
                  ￥{{ getDisplayPrice(upgradePlan) }}/{{ billingInterval === 'YEARLY' ? '年' : '月' }}
                </p>
              </div>
            </div>

            <div v-if="isUpgradeAvailable(upgradePlan)" class="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-900/20">
              <div class="flex items-start gap-3">
                <TrendingUp class="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p class="text-xs font-bold text-emerald-800 dark:text-emerald-400">升级优惠</p>
                  <p class="text-[10px] text-emerald-700 dark:text-emerald-500 mt-1">
                    从 {{ mySubscription?.plan?.displayName || mySubscription?.plan?.name }} 升级至 {{ upgradePlan.displayName || upgradePlan.name }}
                  </p>
                  <p class="text-[10px] text-emerald-700 dark:text-emerald-500">
                    原计划剩余价值将自动抵扣，仅需支付差价
                  </p>
                </div>
              </div>
            </div>

            <div v-else class="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-200 dark:border-blue-900/20">
              <div class="flex items-start gap-3">
                <RefreshCw class="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p class="text-xs font-bold text-blue-800 dark:text-blue-400">续费说明</p>
                  <p class="text-[10px] text-blue-700 dark:text-blue-500 mt-1">
                    续费将从当前日期开始新的订阅周期
                  </p>
                </div>
              </div>
            </div>

            <ul class="space-y-2">
              <li v-for="feature in (upgradePlan.features || []).slice(0, 4)" :key="feature" class="flex items-start gap-2">
                <div class="p-0.5 bg-emerald-500/10 rounded-full text-emerald-500 shrink-0 mt-0.5">
                  <Check class="w-2.5 h-2.5" />
                </div>
                <span class="text-xs text-[var(--text-secondary)]">{{ feature }}</span>
              </li>
              <li v-if="(upgradePlan.features || []).length > 4" class="text-[10px] text-[var(--text-muted)] pl-5">
                还有 {{ (upgradePlan.features || []).length - 4 }} 项权益...
              </li>
            </ul>
          </div>

          <div class="flex gap-3">
            <button @click="showUpgradeDialog = false" class="flex-1 py-3 rounded-2xl font-bold text-sm border border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-all">
              取消
            </button>
            <button @click="handleConfirmUpgrade" class="flex-1 py-3 rounded-2xl font-bold text-sm bg-accent text-white hover:bg-accent-hover transition-all flex items-center justify-center gap-2">
              {{ isUpgradeAvailable(upgradePlan) ? '确认升级' : '确认续费' }}
              <ArrowUpRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

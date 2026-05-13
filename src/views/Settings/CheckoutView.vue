<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft,
  Loader2,
  ShieldCheck,
  Smartphone,
  Scan,
  Wallet
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const route = useRoute()
const router = useRouter()

const orderId = ref(route.query.orderId as string)
const amount = ref(route.query.amount as string)
const planName = ref(route.query.planName as string)

const isLoading = ref(false)
const isVerifying = ref(false)
const payMethod = ref('ALIPAY') // 'ALIPAY', 'WECHAT'

const handlePay = async () => {
  try {
    isLoading.value = true
    // Simulate payment process delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    isVerifying.value = true
    const { data } = await api.post('/api/subscriptions/verify-payment', {
      orderId: orderId.value
    })
    
    ElMessage.success('支付成功！您的会员权限已生效')
    router.push({ name: 'Billing', query: { success: 'true' } })
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '支付失败，请稍后重试')
  } finally {
    isLoading.value = false
    isVerifying.value = false
  }
}

onMounted(() => {
  if (!orderId.value) {
    ElMessage.error('无效的订单请求')
    router.push({ name: 'Billing' })
  }
})
</script>

<template>
  <div class="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-6">
    <div class="w-full max-w-lg bg-[var(--bg-card)] rounded-[2.5rem] border border-[var(--border-base)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
      
      <!-- Top Banner -->
      <div class="bg-accent p-8 text-white relative overflow-hidden">
        <div class="relative z-10">
          <button @click="router.back()" class="p-2 hover:bg-white/10 rounded-full transition-colors mb-4">
            <ChevronLeft class="w-5 h-5" />
          </button>
          <h1 class="text-2xl font-black mb-1">完成支付</h1>
          <p class="text-white/70 text-xs font-bold uppercase tracking-widest">Order #{{ orderId?.substring(0,8) }}</p>
        </div>
        <CreditCard class="absolute -right-12 -bottom-12 w-48 h-48 opacity-10 rotate-12" />
      </div>

      <!-- Order Details -->
      <div class="p-8 space-y-8">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase mb-1">支付项目</p>
            <h2 class="text-lg font-black text-[var(--text-primary)]">{{ planName || '订阅计划' }}</h2>
          </div>
          <div class="text-right">
            <p class="text-xs font-bold text-slate-400 uppercase mb-1">支付金额</p>
            <h2 class="text-3xl font-black text-accent">￥{{ amount }}</h2>
          </div>
        </div>

        <div class="h-[1px] bg-[var(--border-base)]"></div>

        <!-- Payment Methods -->
        <div class="space-y-4">
          <p class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">选择支付方式</p>
          <div class="grid grid-cols-2 gap-4">
            <label class="relative flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all" :class="payMethod === 'ALIPAY' ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-[var(--border-base)] hover:border-accent/50'">
              <input type="radio" v-model="payMethod" value="ALIPAY" class="absolute inset-0 opacity-0" />
              <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <Wallet class="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p class="text-sm font-black text-[var(--text-primary)]">支付宝</p>
                <p class="text-[10px] text-slate-400">Alipay</p>
              </div>
            </label>
            <label class="relative flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all" :class="payMethod === 'WECHAT' ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500' : 'border-[var(--border-base)] hover:border-emerald-300'">
              <input type="radio" v-model="payMethod" value="WECHAT" class="absolute inset-0 opacity-0" />
              <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <Smartphone class="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p class="text-sm font-black text-[var(--text-primary)]">微信支付</p>
                <p class="text-[10px] text-slate-400">WeChat Pay</p>
              </div>
            </label>
          </div>
        </div>

        <!-- QR Mock -->
        <div class="flex flex-col items-center justify-center py-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-[var(--border-base)]">
          <div class="relative group">
            <div class="w-40 h-40 bg-white p-2 rounded-2xl shadow-lg">
              <Scan class="w-full h-full text-slate-100 p-4" />
              <div class="absolute inset-0 flex items-center justify-center">
                <Loader2 v-if="isLoading" class="w-8 h-8 text-accent animate-spin" />
                <p v-else class="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Mock Payment QR</p>
              </div>
            </div>
          </div>
          <p class="mt-4 text-xs font-medium text-slate-400 flex items-center gap-2">
            <ShieldCheck class="w-4 h-4 text-emerald-500" />
            模拟环境：点击下方按钮完成支付流程
          </p>
        </div>

        <!-- Action -->
        <button 
          @click="handlePay"
          :disabled="isLoading"
          class="w-full py-4 bg-slate-900 dark:bg-accent text-white rounded-2xl font-black text-sm shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          <template v-if="isVerifying">
            <Loader2 class="w-5 h-5 animate-spin" />
            正在核销订单...
          </template>
          <template v-else-if="isLoading">
            <Loader2 class="w-5 h-5 animate-spin" />
            正在跳转...
          </template>
          <template v-else>
            立即模拟支付 ￥{{ amount }}
          </template>
        </button>

        <div class="flex items-center justify-center gap-2">
          <AlertCircle class="w-3.5 h-3.5 text-slate-300" />
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Secure Checkout Powered by Gemini MockPay</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-in {
  animation: animate-in 0.5s ease-out;
}
@keyframes animate-in {
  from { opacity: 0; transform: translateY(1rem) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>

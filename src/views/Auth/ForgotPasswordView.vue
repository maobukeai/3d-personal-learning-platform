<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, Lock, Shield, Eye, EyeOff } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const isLoading = ref(false)
const step = ref(1) // 1: Email, 2: 2FA & New Password, 3: Success

const showPassword = ref(false)
const forgotForm = ref({
  code: '',
  newPassword: '',
  confirmPassword: ''
})

const handleCheckEmail = async () => {
  if (!email.value) {
    ElMessage.warning('请输入你的注册邮箱')
    return
  }

  isLoading.value = true
  try {
    const data = await authStore.forgotPasswordCheck(email.value)
    if (data.twoFactorEnabled) {
      step.value = 2
      ElMessage.info('该账户已启用两步验证，请验证身份')
    } else {
      ElMessage.warning('该账户未启用两步验证，邮箱验证功能开发中，请联系管理员')
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '无法验证邮箱')
  } finally {
    isLoading.value = false
  }
}

const handleResetWith2FA = async () => {
  if (!forgotForm.value.code || !forgotForm.value.newPassword) {
    ElMessage.warning('请填写所有必填项')
    return
  }

  if (forgotForm.value.newPassword !== forgotForm.value.confirmPassword) {
    ElMessage.error('两次输入的密码不一致')
    return
  }

  isLoading.value = true
  try {
    await authStore.resetPasswordWith2FA({
      email: email.value,
      code: forgotForm.value.code,
      newPassword: forgotForm.value.newPassword
    })
    step.value = 3
    ElMessage.success('密码已成功重置')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '重置失败，验证码可能不正确')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex font-sans items-center justify-center p-6 relative overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Decorative background elements -->
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-subtle/50 blur-[100px] rounded-full"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/50 dark:bg-indigo-900/20 blur-[100px] rounded-full"></div>

    <div class="w-full max-w-md relative z-10">
      <div class="rounded-[2.5rem] shadow-2xl shadow-accent/5 border p-8 md:p-12 transition-all duration-500" style="background-color: var(--bg-card); border-color: var(--border-base)">
        
        <div class="flex flex-col items-center text-center">
          <div class="w-16 h-16 bg-accent-subtle text-accent rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            <Mail v-if="step === 1" class="w-8 h-8" />
            <Shield v-else-if="step === 2" class="w-8 h-8" />
            <CheckCircle2 v-else class="w-8 h-8 text-emerald-500" />
          </div>

          <!-- Step 1: Input Email -->
          <div v-if="step === 1" class="w-full">
            <h1 class="text-2xl font-bold mb-2" style="color: var(--text-primary)">忘记密码了？</h1>
            <p class="text-sm mb-8 leading-relaxed" style="color: var(--text-secondary)">
              请输入你的注册邮箱。目前支持通过 <span class="text-accent font-bold">两步验证 (2FA)</span> 找回密码。
            </p>

            <div class="w-full space-y-6">
              <div class="text-left">
                <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">注册邮箱</label>
                <div class="relative">
                  <Mail class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
                  <input 
                    v-model="email"
                    type="email" 
                    placeholder="name@company.com" 
                    class="w-full pl-11 pr-4 py-3.5 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                    style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
                    @keydown.enter="handleCheckEmail"
                  />
                </div>
              </div>

              <button 
                @click="handleCheckEmail"
                :disabled="isLoading"
                class="w-full bg-accent text-white py-4 rounded-2xl font-bold shadow-lg shadow-accent/20 hover:bg-accent transition-all flex items-center justify-center gap-2"
              >
                <span v-if="!isLoading">继续</span>
                <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <ArrowRight v-if="!isLoading" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Step 2: 2FA and New Password -->
          <div v-else-if="step === 2" class="w-full">
            <h1 class="text-2xl font-bold mb-2" style="color: var(--text-primary)">身份验证</h1>
            <p class="text-sm mb-8 leading-relaxed" style="color: var(--text-secondary)">
              请输入身份验证器中的 6 位动态验证码，并设置你的新密码。
            </p>

            <div class="w-full space-y-5">
              <div class="text-left">
                <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">2FA 验证码</label>
                <div class="relative">
                  <Shield class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
                  <input 
                    v-model="forgotForm.code"
                    type="text" 
                    maxlength="6"
                    placeholder="000000" 
                    class="w-full pl-11 pr-4 py-3 border rounded-2xl text-sm tracking-[0.2em] font-bold focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                    style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
                  />
                </div>
              </div>

              <div class="text-left">
                <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">新密码</label>
                <div class="relative">
                  <Lock class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
                  <input 
                    v-model="forgotForm.newPassword"
                    :type="showPassword ? 'text' : 'password'" 
                    placeholder="至少 8 位字符" 
                    class="w-full pl-11 pr-12 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                    style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
                  />
                  <button @click="showPassword = !showPassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-accent">
                    <Eye v-if="!showPassword" class="w-4 h-4" />
                    <EyeOff v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="text-left">
                <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">确认新密码</label>
                <div class="relative">
                  <Lock class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
                  <input 
                    v-model="forgotForm.confirmPassword"
                    :type="showPassword ? 'text' : 'password'" 
                    placeholder="再次输入新密码" 
                    class="w-full pl-11 pr-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                    style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
                  />
                </div>
              </div>

              <button 
                @click="handleResetWith2FA"
                :disabled="isLoading"
                class="w-full bg-accent text-white py-4 rounded-2xl font-bold shadow-lg shadow-accent/20 hover:bg-accent transition-all flex items-center justify-center gap-2"
              >
                <span v-if="!isLoading">重置密码</span>
                <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              </button>
              
              <button 
                @click="step = 1"
                class="w-full py-2 text-xs font-bold hover:text-accent transition-colors"
                style="color: var(--text-secondary)"
              >
                返回修改邮箱
              </button>
            </div>
          </div>

          <!-- Step 3: Success State -->
          <div v-else class="w-full">
            <h1 class="text-2xl font-bold mb-2" style="color: var(--text-primary)">重置成功！</h1>
            <p class="text-sm mb-8 leading-relaxed" style="color: var(--text-secondary)">
              你的账号密码已成功更新。现在你可以使用新密码重新登录平台了。
            </p>
            <button 
              @click="router.push('/login')"
              class="w-full bg-accent text-white py-4 rounded-2xl font-bold shadow-lg shadow-accent/20 hover:bg-accent transition-all flex items-center justify-center gap-2"
            >
              前往登录
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>

          <div class="mt-8 pt-8 border-t w-full" style="border-color: var(--border-base)">
            <RouterLink to="/login" class="flex items-center justify-center gap-2 text-sm font-bold transition-colors group" style="color: var(--text-secondary)">
              <ArrowLeft class="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              返回登录页面
            </RouterLink>
          </div>
        </div>

      </div>
      
      <p class="text-center mt-8 text-xs" style="color: var(--text-secondary)">
        需要更多帮助？<a href="#" class="text-accent hover:underline">联系技术支持</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
</style>

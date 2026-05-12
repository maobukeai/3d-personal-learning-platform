<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, User, Eye, EyeOff, Chrome, Github, ArrowRight, CheckCircle2 } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useSystemStore } from '@/stores/system'

const router = useRouter()
const authStore = useAuthStore()
const systemStore = useSystemStore()
const showPassword = ref(false)
const isLoading = ref(false)

const registerForm = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  terms: false
})

const handleRegister = async () => {
  if (!registerForm.value.name || !registerForm.value.email || !registerForm.value.password) {
    ElMessage.warning('请填写所有必填字段')
    return
  }
  
  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    ElMessage.error('两次输入的密码不一致')
    return
  }

  if (!registerForm.value.terms) {
    ElMessage.warning('请阅读并同意服务条款')
    return
  }

  isLoading.value = true
  
  try {
    await authStore.register({
      name: registerForm.value.name,
      email: registerForm.value.email,
      password: registerForm.value.password
    })
    ElMessage.success('账号创建成功，请登录！')
    router.push({ path: '/login', query: { onboarding: 'true' } })
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '注册失败，请稍后重试')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex font-sans overflow-hidden" style="background-color: var(--bg-card)">
    <!-- Left Section: Aesthetic Visuals (Same as Login for consistency) -->
    <div class="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden">
      <div class="absolute top-0 left-0 w-full h-full">
        <div class="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-accent/20 blur-[120px] rounded-full"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[100px] rounded-full"></div>
      </div>
      
      <!-- Content Overlay -->
      <div class="relative z-10 p-16 flex flex-col w-full h-full">
        <div class="flex items-center gap-2 cursor-pointer" @click="router.push('/login')">
          <div class="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/30">
            <span class="text-white font-bold text-xl">3D</span>
          </div>
          <span class="text-white font-bold text-xl tracking-tight">Learn Platform</span>
        </div>

        <div class="flex-1 flex flex-col justify-center">
          <div class="max-w-md">
            <h2 class="text-4xl font-bold text-white mb-6 leading-tight">加入 <span class="text-accent">3D 创意</span> 社区</h2>
            <div class="space-y-4 mb-8">
              <div class="flex items-start gap-3">
                <CheckCircle2 class="w-5 h-5 text-emerald-500 shrink-0 mt-1" />
                <p class="text-slate-300 text-sm">访问超过 500+ 高质量 3D 建模与渲染课程</p>
              </div>
              <div class="flex items-start gap-3">
                <CheckCircle2 class="w-5 h-5 text-emerald-500 shrink-0 mt-1" />
                <p class="text-slate-300 text-sm">与全球顶尖设计师交流心得，获取实时反馈</p>
              </div>
              <div class="flex items-start gap-3">
                <CheckCircle2 class="w-5 h-5 text-emerald-500 shrink-0 mt-1" />
                <p class="text-slate-300 text-sm">免费下载海量精选 PBR 材质与 3D 资产库</p>
              </div>
            </div>

            <div class="flex items-center gap-4 p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
              <div class="flex -space-x-2">
                <img v-for="i in 4" :key="i" :src="`https://i.pravatar.cc/150?img=${i+10}`" class="w-8 h-8 rounded-full border-2 border-slate-900" />
              </div>
              <p class="text-xs text-slate-300 font-medium">已有超过 12,000+ 设计师加入我们</p>
            </div>
          </div>
        </div>

        <div class="text-slate-500 text-sm">
          &copy; 2026 3D Learn Inc. 保留所有权利。
        </div>
      </div>
    </div>

    <!-- Right Section: Register Form -->
    <div class="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-16">
      <div class="w-full max-w-md">
        <div class="mb-10 lg:hidden flex items-center gap-2">
          <div class="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <span class="text-white font-bold">3D</span>
          </div>
          <span class="font-bold" style="color: var(--text-primary)">Learn Platform</span>
        </div>

        <div class="mb-8">
          <h1 class="text-3xl font-bold mb-2" style="color: var(--text-primary)">创建新账号</h1>
          <p style="color: var(--text-secondary)">立即开始你的设计师成长之路</p>
        </div>

        <!-- Registration Closed Notice -->
        <div v-if="systemStore.settings.ALLOW_REGISTRATION === false" class="mb-8 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-rose-200">
            <Lock class="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-rose-600">注册已暂停</h3>
            <p class="text-xs text-rose-400 font-medium">抱歉，目前平台已关闭新用户注册，请联系管理员或稍后再试。</p>
          </div>
        </div>

        <div v-if="systemStore.settings.ALLOW_REGISTRATION !== false" class="space-y-5">
          <!-- Input Fields -->
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">显示名称</label>
              <div class="relative">
                <User class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
                <input 
                  v-model="registerForm.name"
                  type="text" 
                  placeholder="设计师小王" 
                  class="w-full pl-11 pr-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                  style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">电子邮箱</label>
              <div class="relative">
                <Mail class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
                <input 
                  v-model="registerForm.email"
                  type="email" 
                  placeholder="name@company.com" 
                  class="w-full pl-11 pr-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                  style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">密码</label>
                <div class="relative">
                  <Lock class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
                  <input 
                    v-model="registerForm.password"
                    :type="showPassword ? 'text' : 'password'" 
                    placeholder="请输入密码" 
                    class="w-full pl-11 pr-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                    style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
                  />
                </div>
              </div>
              <div>
                <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">确认密码</label>
                <div class="relative">
                  <Lock class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
                  <input 
                    v-model="registerForm.confirmPassword"
                    :type="showPassword ? 'text' : 'password'" 
                    placeholder="请再次输入" 
                    class="w-full pl-11 pr-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                    style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
                  />
                </div>
              </div>
            </div>
            
            <div class="flex justify-end">
              <button @click="showPassword = !showPassword" class="text-[10px] font-bold flex items-center gap-1 transition-colors" style="color: var(--text-secondary)">
                <Eye v-if="!showPassword" class="w-3 h-3" />
                <EyeOff v-else class="w-3 h-3" />
                {{ showPassword ? '隐藏密码' : '显示密码' }}
              </button>
            </div>
          </div>

          <div class="flex items-start gap-2">
            <el-checkbox v-model="registerForm.terms" class="mt-0.5" />
            <span class="text-xs leading-relaxed" style="color: var(--text-secondary)">
              我已阅读并同意平台 <a href="#" class="text-accent font-bold hover:underline">服务协议</a> 与 <a href="#" class="text-accent font-bold hover:underline">隐私政策</a>
            </span>
          </div>

          <button 
            @click="handleRegister"
            :disabled="isLoading"
            class="w-full bg-accent text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-accent/30 hover:bg-accent hover:shadow-accent/40 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            <span v-if="!isLoading">立即注册</span>
            <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            <ArrowRight v-if="!isLoading" class="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <div class="relative py-2 flex items-center">
            <div class="flex-grow border-t" style="border-color: var(--border-base)"></div>
            <span class="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-widest" style="color: var(--text-muted)">或者使用</span>
            <div class="flex-grow border-t" style="border-color: var(--border-base)"></div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <button class="flex items-center justify-center gap-2 py-2.5 border rounded-xl text-xs font-bold transition-all"
                    style="border-color: var(--border-base); background-color: var(--bg-card); color: var(--text-primary)">
              <Chrome class="w-3.5 h-3.5" /> Google
            </button>
            <button class="flex items-center justify-center gap-2 py-2.5 border rounded-xl text-xs font-bold transition-all"
                    style="border-color: var(--border-base); background-color: var(--bg-card); color: var(--text-primary)">
              <Github class="w-3.5 h-3.5" /> GitHub
            </button>
          </div>

          <p class="text-center text-sm" style="color: var(--text-secondary)">
            已有账号？ 
            <RouterLink to="/login" class="font-bold text-accent hover:text-accent transition-colors">点此登录</RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

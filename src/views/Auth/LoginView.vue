<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, Lock, Eye, EyeOff, Chrome, Github, ArrowRight, CheckCircle2 } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const showPassword = ref(false);
const isLoading = ref(false);
const is2FARequired = ref(false);
const tempUserId = ref('');
const twoFactorCode = ref('');
const rememberDevice = ref(true);

const loginForm = ref({
  email: '',
  password: '',
  remember: false,
});

const handleLogin = async () => {
  if (!loginForm.value.email || !loginForm.value.password) {
    ElMessage.warning('请输入账号和密码');
    return;
  }

  isLoading.value = true;

  try {
    const data = await authStore.login({
      email: loginForm.value.email,
      password: loginForm.value.password,
    });

    if (data.twoFactorRequired) {
      is2FARequired.value = true;
      tempUserId.value = data.userId;
      ElMessage.info('请输入两步验证码');
    } else {
      ElMessage.success('欢迎回来！');
      const redirect = router.currentRoute.value.query.redirect as string;
      if (router.currentRoute.value.query.onboarding === 'true') {
        router.push('/onboarding');
      } else if (redirect) {
        router.push(redirect);
      } else {
        router.push('/dashboard');
      }
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '登录失败，请检查账号密码');
  } finally {
    isLoading.value = false;
  }
};

const handle2FAVerify = async () => {
  if (!twoFactorCode.value) return;
  isLoading.value = true;
  try {
    await authStore.login2FA(tempUserId.value, twoFactorCode.value, rememberDevice.value);
    ElMessage.success('欢迎回来！');
    const redirect = router.currentRoute.value.query.redirect as string;
    if (redirect) {
      router.push(redirect);
    } else {
      router.push('/dashboard');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '验证码错误');
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex font-sans overflow-hidden" style="background-color: var(--bg-card)">
    <!-- Left Section: Aesthetic Visuals -->
    <div class="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden">
      <!-- Background Abstract Shapes -->
      <div class="absolute top-0 left-0 w-full h-full">
        <div
          class="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-accent/20 blur-[120px] rounded-full"
        ></div>
        <div
          class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[100px] rounded-full"
        ></div>
      </div>

      <!-- Content Overlay -->
      <div class="relative z-10 p-16 flex flex-col w-full h-full">
        <div class="flex items-center gap-2">
          <div
            class="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/30"
          >
            <span class="text-white font-bold text-xl">3D</span>
          </div>
          <span class="text-white font-bold text-xl tracking-tight">Learn Platform</span>
        </div>

        <div class="flex-1 flex flex-col justify-center">
          <div class="max-w-md">
            <h2 class="text-4xl font-bold text-white mb-6 leading-tight">
              开启你的 <span class="text-accent">3D 创意</span> 学习之旅
            </h2>
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

            <div
              class="flex items-center gap-4 p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10"
            >
              <div class="flex -space-x-2">
                <div
                  v-for="(letter, idx) in ['A', 'T', 'L', 'S']"
                  :key="idx"
                  class="w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-white shadow-md select-none"
                  :class="[
                    idx === 0 ? 'bg-gradient-to-tr from-pink-500 to-rose-400' : '',
                    idx === 1 ? 'bg-gradient-to-tr from-amber-500 to-orange-400' : '',
                    idx === 2 ? 'bg-gradient-to-tr from-emerald-500 to-teal-400' : '',
                    idx === 3 ? 'bg-gradient-to-tr from-blue-500 to-indigo-400' : '',
                  ]"
                >
                  {{ letter }}
                </div>
              </div>
              <p class="text-xs text-slate-300 font-medium">已有超过 12,000+ 设计师加入我们</p>
            </div>
          </div>
        </div>

        <div class="text-slate-500 text-sm">&copy; 2026 3D Learn Inc. 保留所有权利。</div>
      </div>

      <!-- Mock 3D Element (Visual) -->
      <div
        class="absolute right-[-10%] top-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-accent/20 to-indigo-500/20 rounded-full blur-3xl"
      ></div>
    </div>

    <!-- Right Section: Login Form -->
    <div class="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-16">
      <div class="w-full max-w-md">
        <div class="mb-10 lg:hidden flex items-center gap-2">
          <div class="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <span class="text-white font-bold">3D</span>
          </div>
          <span class="font-bold" style="color: var(--text-primary)">Learn Platform</span>
        </div>

        <div class="mb-10">
          <h1 class="text-3xl font-bold mb-2" style="color: var(--text-primary)">
            {{ is2FARequired ? '两步验证' : '欢迎回来' }}
          </h1>
          <p style="color: var(--text-secondary)">
            {{
              is2FARequired
                ? '请输入 Google Authenticator 中的 6 位验证码'
                : '请输入你的账号信息以登录平台'
            }}
          </p>
        </div>

        <div v-if="!is2FARequired" class="space-y-6">
          <!-- Social Logins -->
          <div class="grid grid-cols-2 gap-4">
            <button
              class="flex items-center justify-center gap-2 py-2.5 border rounded-xl text-sm font-bold transition-all"
              style="
                border-color: var(--border-base);
                background-color: var(--bg-card);
                color: var(--text-primary);
              "
            >
              <Chrome class="w-4 h-4" /> Google
            </button>
            <button
              class="flex items-center justify-center gap-2 py-2.5 border rounded-xl text-sm font-bold transition-all"
              style="
                border-color: var(--border-base);
                background-color: var(--bg-card);
                color: var(--text-primary);
              "
            >
              <Github class="w-4 h-4" /> GitHub
            </button>
          </div>

          <div class="relative py-4 flex items-center">
            <div class="flex-grow border-t" style="border-color: var(--border-base)"></div>
            <span
              class="flex-shrink mx-4 text-xs font-bold uppercase tracking-widest"
              style="color: var(--text-muted)"
              >或者使用邮箱</span
            >
            <div class="flex-grow border-t" style="border-color: var(--border-base)"></div>
          </div>

          <!-- Input Fields -->
          <div class="space-y-4">
            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >电子邮箱</label
              >
              <div class="relative">
                <Mail
                  class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                  style="color: var(--text-secondary)"
                />
                <input
                  v-model="loginForm.email"
                  type="email"
                  placeholder="name@company.com"
                  class="w-full pl-11 pr-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2 ml-1">
                <label
                  class="block text-xs font-bold uppercase"
                  style="color: var(--text-secondary)"
                  >密码</label
                >
                <RouterLink
                  to="/forgot-password"
                  class="text-xs font-bold text-accent hover:text-accent transition-colors"
                  >忘记密码？</RouterLink
                >
              </div>
              <div class="relative">
                <Lock
                  class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                  style="color: var(--text-secondary)"
                />
                <input
                  v-model="loginForm.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="请输入你的密码"
                  class="w-full pl-11 pr-12 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                  @keydown.enter="handleLogin"
                />
                <button
                  class="absolute right-4 top-1/2 -translate-y-1/2 hover:text-accent transition-colors"
                  style="color: var(--text-secondary)"
                  @click="showPassword = !showPassword"
                >
                  <Eye v-if="!showPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div class="flex items-center">
            <el-checkbox v-model="loginForm.remember" label="记住我的登录状态" />
          </div>

          <button
            :disabled="isLoading"
            class="w-full bg-accent text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-accent/30 hover:bg-accent hover:shadow-accent/40 transition-all flex items-center justify-center gap-2 group"
            @click="handleLogin"
          >
            <span v-if="!isLoading">进入平台</span>
            <span
              v-else
              class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></span>
            <ArrowRight
              v-if="!isLoading"
              class="w-4 h-4 group-hover:translate-x-1 transition-transform"
            />
          </button>

          <p class="text-center text-sm" style="color: var(--text-secondary)">
            还没有账号？
            <RouterLink
              to="/register"
              class="font-bold text-accent hover:text-accent transition-colors"
              >立即免费注册</RouterLink
            >
          </p>
        </div>

        <!-- 2FA Input State -->
        <div v-else class="space-y-6">
          <div class="flex justify-center mb-8">
            <div class="w-20 h-20 bg-accent-subtle rounded-full flex items-center justify-center">
              <Lock class="w-10 h-10 text-accent" />
            </div>
          </div>

          <div>
            <label
              class="block text-xs font-bold uppercase mb-2 ml-1 text-center"
              style="color: var(--text-secondary)"
              >动态验证码</label
            >
            <input
              v-model="twoFactorCode"
              type="text"
              maxlength="6"
              placeholder="000000"
              class="w-full text-center text-2xl tracking-[0.5em] font-bold py-4 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              @keydown.enter="handle2FAVerify"
            />
          </div>

          <div class="flex items-center justify-center">
            <el-checkbox v-model="rememberDevice" label="记住此浏览器 (下次登录免验证)" />
          </div>

          <button
            :disabled="isLoading || twoFactorCode.length < 6"
            class="w-full bg-accent text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-accent/30 hover:bg-accent transition-all flex items-center justify-center gap-2"
            @click="handle2FAVerify"
          >
            <span v-if="!isLoading">确认验证</span>
            <span
              v-else
              class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></span>
          </button>

          <button
            class="w-full text-sm font-bold hover:text-accent transition-colors"
            style="color: var(--text-secondary)"
            @click="is2FARequired = false"
          >
            返回登录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Optional: background animation could go here */
</style>

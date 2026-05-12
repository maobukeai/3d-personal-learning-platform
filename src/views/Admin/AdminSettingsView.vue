<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { 
  Settings, 
  Mail, 
  Shield, 
  Save, 
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Layout,
  UserPlus,
  Lock,
  Globe
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const isLoading = ref(false)
const isSaving = ref(false)
const isTestingSmtp = ref(false)
const showPassword = ref(false)

const settings = ref({
  SMTP_HOST: '',
  SMTP_PORT: '465',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: '',
  SMTP_SECURE: 'true',
  EMAIL_VERIFY_SUBJECT: '您的邮箱验证码',
  EMAIL_VERIFY_BODY: '您好，您的验证码是：{{code}}。请在 10 分钟内输入。',
  PLATFORM_NAME: '3D Personal Learning Hub',
  ALLOW_REGISTRATION: 'true',
  MAINTENANCE_MODE: 'false'
})

const fetchSettings = async () => {
  try {
    isLoading.value = true
    const { data } = await api.get('/api/admin/settings')
    
    data.forEach((s: any) => {
      if (Object.keys(settings.value).includes(s.key)) {
        (settings.value as any)[s.key] = s.value
      }
    })
  } catch (error) {
    console.error('Fetch settings error:', error)
    ElMessage.error('获取设置失败')
  } finally {
    isLoading.value = false
  }
}

const saveSettings = async () => {
  try {
    isSaving.value = true
    const settingsPayload = Object.entries(settings.value).map(([key, value]) => ({
      key, value
    }))

    await api.post('/api/admin/settings', { settings: settingsPayload })
    ElMessage.success('系统设置已成功保存')
  } catch (error) {
    console.error('Save settings error:', error)
    ElMessage.error('保存设置失败')
  } finally {
    isSaving.value = false
  }
}

const testSmtp = async () => {
  try {
    isTestingSmtp.value = true
    const { data } = await api.post('/api/admin/settings/test-smtp', {
      host: settings.value.SMTP_HOST,
      port: settings.value.SMTP_PORT,
      user: settings.value.SMTP_USER,
      pass: settings.value.SMTP_PASS,
      from: settings.value.SMTP_FROM,
      secure: settings.value.SMTP_SECURE === 'true'
    })
    ElMessage.success(data.message)
  } catch (error: any) {
    console.error('Test SMTP error:', error)
    ElMessage.error(error.response?.data?.error || 'SMTP 测试失败')
  } finally {
    isTestingSmtp.value = false
  }
}

onMounted(fetchSettings)
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-4">
        <div class="p-2.5 bg-slate-100 dark:bg-white/5 rounded-xl">
          <Settings class="w-6 h-6 text-slate-600" />
        </div>
        <div>
          <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">全局系统设置</h1>
          <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">配置平台核心参数、自动化邮件及安全开关</p>
        </div>
      </div>
      <button @click="saveSettings" 
              :disabled="isSaving"
              class="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl font-bold text-sm shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100">
        <Save class="w-4 h-4" v-if="!isSaving" />
        <RefreshCw class="w-4 h-4 animate-spin" v-else />
        <span>{{ isSaving ? '正在保存...' : '保存全局设置' }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-4xl mx-auto space-y-8 pb-12">
        
        <!-- General Settings Section -->
        <section class="p-8 rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <div class="flex items-center gap-3 mb-8">
            <Globe class="w-5 h-5 text-indigo-600" />
            <h2 class="text-lg font-bold" style="color: var(--text-primary)">基础运营配置</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="space-y-2">
              <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">平台显示名称</label>
              <input v-model="settings.PLATFORM_NAME" 
                     type="text" 
                     class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all" 
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
            </div>

            <div class="flex flex-col justify-center space-y-4">
              <div class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all">
                <div class="flex items-center gap-3">
                  <UserPlus class="w-4 h-4 text-emerald-500" />
                  <span class="text-xs font-bold" style="color: var(--text-primary)">允许新用户注册</span>
                </div>
                <el-switch v-model="settings.ALLOW_REGISTRATION" active-value="true" inactive-value="false" active-color="#10b981" />
              </div>
              
              <div class="flex items-center justify-between p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-all">
                <div class="flex items-center gap-3">
                  <Lock class="w-4 h-4 text-rose-500" />
                  <span class="text-xs font-bold" style="color: var(--text-primary)">维护模式 (仅管理员可登入)</span>
                </div>
                <el-switch v-model="settings.MAINTENANCE_MODE" active-value="true" inactive-value="false" active-color="#f43f5e" />
              </div>
            </div>
          </div>
        </section>

        <!-- SMTP Settings Section -->
        <section class="p-8 rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-3">
              <Mail class="w-5 h-5 text-accent" />
              <h2 class="text-lg font-bold" style="color: var(--text-primary)">SMTP 邮件服务配置</h2>
            </div>
            <button @click="testSmtp" 
                    :disabled="isTestingSmtp"
                    class="text-xs font-bold text-accent px-4 py-2 rounded-lg border border-accent/20 hover:bg-accent/5 transition-colors disabled:opacity-50">
              {{ isTestingSmtp ? '正在尝试握手...' : '测试连接' }}
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">服务器地址</label>
              <input v-model="settings.SMTP_HOST" type="text" placeholder="smtp.gmail.com"
                     class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all" 
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">端口</label>
              <input v-model="settings.SMTP_PORT" type="text" placeholder="465"
                     class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all" 
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">账号 (USER)</label>
              <input v-model="settings.SMTP_USER" type="text" 
                     class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all" 
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">授权码 (PASS)</label>
              <div class="relative">
                <input v-model="settings.SMTP_PASS" :type="showPassword ? 'text' : 'password'" 
                       class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all" 
                       style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
                <button @click="showPassword = !showPassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Eye v-if="!showPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>
            </div>
            <div class="flex items-center gap-3 pt-4">
              <el-switch v-model="settings.SMTP_SECURE" active-value="true" inactive-value="false" active-color="#6366f1" />
              <span class="text-xs font-bold" style="color: var(--text-primary)">启用 SSL/TLS 连接</span>
            </div>
          </div>
        </section>

        <!-- Email Template Section -->
        <section class="p-8 rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <div class="flex items-center gap-3 mb-8">
            <Layout class="w-5 h-5 text-indigo-600" />
            <h2 class="text-lg font-bold" style="color: var(--text-primary)">验证邮件模版</h2>
          </div>

          <div class="space-y-6">
            <div class="space-y-2">
              <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">邮件主题 (Subject)</label>
              <input v-model="settings.EMAIL_VERIFY_SUBJECT" type="text"
                     class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all" 
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold px-1 flex justify-between items-center" style="color: var(--text-secondary)">
                <span>正文内容 (支持 HTML)</span>
                <span v-pre class="text-[10px] opacity-60">可用占位符: {{code}}</span>
              </label>
              <textarea v-model="settings.EMAIL_VERIFY_BODY" rows="5"
                     class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all resize-none" 
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"></textarea>
            </div>
          </div>
        </section>

      </div>
    </div>
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
</style>

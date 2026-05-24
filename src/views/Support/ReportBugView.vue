<script setup lang="ts">

import { getApiErrorMessage } from '@/utils/error';

import { ref, onMounted, watch } from 'vue';

import { useRoute, useRouter } from 'vue-router';

import {

  AlertCircle,

  Send,

  Image as ImageIcon,

  ChevronRight,

  Info,

  CheckCircle2,

  Bug,

  History,

  Clock,

  ExternalLink,

  MessageSquare,

  X,

} from 'lucide-vue-next';

import { ElMessage } from 'element-plus';



import api from '@/utils/api';



const route = useRoute();

const router = useRouter();



const fileInput = ref<HTMLInputElement | null>(null);

const isUploading = ref(false);

const previewUrl = ref('');

const activeTab = ref('submit'); // 'submit' or 'history'

const myFeedbacks = ref<any[]>([]);

const isLoadingHistory = ref(false);



const bugForm = ref({

  type: 'Bug',

  title: '',

  description: '',

  priority: 'MEDIUM',

  attachmentUrl: '',

});



const priorityOptions = [

  { value: 'LOW', label: '低' },

  { value: 'MEDIUM', label: '中' },

  { value: 'HIGH', label: '高' },

];



const getPriorityLabel = (priority: string) => {

  return priorityOptions.find((o) => o.value === priority)?.label || priority;

};



const isSubmitting = ref(false);

const isSubmitted = ref(false);



const fetchMyFeedbacks = async () => {

  isLoadingHistory.value = true;

  try {

    const response = await api.get('/api/feedback/my');

    myFeedbacks.value = response.data;

  } catch {

    ElMessage.error('无法获取反馈历史');

  } finally {

    isLoadingHistory.value = false;

  }

};



const getStatusType = (status: string) => {

  switch (status) {

    case 'OPEN':

      return 'danger';

    case 'IN_PROGRESS':

      return 'warning';

    case 'RESOLVED':

      return 'success';

    case 'CLOSED':

      return 'info';

    default:

      return undefined;

  }

};



const getStatusLabel = (status: string) => {

  switch (status) {

    case 'OPEN':

      return '待处理';

    case 'IN_PROGRESS':

      return '处理中';

    case 'RESOLVED':

      return '已解决';

    case 'CLOSED':

      return '已关闭';

    default:

      return status;

  }

};



const formatDate = (dateString: string) => {

  return new Date(dateString).toLocaleDateString('zh-CN', {

    year: 'numeric',

    month: 'long',

    day: 'numeric',

    hour: '2-digit',

    minute: '2-digit',

  });

};



const triggerFileInput = () => {

  fileInput.value?.click();

};



const handleFileUpload = async (event: Event) => {

  const target = event.target as HTMLInputElement;

  if (!target.files?.length) return;



  const file = target.files[0];

  if (file.size > 5 * 1024 * 1024) {

    ElMessage.error('图片大小不能超过 5MB');

    return;

  }



  isUploading.value = true;

  const formData = new FormData();

  formData.append('file', file);



  try {

    const response = await api.post('/api/feedback/upload', formData, {

      headers: { 'Content-Type': 'multipart/form-data' },

    });

    bugForm.value.attachmentUrl = response.data.url;

    previewUrl.value = response.data.url;

    ElMessage.success('图片上传成功');

  } catch {

    ElMessage.error('图片上传失败');

  } finally {

    isUploading.value = false;

  }

};



const removeAttachment = () => {

  bugForm.value.attachmentUrl = '';

  previewUrl.value = '';

};



const handleSubmit = async () => {

  if (!bugForm.value.title || !bugForm.value.description) {

    ElMessage.warning('请填写完整的标题和描述信息');

    return;

  }



  isSubmitting.value = true;



  try {

    await api.post('/api/feedback', bugForm.value);

    isSubmitting.value = false;

    isSubmitted.value = true;

    ElMessage.success('报告已提交，感谢你的反馈');

    // Refresh history if already loaded

    fetchMyFeedbacks();

  } catch (error) {

    ElMessage.error(getApiErrorMessage(error, '提交失败，请重试'));

    isSubmitting.value = false;

  }

};



watch(

  () => route.query.tab,

  (newTab) => {

    if (newTab === 'history') {

      activeTab.value = 'history';

    } else {

      activeTab.value = 'submit';

    }

  },

  { immediate: true },

);



onMounted(() => {

  fetchMyFeedbacks();

});

</script>



<template>

  <div

    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"

    style="background-color: var(--bg-app)"

  >

    <!-- Header -->

    <div

      class="h-16 border-b px-4 sm:px-8 flex items-center justify-between shrink-0 transition-colors duration-300"

      style="background-color: var(--bg-card); border-color: var(--border-base)"

    >

      <div class="flex items-center gap-3">

        <div class="p-2 bg-rose-50 rounded-lg">

          <Bug class="w-5 h-5 text-rose-600" />

        </div>

        <h1 class="text-xl font-bold" style="color: var(--text-primary)">报告问题与反馈</h1>

      </div>

    </div>



    <!-- Tabs -->

    <div class="px-4 sm:px-8 mt-4">

      <div

        class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-700"

      >

        <button
type="button" class="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all" :class="

            activeTab === 'submit'

              ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm'

              : 'text-slate-500 hover:text-slate-700'

          " @click="

            activeTab = 'submit';

            router.replace({ query: { ...route.query, tab: 'submit' } });

          ">

          <Bug class="w-3.5 h-3.5" />

          提交反馈

        </button>

        <button
type="button" class="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all" :class="

            activeTab === 'history'

              ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm'

              : 'text-slate-500 hover:text-slate-700'

          " @click="

            activeTab = 'history';

            router.replace({ query: { ...route.query, tab: 'history' } });

          ">

          <History class="w-3.5 h-3.5" />

          反馈历史

        </button>

      </div>

    </div>



    <!-- Content Area -->

    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">

      <div class="max-w-3xl mx-auto">

        <!-- Submit Tab -->

        <template v-if="activeTab === 'submit'">

          <div

            v-if="!isSubmitted"

            class="rounded-3xl border shadow-sm overflow-hidden transition-all"

            style="background-color: var(--bg-card); border-color: var(--border-base)"

          >

            <div class="p-6 sm:p-8 border-b bg-slate-50/30" style="border-color: var(--border-base)">

              <h2 class="text-lg font-bold mb-2" style="color: var(--text-primary)">

                遇到麻烦了吗？

              </h2>

              <p class="text-sm text-slate-500">

                描述你遇到的问题或改进建议，我们的技术团队会尽快处理。

              </p>

            </div>



            <div class="p-6 sm:p-8 space-y-6">

              <!-- Form Group -->

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">

                <div>

                  <label class="block text-xs font-bold text-slate-400 uppercase mb-2"

                    >反馈类型</label

                  >

                  <el-select v-model="bugForm.type" class="w-full" size="large">

                    <el-option label="程序 Bug (功能异常)" value="Bug" />

                    <el-option label="功能建议 (新想法)" value="Feature" />

                    <el-option label="界面优化 (视觉/操作)" value="UI" />

                    <el-option label="其他反馈" value="Other" />

                  </el-select>

                </div>

                <div>

                  <label class="block text-xs font-bold text-slate-400 uppercase mb-2"

                    >紧急程度</label

                  >

                  <div class="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100">

                    <button
v-for="p in priorityOptions" :key="p.value" type="button" class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all" :style="

                        bugForm.priority === p.value

                          ? 'background-color: var(--bg-card); color: var(--text-primary); box-shadow: var(--shadow-sm)'

                          : 'color: var(--text-secondary)'

                      " @click="bugForm.priority = p.value">

                      {{ p.label }}

                    </button>

                  </div>

                </div>

              </div>



              <div>

                <label class="block text-xs font-bold text-slate-400 uppercase mb-2"

                  >问题摘要</label

                >

                <el-input

                  v-model="bugForm.title"

                  placeholder="请用一句话简述你遇到的问题..."

                  size="large"

                />

              </div>



              <div>

                <label class="block text-xs font-bold text-slate-400 uppercase mb-2"

                  >详细描述</label

                >

                <el-input

                  v-model="bugForm.description"

                  type="textarea"

                  :rows="6"

                  placeholder="请详细描述问题发生的步骤、预期结果以及实际结果。如果可以，请附带你的系统环境信息。"

                />

              </div>



              <!-- Upload Area -->

              <div>

                <label class="block text-xs font-bold text-slate-400 uppercase mb-2"

                  >附件/截图 (可选)</label

                >



                <input

                  ref="fileInput"

                  type="file"

                  class="hidden"

                  accept="image/*"

                  @change="handleFileUpload"

                />



                <div

                  v-if="!previewUrl"

                  class="border-2 border-dashed border-slate-100 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-slate-400 hover:border-accent/20 hover:bg-accent-subtle/30 transition-all cursor-pointer group"

                  @click="triggerFileInput"

                >

                  <template v-if="!isUploading">

                    <ImageIcon

                      class="w-8 h-8 mb-2 opacity-40 group-hover:text-accent transition-colors"

                    />

                    <p class="text-xs font-bold">点击或拖拽图片到此处上传</p>

                    <p class="text-[10px] mt-1">支持 PNG, JPG, GIF (最大 5MB)</p>

                  </template>

                  <template v-else>

                    <div

                      class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mb-2"

                    ></div>

                    <p class="text-xs font-bold text-accent">正在上传...</p>

                  </template>

                </div>



                <!-- Image Preview -->

                <div

                  v-else

                  class="relative w-full max-sm rounded-2xl overflow-hidden border border-slate-200 shadow-sm group"

                >

                  <img alt="" :src="previewUrl" class="w-full h-auto object-cover" />

                  <div

                    class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"

                  >

                    <button type="button" class="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-all transform hover:scale-110" @click="removeAttachment">

                      <X class="w-5 h-5" />

                    </button>

                  </div>

                </div>

              </div>



              <div class="h-px bg-slate-50 my-2"></div>



              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                <div class="flex items-center gap-2 text-xs text-slate-400">

                  <Info class="w-3.5 h-3.5" />

                  我们将在 1-3 个工作日内通过邮件回复你。

                </div>

                <button type="button" :disabled="isSubmitting" class="w-full sm:w-auto bg-accent text-white px-8 py-3 rounded-2xl font-bold text-sm hover:bg-accent transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" @click="handleSubmit">

                  <Send v-if="!isSubmitting" class="w-4 h-4" />

                  <span

                    v-else

                    class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"

                  ></span>

                  {{ isSubmitting ? '提交中...' : '提交反馈报告' }}

                </button>

              </div>

            </div>

          </div>



          <!-- Success State -->

          <div

            v-else

            class="rounded-3xl border p-12 text-center animate-in fade-in zoom-in duration-500"

            style="background-color: var(--bg-card); border-color: var(--border-base)"

          >

            <div

              class="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"

            >

              <CheckCircle2 class="w-10 h-10" />

            </div>

            <h2 class="text-2xl font-bold mb-2" style="color: var(--text-primary)">

              报告提交成功！

            </h2>

            <p class="text-slate-500 mb-8 max-w-sm mx-auto">

              感谢你为完善平台做出的贡献。你可以继续浏览其他页面，或者在反馈历史中查看处理进度。

            </p>

            <div class="flex items-center justify-center gap-4">

              <button type="button" class="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all" @click="isSubmitted = false">

                再次提交

              </button>

              <RouterLink

                to="/dashboard"

                class="px-6 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"

              >

                返回仪表盘

              </RouterLink>

            </div>

          </div>

        </template>



        <!-- History Tab -->

        <template v-else>

          <div class="space-y-4">

            <div

              v-if="isLoadingHistory"

              class="flex flex-col items-center justify-center py-20 text-slate-400"

            >

              <div

                class="w-8 h-8 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin mb-4"

              ></div>

              <p class="text-sm font-medium">正在获取反馈历史...</p>

            </div>



            <template v-else>

              <div

                v-for="item in myFeedbacks"

                :key="item.id"

                class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 hover:shadow-lg transition-all"

              >

                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">

                  <div class="flex items-center gap-2">

                    <span

                      class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider shrink-0"

                    >

                      {{ item.type }}

                    </span>

                    <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">

                      {{ item.title }}

                    </h3>

                  </div>

                  <el-tag

                    :type="getStatusType(item.status)"

                    size="small"

                    effect="light"

                    class="font-bold w-fit"

                  >

                    {{ getStatusLabel(item.status) }}

                  </el-tag>

                </div>



                <p

                  class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2"

                >

                  {{ item.description }}

                </p>



                <!-- Admin Reply Display -->

                <div

                  v-if="item.adminReply"

                  class="mb-4 p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/20"

                >

                  <div class="flex items-center justify-between mb-2">

                    <div class="flex items-center gap-2">

                      <div class="p-1 bg-rose-100 dark:bg-rose-900/40 rounded-md">

                        <MessageSquare class="w-3 h-3 text-rose-600" />

                      </div>

                      <span class="text-[10px] font-black uppercase text-rose-600 tracking-wider"

                        >官方回复</span

                      >

                    </div>

                    <span v-if="item.repliedAt" class="text-[9px] text-slate-400 font-bold">

                      {{ formatDate(item.repliedAt) }}

                    </span>

                  </div>

                  <p class="text-xs text-slate-600 dark:text-slate-300 italic">

                    {{ item.adminReply }}

                  </p>

                </div>



                <div v-if="item.attachmentUrl" class="mb-4">

                  <a

                    :href="item.attachmentUrl"

                    target="_blank"

                    rel="noopener noreferrer"

                    class="flex items-center gap-2 text-[10px] font-bold text-rose-600 hover:text-rose-700 w-fit"

                  >

                    <ImageIcon class="w-3 h-3" /> 查看附件 <ExternalLink class="w-3 h-3" />

                  </a>

                </div>



                <div

                  class="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-400 border-t border-slate-50 dark:border-slate-800 pt-3"

                >

                  <div class="flex items-center gap-1">

                    <Clock class="w-3 h-3" />

                    {{ formatDate(item.createdAt) }}

                  </div>

                  <div class="flex items-center gap-1">

                    <AlertCircle class="w-3 h-3" />

                    优先级: {{ getPriorityLabel(item.priority) }}

                  </div>

                </div>

              </div>



              <div

                v-if="myFeedbacks.length === 0"

                class="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700"

              >

                <History class="w-12 h-12 opacity-10 mb-4" />

                <p class="text-sm font-medium">还没有任何反馈记录</p>

                <button type="button" class="mt-4 text-xs font-bold text-rose-600 hover:underline" @click="activeTab = 'submit'">

                  去提交第一个反馈

                </button>

              </div>

            </template>

          </div>

        </template>



        <!-- FAQ/Info Side -->

        <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">

          <div class="bg-accent-subtle/50 p-6 rounded-2xl border border-accent-subtle/50">

            <h3 class="text-sm font-bold text-blue-800 mb-3">常见问题解答</h3>

            <ul class="space-y-3">

              <li

                v-for="i in 3"

                :key="i"

                class="flex items-start gap-2 text-xs text-accent/70 hover:text-accent cursor-pointer group"

              >

                <ChevronRight

                  class="w-3.5 h-3.5 shrink-0 group-hover:translate-x-1 transition-transform"

                />

                <span>如何导出支持 Web 端的 GLB 文件？</span>

              </li>

            </ul>

          </div>

          <div class="bg-slate-800 p-6 rounded-2xl text-white">

            <h3 class="text-sm font-bold mb-3">联系技术支持</h3>

            <p class="text-xs text-slate-400 leading-relaxed mb-4">

              如果你遇到了紧急的账号安全问题，请直接拨打我们的 24/7

              技术支持热线或通过即时聊天联系我们。

            </p>

            <button type="button" class="text-xs font-bold text-accent hover:text-accent/30 transition-colors flex items-center gap-1">

              开启在线聊天 <ChevronRight class="w-3 h-3" />

            </button>

          </div>

        </div>

      </div>

    </div>

  </div>

</template>



<style scoped>

.scrollbar-hide::-webkit-scrollbar {

  display: none;

}

</style>


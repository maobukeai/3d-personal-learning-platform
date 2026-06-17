<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/ui/Modal.vue';
import { ElMessage } from 'element-plus';
import {
  Calendar,
  Check,
  CheckCircle,
  Copy,
  Edit,
  Info,
  Key,
  Sparkles,
  Trash2,
  ArrowLeft,
  FileText,
} from 'lucide-vue-next';
import { createJsonHeaders, parseSSEStream } from '@/utils/aiHelpers';

interface GoogleAccount {
  id: string;
  email: string;
  password?: string;
  recoveryEmail?: string;
  twoFASecret?: string;
  country?: string;
  note?: string;
  backupCodes?: string;
  category?: string;
  status: 'warming' | 'completed' | 'paused';
  currentDay: number;
  lastWarmedAt?: string;
  createdAt: string;
}

const props = defineProps<{
  selectedAccount: GoogleAccount | null;
  isWarmedToday: boolean;
  currentTotpCode: string;
  totpTimeLeft: number;
  testMode: boolean;
}>();

const emit = defineEmits<{
  (e: 'back-to-list'): void;
  (e: 'warm-step'): void;
  (e: 'edit', account: GoogleAccount): void;
  (e: 'delete', account: GoogleAccount): void;
  (e: 'update-country', country: string): void;
}>();

const { t } = useI18n();

// Checklist states for current day
const dayChecklist = ref<{ [key: string]: boolean }>({
  action1: false,
  action2: false,
  action3: false,
  action4: false,
  action5: false,
  action6: false,
});

const tempCountry = ref('');
const isAppealAssistantVisible = ref(false);
const appealTargetCountry = ref('');
const appealLanguage = ref('en');
const appealReasons = ref({
  liveHere: false,
  movedHere: false,
  nearBorder: false,
  differentRegions: false,
  frequentTravel: false,
  paymentMethod: false,
  familyReside: false,
  relocating: false,
});
const isGeneratingAppeal = ref(false);
const generatedAppealText = ref('');
let appealAbortCtrl: AbortController | null = null;

// Reset dynamic checklist and state on account change
watch(
  () => props.selectedAccount?.id,
  () => {
    dayChecklist.value = {
      action1: false,
      action2: false,
      action3: false,
      action4: false,
      action5: false,
      action6: false,
    };
    tempCountry.value = props.selectedAccount?.country || '';
    appealTargetCountry.value = '';
    appealLanguage.value = 'en';
    generatedAppealText.value = '';
    appealReasons.value = {
      liveHere: false,
      movedHere: false,
      nearBorder: false,
      differentRegions: false,
      frequentTravel: false,
      paymentMethod: false,
      familyReside: false,
      relocating: false,
    };
  },
  { immediate: true },
);

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'paused':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    default:
      return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed':
      return t('tools.googleWarming.statusCompleted');
    case 'paused':
      return t('tools.googleWarming.statusPaused');
    default:
      return t('tools.googleWarming.statusWarming');
  }
};

const getStepDetails = (dayNum: number) => {
  switch (dayNum) {
    case 1:
      return {
        title: t('tools.googleWarming.questDays.day1'),
        desc: t('tools.googleWarming.questDays.day1Desc'),
        actions: [
          { key: 'action1', text: '在新设备或独立指纹浏览器中完成首次安全登录' },
          { key: 'action2', text: '进入 Gmail 收件箱，浏览点击 2-3 封未读邮件' },
        ],
      };
    case 2:
      return {
        title: t('tools.googleWarming.questDays.day2'),
        desc: t('tools.googleWarming.questDays.day2Desc'),
        actions: [
          { key: 'action1', text: '进入谷歌安全中心，查看并登出所有不认识的陌生设备' },
          { key: 'action2', text: '打开 Gmail 浏览收件箱垃圾邮件和收信' },
          { key: 'action3', text: '打开 YouTube 浏览或随机播放视频 10-15 分钟' },
          { key: 'action4', text: '使用当前谷歌账号一键注册并登录 Spotify 音乐平台' },
        ],
      };
    case 3:
      return {
        title: t('tools.googleWarming.questDays.day3'),
        desc: t('tools.googleWarming.questDays.day3Desc'),
        actions: [
          { key: 'action1', text: '设置并绑定辅助邮箱（恢复邮箱）以增强信誉' },
          { key: 'action2', text: '正常收发几封 Gmail 邮件' },
          { key: 'action3', text: '在 YouTube 观看视频并随机点击喜欢或订阅' },
          { key: 'action4', text: '打开 Gemini AI，随便发送 2-3 句话进行 AI 对话互动' },
          { key: 'action5', text: '使用当前谷歌账号一键注册并登录 Twitter (X) 社交平台' },
        ],
      };
    case 4:
      return {
        title: t('tools.googleWarming.questDays.day4'),
        desc: t('tools.googleWarming.questDays.day4Desc'),
        actions: [
          { key: 'action1', text: '管理两步验证 (2FA) 或其他安全辅助设置' },
          { key: 'action2', text: '阅读 Gmail 邮件，清理垃圾邮件分类' },
          { key: 'action3', text: '打开 YouTube 观看视频，搜索感兴趣的内容' },
          { key: 'action4', text: '用 Gemini AI 随机生成一段关于学习路线的文本' },
          { key: 'action5', text: '使用当前谷歌账号一键注册并登录 TikTok 视频平台' },
        ],
      };
    case 5:
      return {
        title: t('tools.googleWarming.questDays.day5'),
        desc: t('tools.googleWarming.questDays.day5Desc'),
        actions: [
          { key: 'action1', text: '绑定密保手机号（建议长期养号使用以防异常风控）' },
          { key: 'action2', text: '正常浏览接收邮件，向外部发一封邮件' },
          { key: 'action3', text: '观看 YouTube 视频，建立正常的视频推流推荐' },
          { key: 'action4', text: '向 Gemini AI 提问一些日常开发或 3D 建模命令' },
          { key: 'action5', text: '使用当前谷歌账号一键注册并登录 Notion 知识库笔记平台' },
        ],
      };
    case 6:
      return {
        title: t('tools.googleWarming.questDays.day6'),
        desc: t('tools.googleWarming.questDays.day6Desc'),
        actions: [
          { key: 'action1', text: '进入 Gmail 正常浏览邮件，收发几封日常邮件' },
          { key: 'action2', text: '打开 YouTube 浏览或随机点赞/评论几个视频' },
          { key: 'action3', text: '在 Google 搜索引擎中进行少量网页搜索与浏览' },
          { key: 'action4', text: '使用当前谷歌账号一键注册并登录 Canva 设计工具平台' },
        ],
      };
    case 7:
      return {
        title: t('tools.googleWarming.questDays.day7'),
        desc: t('tools.googleWarming.questDays.day7Desc'),
        actions: [
          { key: 'action1', text: '安全更改谷歌账户的登录密码' },
          { key: 'action2', text: '浏览收发 Gmail，整理垃圾邮件' },
          { key: 'action3', text: 'YouTube 观看并对优质内容进行评论/互动' },
          { key: 'action4', text: '使用 Gemini AI 翻译一小段英文文章' },
          { key: 'action5', text: '使用当前谷歌账号一键注册并登录 Figma 界面设计平台' },
          {
            key: 'action6',
            text: '检查谷歌账号的真实国家/地区，并在系统中更新/修改该账号的“国家/地区”属性',
          },
        ],
      };
    case 8:
      return {
        title: t('tools.googleWarming.questDays.day8'),
        desc: t('tools.googleWarming.questDays.day8Desc'),
        actions: [
          { key: 'action1', text: '进入 Gmail，阅读最新收件，回复 1 封常规邮件' },
          { key: 'action2', text: '打开 YouTube 累计观看至少 10-15 分钟视频' },
          { key: 'action3', text: '访问 Gemini AI 体验聊天互动' },
          { key: 'action4', text: '使用当前谷歌账号一键注册并登录 Miro 协作白板平台' },
        ],
      };
    case 9:
      return {
        title: t('tools.googleWarming.questDays.day9'),
        desc: t('tools.googleWarming.questDays.day9Desc'),
        actions: [
          { key: 'action1', text: '进入 Gmail 处理信件，清扫不需要的推广邮件' },
          { key: 'action2', text: '打开 YouTube 观看视频点赞并订阅博主' },
          { key: 'action3', text: '访问 Gemini AI 进行一些技术问题问答交流' },
          { key: 'action4', text: '使用当前谷歌账号在 Miro 中创建一个新的画板并绘制基础草图' },
        ],
      };
    case 10:
      return {
        title: t('tools.googleWarming.questDays.day10'),
        desc: t('tools.googleWarming.questDays.day10Desc'),
        actions: [
          { key: 'action1', text: '进入 Gmail，阅读最新收件，回复 1 封常规邮件' },
          { key: 'action2', text: '打开 YouTube 累计观看至少 10-15 分钟视频' },
          { key: 'action3', text: '访问 Gemini AI 体验聊天互动' },
          { key: 'action4', text: '使用当前谷歌账号一键注册并登录 Slack 团队协同平台' },
        ],
      };
    case 11:
      return {
        title: t('tools.googleWarming.questDays.day11'),
        desc: t('tools.googleWarming.questDays.day11Desc'),
        actions: [
          { key: 'action1', text: '进入 Gmail 处理信件，与陌生邮箱做一次日常通信' },
          { key: 'action2', text: '打开 YouTube 累计观看至少 10-15 分钟视频' },
          { key: 'action3', text: '访问 Gemini AI 体验聊天互动' },
          { key: 'action4', text: '使用当前谷歌账号一键注册并登录 ChatGPT 开启 AI 问答对话' },
        ],
      };
    case 12:
      return {
        title: t('tools.googleWarming.questDays.day12'),
        desc: t('tools.googleWarming.questDays.day12Desc'),
        actions: [
          { key: 'action1', text: '进入 Gmail，阅读最新收件，回复 1 封常规邮件' },
          { key: 'action2', text: '打开 YouTube 累计观看至少 10-15 分钟视频' },
          { key: 'action3', text: '访问 Gemini AI 体验聊天互动' },
          { key: 'action4', text: '使用当前谷歌账号一键注册并登录 GitHub 开发者托管平台' },
        ],
      };
    case 13:
      return {
        title: t('tools.googleWarming.questDays.day13'),
        desc: t('tools.googleWarming.questDays.day13Desc'),
        actions: [
          { key: 'action1', text: '进入 Gmail 邮件处理，给自己的备用邮箱发送一封日常日志' },
          { key: 'action2', text: '打开 YouTube 累计观看至少 10-15 分钟视频' },
          { key: 'action3', text: '访问 Gemini AI 体验聊天互动' },
          { key: 'action4', text: '使用当前谷歌账号一键注册并登录 Replit 云端代码开发平台' },
        ],
      };
    case 14:
    default:
      return {
        title: t('tools.googleWarming.questDays.day14'),
        desc: t('tools.googleWarming.questDays.day14Desc'),
        actions: [
          { key: 'action1', text: '进入 Gmail，阅读最新收件，回复 1 封常规邮件' },
          { key: 'action2', text: '打开 YouTube 累计观看至少 10-15 分钟视频' },
          { key: 'action3', text: '访问 Gemini AI 体验聊天互动' },
          { key: 'action4', text: '使用当前谷歌账号一键注册并登录 Reddit 社区交流论坛' },
        ],
      };
  }
};

const isAllActionsChecked = computed(() => {
  if (!props.selectedAccount) return false;
  const step = getStepDetails(props.selectedAccount.currentDay);
  return step.actions.every((act) => dayChecklist.value[act.key]);
});

const saveCountryInline = () => {
  emit('update-country', tempCountry.value.trim());
};

const generateAppealText = async () => {
  if (isGeneratingAppeal.value) {
    if (appealAbortCtrl) appealAbortCtrl.abort();
  }

  const country = appealTargetCountry.value.trim();
  if (!country) {
    ElMessage.warning('请输入拟更改的目标国家/地区');
    return;
  }

  const selectedReasonsList: string[] = [];
  if (appealReasons.value.liveHere)
    selectedReasonsList.push('我目前居住在该国家/地区 (I live here)');
  if (appealReasons.value.movedHere)
    selectedReasonsList.push('我在过去一年内搬到了这里 (Relocated in the past year)');
  if (appealReasons.value.nearBorder)
    selectedReasonsList.push('我的居住/工作/就学地在领土边界附近 (Residence/work near border)');
  if (appealReasons.value.differentRegions)
    selectedReasonsList.push(
      '我的工作地/学习地和居住地分属不同地区 (Work and residence in different regions)',
    );
  if (appealReasons.value.frequentTravel)
    selectedReasonsList.push(
      '我经常往返于两地进行商务出差或私人旅行 (Frequent travel/commute between regions)',
    );
  if (appealReasons.value.paymentMethod)
    selectedReasonsList.push(
      '我的主要支付方式、银行卡及账单寄送地址在该地区 (Payment method/billing address in target region)',
    );
  if (appealReasons.value.familyReside)
    selectedReasonsList.push(
      '我的家属、亲人或配偶目前长期居住在该地区 (Family members/spouse reside in target region)',
    );
  if (appealReasons.value.relocating)
    selectedReasonsList.push(
      '我计划长期搬迁至该地区，且已签署当地房屋租赁协议或购置房产 (Relocating and rented/purchased property)',
    );

  if (selectedReasonsList.length === 0) {
    ElMessage.warning('请至少选择一至两个申诉依据');
    return;
  }

  isGeneratingAppeal.value = true;
  generatedAppealText.value = '';
  appealAbortCtrl = new AbortController();

  const isEn = appealLanguage.value === 'en';
  
  const lengthConstraint = isEn
    ? 'The length of the response must be between 60 and 80 words, and strictly under 90 words. The total character count (including letters, spaces, and punctuation) must be strictly under 450 characters. Write a brief, concise, and complete explanation.'
    : '中文陈述字数在 150-250 字之间，必须严格控制在 350 字以内，绝对不能超过 450 个字。请写出精简、完整的说明。';

  const promptText = `请帮我撰写一个 Google 改区/修改账号关联国家地址的申诉陈述。
目标国家/地区：${country}
生成语言：${isEn ? '英文 (English)' : '中文 (Chinese)'}
基于的申诉理由要点：
${selectedReasonsList.map((r) => `- ${r}`).join('\n')}

写作要求：
1. 请写出一段极其自然、符合真实人类生活和迁移场景的文字，可以直接用于填写 Google 'country-association-form' (国家关联表单) 中的“其他原因”输入框。
2. 必须以第一人称“我”撰写。
3. 不能带任何 Markdown 标签或代码框，只输出最终的陈述文本。
4. 严格遵守长度限制：${lengthConstraint} 请确保文本在限制范围内是完整的，并且句子能够自然结束，不要出现话只说了一半的情况。
5. 不要输出任何除了申诉理由正文之外的闲聊或提示词。`;

  try {
    const response = await fetch('/api/ai/write-assist', {
      method: 'POST',
      headers: createJsonHeaders(),
      body: JSON.stringify({
        action: 'generate',
        text: '',
        prompt: promptText,
        instruction: '',
        scope: 'full',
        tone: 'friendly',
        length: 'short',
        format: 'paragraphs',
      }),
      signal: appealAbortCtrl.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = 'AI 生成失败';
      try {
        const parsed = JSON.parse(errorText);
        errorMsg = parsed.error || parsed.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('浏览器不支持流式读取');
    }

    await parseSSEStream(
      reader,
      (payload) => {
        if (payload.text) {
          const newText = generatedAppealText.value + payload.text;
          if (newText.length > 500) {
            generatedAppealText.value = newText.slice(0, 500);
            if (appealAbortCtrl) {
              appealAbortCtrl.abort();
            }
          } else {
            generatedAppealText.value = newText;
          }
        }
        if (payload.error) {
          throw new Error(payload.error);
        }
      },
      () => {
        isGeneratingAppeal.value = false;
        appealAbortCtrl = null;
      },
      (err) => {
        if (err.name !== 'AbortError') {
          ElMessage.error(err.message || 'AI 生成异常');
        }
        isGeneratingAppeal.value = false;
        appealAbortCtrl = null;
      },
    );
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      ElMessage.error(e.message || 'AI 生成失败，请重试');
    }
    isGeneratingAppeal.value = false;
    appealAbortCtrl = null;
  }
};

const randomizeReasonsAndGenerate = () => {
  appealReasons.value = {
    liveHere: false,
    movedHere: false,
    nearBorder: false,
    differentRegions: false,
    frequentTravel: false,
    paymentMethod: false,
    familyReside: false,
    relocating: false,
  };

  const keys = [
    'liveHere',
    'movedHere',
    'nearBorder',
    'differentRegions',
    'frequentTravel',
    'paymentMethod',
    'familyReside',
    'relocating',
  ] as const;
  const countToPick = Math.random() < 0.5 ? 1 : 2;
  const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

  for (let i = 0; i < countToPick; i++) {
    appealReasons.value[shuffledKeys[i]] = true;
  }

  generateAppealText();
};

const copyText = (text: string, message: string = '已复制到剪贴板') => {
  if (!text) return;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success(message);
    })
    .catch(() => {
      ElMessage.error('复制失败');
    });
};
</script>

<template>
  <div class="lg:col-span-8 xl:col-span-9 space-y-4 lg:space-y-6 w-full">
    <div v-if="!selectedAccount" class="gw-card gw-empty-state !p-4 lg:!p-6">
      <button
        class="lg:hidden flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-400 py-1.5 px-3 rounded-lg border border-violet-500/30 dark:border-violet-500/20 bg-violet-500/10 dark:bg-violet-500/5 mb-4 cursor-pointer"
        @click="emit('back-to-list')"
      >
        <ArrowLeft class="w-3.5 h-3.5" />
        返回账号列表
      </button>
      <Info class="w-10 h-10 gw-icon-muted" />
      <p class="gw-muted-text text-xs lg:text-sm">
        请先在左侧选择一个谷歌账号，以查看并执行每日养号打卡任务。
      </p>
    </div>

    <div v-else class="gw-card space-y-4 lg:space-y-6 !p-3 lg:!p-6">
      <div class="lg:hidden flex items-center justify-between mb-2">
        <button
          class="flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 py-1 px-2.5 rounded-lg border border-violet-500/30 dark:border-violet-500/20 bg-violet-500/10 dark:bg-violet-500/5 transition-all cursor-pointer"
          @click="emit('back-to-list')"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          返回账号列表
        </button>
      </div>

      <div class="gw-account-detail-card flex items-center gap-4 py-2.5 px-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span
              class="text-sm font-bold truncate"
              style="color: var(--text-primary)"
              :title="selectedAccount.email"
            >
              {{ selectedAccount.email }}
            </span>
            <button
              class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-colors cursor-pointer"
              title="复制账号"
              @click="copyText(selectedAccount.email, '账号已复制')"
            >
              <Copy class="w-3.5 h-3.5" />
            </button>
            <span
              :class="[
                'text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0',
                getStatusBadgeClass(selectedAccount.status),
              ]"
            >
              {{ getStatusLabel(selectedAccount.status) }}
            </span>
          </div>
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]"
            style="color: var(--text-secondary)"
          >
            <span v-if="selectedAccount.password" class="flex items-center gap-1">
              密码: <code class="gw-code">{{ selectedAccount.password }}</code>
              <button
                class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-colors cursor-pointer"
                title="复制密码"
                @click="copyText(selectedAccount.password, '密码已复制')"
              >
                <Copy class="w-3 h-3" />
              </button>
            </span>
            <span v-if="selectedAccount.recoveryEmail" class="flex items-center gap-1">
              辅助邮箱: <code class="gw-code">{{ selectedAccount.recoveryEmail }}</code>
              <button
                class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-colors cursor-pointer"
                title="复制辅助邮箱"
                @click="copyText(selectedAccount.recoveryEmail, '辅助邮箱已复制')"
              >
                <Copy class="w-3 h-3" />
              </button>
            </span>
            <span class="flex items-center gap-1">
              地区: {{ selectedAccount.country || '-' }}
              <button
                class="text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 p-0.5 transition-all cursor-pointer text-[10px] font-semibold underline ml-1"
                title="复制谷歌改区关联链接"
                @click="
                  copyText(
                    'https://policies.google.com/country-association-form?hl=zh-CN&source=policies-site',
                    '改区链接已复制',
                  )
                "
              >
                (复制改区链接)
              </button>
            </span>
            <span v-if="selectedAccount.twoFASecret" class="flex items-center gap-1">
              2FA密钥:
              <code class="gw-code truncate max-w-[100px]" :title="selectedAccount.twoFASecret">{{
                selectedAccount.twoFASecret
              }}</code>
              <button
                class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-colors cursor-pointer"
                title="复制2FA密钥"
                @click="copyText(selectedAccount.twoFASecret, '2FA密钥已复制')"
              >
                <Copy class="w-3 h-3" />
              </button>
            </span>
            <span v-if="selectedAccount.backupCodes" class="flex items-center gap-1">
              备用密码:
              <code class="gw-code truncate max-w-[120px]" :title="selectedAccount.backupCodes">{{
                selectedAccount.backupCodes
              }}</code>
              <button
                class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-colors cursor-pointer"
                title="复制备用密码"
                @click="copyText(selectedAccount.backupCodes, '备用密码已复制')"
              >
                <Copy class="w-3 h-3" />
              </button>
            </span>
          </div>
        </div>

        <div
          v-if="selectedAccount.twoFASecret && currentTotpCode"
          class="flex items-center gap-2.5 px-3 py-1.5 rounded-xl shrink-0"
          style="background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.15)"
        >
          <Key class="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
          <div class="flex items-baseline gap-1.5">
            <span
              class="text-base font-mono font-bold tracking-widest text-violet-700 dark:text-violet-400"
              >{{ currentTotpCode.slice(0, 3) }} {{ currentTotpCode.slice(3) }}</span
            >
            <button
              class="p-0.5 text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 transition-colors cursor-pointer"
              title="复制验证码"
              @click="copyText(currentTotpCode, '验证码已复制')"
            >
              <Copy class="w-3 h-3" />
            </button>
          </div>
          <div class="flex items-center gap-1.5 border-l border-violet-500/20 pl-2.5">
            <span class="text-[10px] font-mono text-violet-600 dark:text-violet-400 font-semibold"
              >{{ totpTimeLeft }}s</span
            >
            <div
              class="w-5 h-5 rounded-full relative"
              style="border: 1.5px solid rgba(139, 92, 246, 0.3)"
            >
              <svg class="w-full h-full transform -rotate-90 absolute inset-0">
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  stroke="currentColor"
                  class="text-violet-500"
                  stroke-width="2"
                  fill="transparent"
                  :stroke-dasharray="2 * Math.PI * 8"
                  :stroke-dashoffset="2 * Math.PI * 8 * (1 - totpTimeLeft / 30)"
                  stroke-linecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            class="gw-icon-action-btn cursor-pointer"
            title="编辑"
            @click="emit('edit', selectedAccount)"
          >
            <Edit class="w-3.5 h-3.5" />
          </button>
          <button
            class="gw-icon-danger-btn cursor-pointer"
            title="删除"
            @click="emit('delete', selectedAccount)"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="gw-section-title flex items-center gap-2">
            <Calendar class="w-5 h-5 text-indigo-400" />
            {{ t('tools.googleWarming.warmingTimeline') }}
          </h3>
          <div class="flex items-center gap-2">
            <button
              class="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400 font-bold hover:bg-violet-500/20 transition-all text-xs cursor-pointer"
              @click="isAppealAssistantVisible = true"
            >
              <Sparkles class="w-3.5 h-3.5 text-violet-500" />
              <span>打开改区申诉助手</span>
            </button>
            <span class="gw-badge-indigo">
              {{
                t('tools.googleWarming.currentDayStatus', {
                  day: selectedAccount.currentDay,
                  status: getStatusLabel(selectedAccount.status),
                })
              }}
            </span>
          </div>
        </div>

        <div class="flex gap-1.5 overflow-x-auto pb-2 pr-1 scrollbar-thin">
          <div
            v-for="day in 14"
            :key="day"
            :class="[
              'gw-day-circle',
              day < selectedAccount.currentDay
                ? 'gw-day-done'
                : day === selectedAccount.currentDay
                  ? 'gw-day-current animate-pulse'
                  : 'gw-day-future',
            ]"
          >
            <span class="text-[9px] uppercase tracking-tighter opacity-60">D</span>
            <span>{{ day }}</span>
          </div>
        </div>
      </div>

      <div class="gw-checklist-card">
        <div class="gw-checklist-header">
          <h4 class="gw-checklist-title">
            {{ getStepDetails(selectedAccount.currentDay).title }}
          </h4>
          <p class="gw-muted-text text-xs mt-1">
            {{ getStepDetails(selectedAccount.currentDay).desc }}
          </p>
        </div>

        <div class="flex flex-col gap-3">
          <div
            v-for="act in getStepDetails(selectedAccount.currentDay).actions"
            :key="act.key"
            :class="['gw-check-item', dayChecklist[act.key] ? 'gw-check-item--done' : '']"
          >
            <input
              :id="act.key"
              v-model="dayChecklist[act.key]"
              type="checkbox"
              :disabled="isWarmedToday"
              class="w-4 h-4 mt-0.5 accent-emerald-500 cursor-pointer"
            />
            <label :for="act.key" class="gw-check-label flex-1">
              <div>{{ act.text }}</div>
              <div
                v-if="selectedAccount.currentDay === 7 && act.key === 'action6'"
                class="mt-2 flex flex-col gap-2"
                @click.stop.prevent
              >
                <div class="flex items-center gap-2">
                  <input
                    v-model="tempCountry"
                    placeholder="输入当前实际国家(如: 美国, 日本)"
                    class="gw-input !py-1 !px-2 !text-xs max-w-[200px]"
                    :disabled="isWarmedToday"
                    @keyup.enter="saveCountryInline"
                  />
                  <button
                    class="px-2.5 py-1 text-xs bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded transition cursor-pointer"
                    :disabled="isWarmedToday"
                    @click="saveCountryInline"
                  >
                    保存
                  </button>
                </div>
                <div
                  class="flex items-center gap-1 text-[11px] text-violet-600 dark:text-violet-400 font-semibold"
                >
                  <span>改区链接: </span>
                  <button
                    class="underline hover:text-violet-500 transition-colors cursor-pointer"
                    @click="
                      copyText(
                        'https://policies.google.com/country-association-form?hl=zh-CN&source=policies-site',
                        '改区链接已复制',
                      )
                    "
                  >
                    https://policies.google.com/country-association-form... (点击复制)
                  </button>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div class="gw-action-footer">
          <div class="gw-muted-text text-xs">
            <span v-if="selectedAccount.lastWarmedAt">
              上次打卡: {{ new Date(selectedAccount.lastWarmedAt).toLocaleString() }}
            </span>
            <span v-else>首次养号，快开始任务吧！</span>
          </div>

          <div>
            <button v-if="isWarmedToday" disabled class="gw-btn-disabled cursor-not-allowed">
              <CheckCircle class="w-4 h-4" />
              {{ t('tools.googleWarming.alreadyWarmed') }}
            </button>

            <button
              v-else
              :disabled="!isAllActionsChecked"
              :class="[
                'flex items-center gap-2 font-semibold text-sm px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-md',
                isAllActionsChecked
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
                  : 'gw-btn-disabled opacity-50 cursor-not-allowed',
              ]"
              @click="emit('warm-step')"
            >
              <Check class="w-4 h-4" />
              {{ t('tools.googleWarming.warmActionBtn', { day: selectedAccount.currentDay }) }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- AI Appeal Assistant Dialog -->
  <Modal
    :show="isAppealAssistantVisible"
    title="AI Google 改区申诉助手"
    size="lg"
    @close="isAppealAssistantVisible = false"
  >
    <div class="space-y-4">
      <div class="gw-import-hint text-[11px] text-slate-500 dark:text-slate-400">
        根据所选的申诉依据和目标国家/地区，由 AI 自动生成在 100
        字以内的精简、自然陈述，以便直接填写申诉表单。
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-semibold mb-1" style="color: var(--text-primary)">
            拟更改的目标国家/地区
          </label>
          <input
            v-model="appealTargetCountry"
            placeholder="例如: 美国, 日本"
            class="gw-input w-full !py-1.5 !px-3 !text-xs"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1" style="color: var(--text-primary)">
            生成语言
          </label>
          <select
            v-model="appealLanguage"
            class="gw-input w-full !py-1.5 !px-3 !text-xs bg-slate-50 dark:bg-slate-900"
          >
            <option value="zh">中文 (适合中文申诉)</option>
            <option value="en">英文 (适合境外账号或英文申诉)</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold mb-1.5" style="color: var(--text-primary)">
          申诉依据 (可多选，AI 将融合生成)
        </label>
        <div
          class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 bg-slate-50/50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50"
        >
          <el-checkbox v-model="appealReasons.liveHere" size="small"
            >我住在这里 (I live here)</el-checkbox
          >
          <el-checkbox v-model="appealReasons.movedHere" size="small"
            >我在过去一年内搬到了这里</el-checkbox
          >
          <el-checkbox v-model="appealReasons.nearBorder" size="small"
            >我工作/居住地在领土边界附近</el-checkbox
          >
          <el-checkbox v-model="appealReasons.differentRegions" size="small"
            >工作地/学习地和居住地分属不同地区</el-checkbox
          >
          <el-checkbox v-model="appealReasons.frequentTravel" size="small"
            >我经常往返于该地区进行旅行/出差</el-checkbox
          >
          <el-checkbox v-model="appealReasons.paymentMethod" size="small"
            >我的主要支付方式/账单地址属于该地区</el-checkbox
          >
          <el-checkbox v-model="appealReasons.familyReside" size="small"
            >我的家庭成员/配偶居住在该地区</el-checkbox
          >
          <el-checkbox v-model="appealReasons.relocating" size="small"
            >我计划长期搬迁至该地区并已租房/买房</el-checkbox
          >
        </div>
      </div>

      <div class="flex items-center gap-2 pt-2">
        <button
          :disabled="isGeneratingAppeal"
          class="flex items-center gap-1.5 font-semibold text-xs px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition cursor-pointer shadow disabled:opacity-50 disabled:cursor-not-allowed"
          @click="generateAppealText"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>{{ isGeneratingAppeal ? 'AI 生成中...' : 'AI 一键生成理由' }}</span>
        </button>
        <button
          :disabled="isGeneratingAppeal"
          class="flex items-center gap-1.5 font-semibold text-xs px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          @click="randomizeReasonsAndGenerate"
        >
          <span>随机选理由并生成</span>
        </button>
      </div>

      <div
        v-if="generatedAppealText || isGeneratingAppeal"
        class="relative bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-slate-500 flex items-center gap-1">
            <FileText class="w-3.5 h-3.5" />
            生成结果 (字数: {{ generatedAppealText.length }}/500)
          </span>
          <button
            v-if="generatedAppealText"
            class="text-xs text-violet-600 hover:text-violet-500 font-semibold underline flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
            @click="copyText(generatedAppealText, '申诉理由已复制')"
          >
            <Copy class="w-3.5 h-3.5" />
            复制申诉理由
          </button>
        </div>
        <div
          class="text-xs whitespace-pre-wrap leading-relaxed font-mono select-all"
          style="color: var(--text-primary)"
        >
          {{ generatedAppealText || 'AI 正在努力思考中...' }}
        </div>
      </div>
    </div>
  </Modal>
</template>

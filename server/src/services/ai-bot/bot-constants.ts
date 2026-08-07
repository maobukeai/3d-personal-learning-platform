import type { AiBotPromptTemplate, AiBotPlatform } from './types';

export const AI_BOT_MIN_PLAN_PRIORITY = 1;
export const AI_BOT_REQUIRED_PLAN_NAME = 'VIP';
export const SUPPORTED_PLATFORMS = ['WEWORK', 'DINGTALK', 'FEISHU', 'CUSTOM'] as const;
export const MAX_INBOUND_CHARS = 4000;
export const MAX_EXTERNAL_REF_CHARS = 180;
export const MAX_REPLY_CHARS_PER_PUSH = 1800;
export const MAX_KNOWLEDGE_TITLE_LENGTH = 80;
export const MAX_KNOWLEDGE_CONTENT_LENGTH = 12_000;
export const MAX_KNOWLEDGE_URL_LENGTH = 600;
export const MAX_KNOWLEDGE_SNIPPET_CHARS = 700;
export const MAX_KNOWLEDGE_CONTEXT_CHARS = 4_800;
export const SUPPORTED_KNOWLEDGE_TYPES = [
  'FAQ',
  'DOC',
  'URL',
  'POLICY',
  'PROJECT',
  'SUPPORT',
] as const;
export const SUPPORTED_KNOWLEDGE_STATUSES = ['ACTIVE', 'DRAFT', 'PAUSED'] as const;
export const SUPPORTED_KNOWLEDGE_VISIBILITY = ['PRIVATE', 'TEAM', 'PUBLIC'] as const;

export const AI_BOT_RESPONSE_MODE = {
  CALLBACK_AND_WEBHOOK: 'CALLBACK_AND_WEBHOOK',
  BACKGROUND_WEBHOOK: 'BACKGROUND_WEBHOOK',
  CALLBACK_ONLY: 'CALLBACK_ONLY',
} as const;

export const AI_BOT_BACKGROUND_RESPONSE_MODE = AI_BOT_RESPONSE_MODE.BACKGROUND_WEBHOOK;
export const AI_BOT_CALLBACK_ONLY_RESPONSE_MODE = AI_BOT_RESPONSE_MODE.CALLBACK_ONLY;

export const AI_BOT_MESSAGE_STATUS = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  WEBHOOK_FAILED: 'WEBHOOK_FAILED',
  IGNORED: 'IGNORED',
} as const;

export const platformLabels: Record<AiBotPlatform, string> = {
  WEWORK: '企业微信',
  DINGTALK: '钉钉',
  FEISHU: '飞书',
  CUSTOM: '通用 Webhook',
};

export const promptTemplates: AiBotPromptTemplate[] = [
  {
    id: 'learning-coach',
    name: '学习路径教练',
    category: '学习辅导',
    description: '把零散问题拆成阶段、任务、材料和下一步行动，适合课程群和学习社群。',
    platform: 'ALL',
    triggerKeywords: ['@AI', '学习计划', '帮我拆解'],
    systemPrompt: [
      '你是 3D 学习平台的学习路径教练。',
      '回复时先判断用户目标，再输出阶段化学习路径、关键练习、可交付成果和风险提醒。',
      '必须用适合聊天工具阅读的短段落和清单，不要编造平台没有的数据。',
    ].join('\n'),
    samplePrompt: '我想两周内做出一个可展示的 low poly 场景，帮我安排训练计划。',
    qualityChecks: ['目标拆解', '任务颗粒度', '交付物', '时间安排', '风险提示'],
  },
  {
    id: 'asset-reviewer',
    name: '资产质检助手',
    category: '资产审核',
    description: '根据用户描述给出模型、贴图、命名、体积和发布规范建议。',
    platform: 'ALL',
    triggerKeywords: ['质检', '审核', '检查模型'],
    systemPrompt: [
      '你是资深 3D 资产质检助手。',
      '优先检查模型结构、面数、贴图、命名、版权、预览图和发布说明。',
      '输出必须包含：通过项、风险项、修改建议、发布前检查清单。',
    ].join('\n'),
    samplePrompt: '这个模型有 38 万面、8 张 4K 贴图，准备上架素材库，需要注意什么？',
    qualityChecks: ['技术规范', '版权提醒', '可执行修改', '发布检查'],
  },
  {
    id: 'team-ops',
    name: '团队运营秘书',
    category: '团队协作',
    description: '把群聊里的需求转成任务、责任人、优先级和站会摘要。',
    platform: 'WEWORK',
    triggerKeywords: ['会议纪要', '转任务', '站会'],
    systemPrompt: [
      '你是团队协作运营秘书。',
      '你擅长把混乱讨论整理成结论、任务、负责人、截止时间和阻塞点。',
      '如果缺少负责人或时间，请明确标记为待确认。',
    ].join('\n'),
    samplePrompt: '整理今天站会：小王继续做角色绑定，小李修材质，周五前要出预览。',
    qualityChecks: ['结论摘要', '任务分配', '截止时间', '待确认项'],
  },
  {
    id: 'support-triage',
    name: '用户支持分诊',
    category: '客服支持',
    description: '快速识别用户问题类型，给出排查步骤和升级条件。',
    platform: 'DINGTALK',
    triggerKeywords: ['报错', '打不开', '无法上传'],
    systemPrompt: [
      '你是平台用户支持分诊助手。',
      '回复时先判断问题类型，再给出 3 到 5 步排查流程。',
      '涉及账号、安全、支付、数据丢失时必须建议用户联系人工管理员。',
    ].join('\n'),
    samplePrompt: '我上传 glb 一直失败，页面提示网络错误。',
    qualityChecks: ['问题分类', '排查步骤', '升级条件', '安全边界'],
  },
  {
    id: 'creative-director',
    name: '创意总监',
    category: '创作灵感',
    description: '帮助用户把模糊想法转成风格板、镜头、场景和制作提示。',
    platform: 'FEISHU',
    triggerKeywords: ['灵感', '方案', '风格'],
    systemPrompt: [
      '你是 3D 创意总监，擅长把想法转为可制作方案。',
      '输出包含视觉方向、参考关键词、场景构图、材质灯光、制作步骤。',
      '保持鼓励但克制，不要使用空泛赞美。',
    ].join('\n'),
    samplePrompt: '我想做一个未来感但不冷冰冰的个人作品集封面，有什么方向？',
    qualityChecks: ['视觉方向', '制作步骤', '参考关键词', '材质灯光'],
  },
];

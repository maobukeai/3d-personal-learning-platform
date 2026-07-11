import { z } from 'zod';

// ============================================================================
// Batch 2 Zod schemas — route-level validation for
// ai / notification / backup / email / google-warming routes
// Required fields are validated strictly; optional fields are permissive.
// ============================================================================

// --- AI routes ---

export const aiWriteAssistSchema = z.object({
  action: z.enum(['polish', 'extend', 'summarize', 'continue', 'translate', 'generate']),
  text: z.string().optional(),
  prompt: z.string().optional(),
  instruction: z.string().optional(),
  scope: z.string().optional(),
  tone: z.string().optional(),
  length: z.string().optional(),
  format: z.string().optional(),
  targetLanguage: z.string().optional(),
  history: z.array(z.any()).optional(),
});

export const aiOptimizePromptSchema = z.object({
  prompt: z.string().min(1, '提示词不能为空'),
  type: z.string().optional(),
});

export const aiGenerateImageSchema = z.object({
  prompt: z.string().min(1, '提示词不能为空'),
  modelId: z.string().optional(),
  type: z.string().optional(),
});

// --- Notification routes ---

export const notificationPreferencesSchema = z.object({
  pushSystemUpdates: z.boolean().optional(),
  pushTeamActivity: z.boolean().optional(),
  pushMentions: z.boolean().optional(),
  pushDirectMessages: z.boolean().optional(),
  pushMarketing: z.boolean().optional(),
  emailSystemUpdates: z.boolean().optional(),
  emailTeamActivity: z.boolean().optional(),
  emailDirectMessages: z.boolean().optional(),
  emailMentions: z.boolean().optional(),
  emailMarketing: z.boolean().optional(),
});

// --- Backup routes ---

export const backupConfigSchema = z.object({
  url: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  dir: z.string().optional(),
  retentionDays: z.union([z.number(), z.string()]).optional(),
});

export const backupTestConfigSchema = z.object({
  url: z.string().min(1, '服务地址不能为空'),
  username: z.string().min(1, '账号不能为空'),
  password: z.string().optional(),
  dir: z.string().optional(),
});

export const backupRunSchema = z.object({
  categories: z.array(z.string()).min(1, '请选择要备份的分类'),
});

export const backupRestoreSchema = z.object({
  filename: z.string().min(1, '文件名不能为空'),
  restoreCategories: z.array(z.string()).min(1, '请选择要恢复的分类'),
});

// --- Email routes ---

export const emailImportAccountsSchema = z.object({
  importData: z.string().min(1, '请提供有效的导入数据内容'),
  proxy: z.string().optional(),
  minDelay: z.union([z.number(), z.string()]).optional(),
  maxDelay: z.union([z.number(), z.string()]).optional(),
  dailyLimit: z.union([z.number(), z.string()]).optional(),
});

export const emailUpdateAccountSchema = z.object({
  password: z.string().optional().nullable(),
  clientId: z.string().optional(),
  refreshToken: z.string().optional(),
  proxy: z.string().optional().nullable(),
  dailyLimit: z.union([z.number(), z.string()]).optional(),
  minDelay: z.union([z.number(), z.string()]).optional(),
  maxDelay: z.union([z.number(), z.string()]).optional(),
});

export const emailMarkMessageReadSchema = z.object({
  isRead: z.boolean(),
});

export const emailSendSchema = z.object({
  to: z.union([
    z.string().min(1, '收件人不能为空'),
    z.array(z.string().min(1)).min(1, '收件人不能为空'),
  ]),
  subject: z.string().min(1, '主题不能为空'),
  content: z.string().min(1, '邮件正文内容不能为空'),
  accountId: z.string().optional(),
});

// --- Google warming routes ---

export const googleWarmingImportSchema = z.object({
  accounts: z.array(z.any()),
});

export const googleWarmingAiParseSchema = z.object({
  text: z.string().min(1, '请提供待解析的文本内容'),
  translateCountry: z.boolean().optional(),
});

export const googleWarmingBatchIdsSchema = z.object({
  ids: z.array(z.string()).min(1, '请提供账号 ID 列表'),
});

export const googleWarmingBatchStatusSchema = z.object({
  ids: z.array(z.string()).min(1, '请提供账号 ID 列表'),
  status: z.enum(['warming', 'completed', 'paused']),
});

export const googleWarmingBatchCategorySchema = z.object({
  ids: z.array(z.string()).min(1, '请提供账号 ID 列表'),
  category: z.string().optional(),
});

export const googleWarmingRenameCategorySchema = z.object({
  oldCategory: z.string().min(1, '请提供原分类名称'),
  newCategory: z.string().optional(),
});

export const googleWarmingDeleteCategorySchema = z.object({
  category: z.string().min(1, '请提供要删除的分类名称'),
});

export const googleWarmingAddCategorySchema = z.object({
  category: z.string().min(1, '分类名称不能为空'),
});

export const googleWarmingUpdateAccountSchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
  recoveryEmail: z.string().optional().nullable(),
  twoFASecret: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  backupCodes: z.string().optional().nullable(),
  category: z.string().optional(),
  status: z.string().optional(),
  currentDay: z.union([z.number(), z.string()]).optional(),
});

import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password length must be 6-128 characters').max(128),
  name: z.string().max(50, 'Name must be 50 characters or fewer').optional().nullable(),
  verificationCode: z.string().length(6, 'Verification code must be 6 digits'),
});

export const sendCodePublicSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const verifyPublicEmailSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  deviceToken: z.string().optional(),
});

export const login2FASchema = z.object({
  userId: z.string().min(1, 'User id is required'),
  code: z.string().regex(/^(\d{6}|[A-Fa-f0-9]{8})$/, 'Invalid 2FA or recovery code format'),
  rememberDevice: z.boolean().optional(),
});

export const forgotPasswordCheckSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordWith2FASchema = z.object({
  email: z.string().email('Invalid email format'),
  resetCode: z.string().length(6, 'Email verification code must be 6 digits'),
  twoFactorCode: z.string().optional().nullable(),
  newPassword: z.string().min(6, 'Password length must be 6-128 characters').max(128),
});

export const profileSchema = z.object({
  name: z.string().max(50, 'Name must be 50 characters or fewer').optional().nullable(),
  bio: z.string().max(500, 'Bio must be 500 characters or fewer').optional().nullable(),
  location: z.string().max(100, 'Location must be 100 characters or fewer').optional().nullable(),
  website: z.string().max(255, 'Website must be 255 characters or fewer').optional().nullable(),
  defaultWorkspaceId: z.string().optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'Password length must be 6-128 characters').max(128),
});

export const verifyEmailSchema = z.object({
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const sendCodeToNewEmailSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const enable2FASchema = z.object({
  code: z.string().length(6, '2FA code must be 6 digits'),
  password: z.string().min(1, 'Password is required'),
});

export const deleteAccountSchema = z.object({
  twoFactorCode: z.string().length(6, '2FA code must be 6 digits').optional().nullable(),
  password: z.string().optional().nullable(),
});

export const createUserSchema = z.object({
  name: z.string().max(50, 'Name must be 50 characters or fewer').optional().nullable(),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password length must be 6-128 characters').max(128),
  role: z.enum(['USER', 'ADMIN', 'INSTRUCTOR']).optional(),
});

export const updateSettingsSchema = z.object({
  settings: z.union([
    z.record(z.string(), z.unknown()),
    z.array(
      z.object({
        key: z.string().min(1, 'Key is required'),
        value: z.unknown(),
      }),
    ),
  ]),
});

export const courseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title cannot exceed 100 characters'),
  description: z
    .string()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional()
    .nullable(),
  thumbnail: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export const lessonSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  title: z.string().min(1, 'Title is required').max(100, 'Title cannot exceed 100 characters'),
  content: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  order: z
    .union([z.number().min(0, 'Order must be at least 0'), z.string()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .refine((val) => val >= 0, { message: 'Order must be at least 0' }),
  duration: z
    .union([z.number().min(0, 'Duration must be at least 0'), z.string()])
    .optional()
    .nullable()
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .refine((val) => val === undefined || val === null || val >= 0, {
      message: 'Duration must be at least 0',
    }),
  hotspots: z.any().optional().nullable(),
  sceneConfig: z.any().optional().nullable(),
});

export const discussionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(150, 'Title cannot exceed 150 characters'),
  content: z.string().min(1, 'Content is required'),
  courseId: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
});

export const pluginSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title cannot exceed 100 characters'),
  description: z.string().optional().nullable(),
  category: z.string().optional(),
  version: z.string().optional(),
  compatibility: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  installGuide: z.string().optional().nullable(),
  originality: z.enum(['ORIGINAL', 'AUTHORIZED', 'REMIX']).optional(),
  originalAuthor: z.string().optional().nullable(),
  originalLink: z.string().optional().nullable(),
  license: z.string().optional().nullable(),
  isFree: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === 'true'),
  linkedCourseId: z.string().optional().nullable(),
  linkedLessonId: z.string().optional().nullable(),
  externalUrl: z.string().optional().nullable(),
  extractionCode: z.string().optional().nullable(),
});

export const softwareSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title cannot exceed 100 characters'),
  description: z.string().optional().nullable(),
  category: z.string().optional(),
  version: z.string().optional(),
  compatibility: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  installGuide: z.string().optional().nullable(),
  originality: z.enum(['ORIGINAL', 'AUTHORIZED', 'REMIX']).optional(),
  originalAuthor: z.string().optional().nullable(),
  originalLink: z.string().optional().nullable(),
  license: z.string().optional().nullable(),
  isFree: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === 'true'),
  linkedCourseId: z.string().optional().nullable(),
  linkedLessonId: z.string().optional().nullable(),
  externalUrl: z.string().optional().nullable(),
  extractionCode: z.string().optional().nullable(),
});

export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(150, 'Title cannot exceed 150 characters'),
  description: z.string().optional().nullable(),
  status: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  tags: z.string().optional().nullable(),
  subtasks: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  participantIds: z.array(z.string()).optional().nullable(),
  timeEstimate: z
    .union([z.number().min(0, 'Time estimate must be at least 0'), z.string()])
    .optional()
    .nullable()
    .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
    .refine((val) => val === undefined || val === null || val >= 0, {
      message: 'Time estimate must be at least 0',
    }),
  timeSpent: z
    .union([z.number().min(0, 'Time spent must be at least 0'), z.string()])
    .optional()
    .nullable()
    .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
    .refine((val) => val === undefined || val === null || val >= 0, {
      message: 'Time spent must be at least 0',
    }),
});

export const enrollCourseSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
});

export const updateProgressSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  progress: z.number().min(0, 'Progress must be at least 0').max(100, 'Progress cannot exceed 100'),
});

export const toggleLessonCompleteSchema = z.object({
  completed: z.boolean(),
});

export const toggleLessonCompleteParamsSchema = z.object({
  lessonId: z.string().min(1, 'Lesson ID is required'),
});

export const createReviewSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().max(1000, 'Comment cannot exceed 1000 characters').optional().nullable(),
});

export const updateReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5')
    .optional(),
  comment: z.string().max(1000, 'Comment cannot exceed 1000 characters').optional().nullable(),
});

export const createNoteSchema = z.object({
  lessonId: z.string().min(1, 'Lesson ID is required'),
  content: z.string().min(1, 'Content is required'),
  timestamp: z.number().min(0).optional().nullable(),
});

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'Content is required').optional(),
  timestamp: z.number().min(0).optional().nullable(),
});

// ============================================================================
// P0 Zod Schemas — route-level validation for asset/material/note/message/feedback/plugin.admin
// ============================================================================

// --- Shared helpers ---
const booleanLike = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .transform((v) => v === true || v === 'true' || v === 1 || v === '1');

const optionalString = z.string().optional().nullable();

// --- Asset schemas ---
export const assetCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content cannot be empty'),
});

export const assetRequestSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().min(1, 'Description is required'),
});

export const assetRequestReplySchema = z.object({
  content: z.string().trim().min(1, 'Reply content cannot be empty'),
  linkedAssetId: optionalString,
});

export const assetShareSchema = z.object({
  expiresAt: optionalString,
  expireHours: z.number().nullable().optional(),
  customText: optionalString,
});

export const assetAnnotationSchema = z.object({
  content: z.string().min(1, 'Annotation content is required'),
  x: z.coerce.number(),
  y: z.coerce.number(),
  z: z.coerce.number(),
  cameraPos: z.any().optional().nullable(),
  cameraTarget: z.any().optional().nullable(),
});

export const assetVersionSchema = z.object({
  changeLog: optionalString,
});

// --- Material schemas ---
export const materialCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content cannot be empty'),
});

export const materialRequestSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().min(1, 'Description is required'),
});

export const materialRequestReplySchema = z.object({
  content: z.string().trim().min(1, 'Reply content cannot be empty'),
  linkedMaterialId: optionalString,
});

export const materialShareSchema = z.object({
  expiresAt: optionalString,
  expireHours: z.number().nullable().optional(),
  customText: optionalString,
});

export const materialReviewSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  rejectReason: optionalString,
});

// --- Note schemas (standalone notes, not lesson notes) ---
export const noteCreateSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空'),
  content: z.string().trim().min(1, '内容不能为空'),
  summary: optionalString,
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional().default('PRIVATE'),
  tags: z.any().optional().nullable(),
  category: optionalString,
});

export const noteUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1).optional(),
  summary: optionalString,
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  tags: z.any().optional().nullable(),
  category: optionalString,
});

export const noteCommentSchema = z.object({
  content: z.string().trim().min(1, '评论内容不能为空'),
});

// --- Message schemas ---
export const createConversationSchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1, 'At least one participant is required'),
  name: optionalString,
  avatarUrl: optionalString,
  isGroup: booleanLike,
});

export const updateConversationSchema = z.object({
  name: optionalString,
  avatarUrl: optionalString,
});

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  content: z.string().optional(),
  type: z.string().optional(),
  replyToId: optionalString,
});

export const translateMessageSchema = z
  .object({
    content: z.string().optional(),
    messages: z.array(z.any()).optional(),
  })
  .refine((data) => data.content || (data.messages && data.messages.length > 0), {
    message: 'Content or messages array is required',
  });

// --- Feedback schemas ---
export const submitFeedbackSchema = z.object({
  type: z.enum(['Bug', 'Feature', 'UI', 'Other']),
  title: z.string().trim().min(3, 'Title must be between 3 and 120 characters').max(120),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be between 10 and 5000 characters')
    .max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
  attachmentUrl: optionalString,
});

export const updateFeedbackStatusSchema = z.object({
  status: z.enum(['OPEN', 'CLOSED']),
});

// --- Plugin admin schemas ---
export const adminPluginUpdateSchema = z.object({
  title: z.string().max(100).optional(),
  description: optionalString,
  category: z.string().optional(),
  version: z.string().optional(),
  compatibility: optionalString,
  tags: optionalString,
  installGuide: optionalString,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  rejectReason: optionalString,
});

export const adminPluginBatchUpdateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, '请选择要操作的插件'),
  status: z.enum(['APPROVED', 'REJECTED', 'PENDING']),
  rejectReason: optionalString,
});

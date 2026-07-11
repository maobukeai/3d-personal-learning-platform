import { z } from 'zod';

// ============================================================================
// Zod schemas for route-level validation (batch 1).
// Covers: project, showcase, team, temporary-netdisk, resource routes.
// Required fields are validated strictly; optional/complex fields are permissive.
// ============================================================================

// --- Shared helpers ---
const optionalString = z.string().optional().nullable();
const numberLike = z.union([z.number(), z.string()]).optional();
const booleanLike = z.union([z.boolean(), z.string()]);

// ============================================================================
// Project route schemas
// ============================================================================

export const createProjectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  description: optionalString,
  dueDate: optionalString,
  color: z.string().optional(),
  tags: optionalString,
  visibility: z.string().optional(),
  maxMembers: numberLike,
  memberIds: z.array(z.string()).optional(),
  inviteUserIds: z.array(z.string()).optional(),
});

// All fields optional — permissive update shape.
export const updateProjectSchema = z.record(z.string(), z.unknown()).default({});

export const importProjectFromTextSchema = z.object({
  text: z.string().min(1, '导入内容不能为空'),
});

export const aiGenerateProjectTextSchema = z.object({
  prompt: z.string().min(1, '输入设想不能为空'),
});

export const parseNetdiskLinkSchema = z.object({
  url: z.string().min(1, '链接不能为空'),
  password: optionalString,
});

export const aiChatSchema = z.object({
  messages: z.array(z.any()).min(1, '对话内容不能为空'),
  context: z.any().optional(),
  modelId: optionalString,
  sessionId: optionalString,
  sessionTitle: optionalString,
  searchEnabled: z.any().optional(),
  mode: z.string().optional(),
  clientRunId: optionalString,
});

export const coPlanChatSchema = z.object({
  messages: z.array(z.any()).min(1, '对话内容不能为空'),
  netdiskInfo: z.any().optional(),
  currentPlan: z.any().optional(),
  modelId: optionalString,
});

export const importProjectFromJsonSchema = z.object({
  plan: z.record(z.string(), z.unknown()),
});

// Permissive session update body.
export const updateAiChatSessionSchema = z.record(z.string(), z.unknown()).default({});

// Body only carries optional modelId; permissive.
export const summarizeAiChatSessionSchema = z.record(z.string(), z.unknown()).default({});

export const cleanAiMessagesSchema = z.object({
  sessionId: z.string().min(1, '会话 ID 不能为空'),
  messageId: z.string().min(1, '消息 ID 不能为空'),
  inclusive: z.any().optional(),
});

export const inviteToProjectSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, 'No users specified'),
});

export const removeProjectMemberSchema = z.object({
  userId: z.string().min(1, 'Target userId is required'),
});

export const addProjectDiscussionSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  type: z.string().optional(),
  images: z.any().optional(),
  fileUrl: optionalString,
  fileName: optionalString,
  fileSize: numberLike,
});

export const addDiscussionReactionSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required'),
});

export const createProjectTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: optionalString,
  assigneeId: optionalString,
  dueDate: optionalString,
  participantIds: z.array(z.string()).optional(),
});

export const batchCreateProjectTasksSchema = z.object({
  tasks: z.array(z.any()).min(1, 'Tasks array is required'),
});

// Task update — all optional / complex; permissive.
export const updateProjectTaskSchema = z.record(z.string(), z.unknown()).default({});

// ============================================================================
// Showcase route schemas
// ============================================================================

// Multipart form-data body (text fields arrive as strings).
export const createShowcaseSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  description: optionalString,
  tags: optionalString,
  videoUrl: optionalString,
  isVideo: z.any().optional(),
  type: z.string().optional(),
  assetId: optionalString,
  linkedAssetIds: z.any().optional(),
  linkedMaterialIds: z.any().optional(),
  linkedPluginIds: z.any().optional(),
});

export const publishAssetToShowcaseSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  title: optionalString,
  description: optionalString,
  tags: optionalString,
});

// Multipart update — all optional; permissive.
export const updateShowcaseSchema = z.record(z.string(), z.unknown()).default({});

export const addShowcaseCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
});

// ============================================================================
// Team route schemas
// ============================================================================

export const createTeamSchema = z.object({
  name: z.string().min(1, '团队名称不能为空'),
  description: optionalString,
  avatarUrl: optionalString,
  visibility: z.string().optional(),
  category: z.string().optional(),
});

// All optional update fields; permissive.
export const updateTeamSchema = z.record(z.string(), z.unknown()).default({});

export const respondToInvitationSchema = z.object({
  invitationId: z.string().min(1, 'Invitation ID is required'),
  accept: booleanLike,
});

export const inviteToTeamSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  inviteeEmail: z.string().min(1, 'Email is required'),
});

export const applyToTeamSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  message: optionalString,
});

export const respondToApplicationSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  accept: booleanLike,
});

export const addMemberDirectlySchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  role: z.string().optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.string().min(1, 'Role is required'),
});

// ============================================================================
// Temporary netdisk route schemas
// ============================================================================

export const verifySharePasswordSchema = z.object({
  password: optionalString,
});

export const createNetdiskShareSchema = z.object({
  fileId: z.string().min(1, '缺少 fileId 参数'),
  password: optionalString,
  expiresDays: numberLike,
});

export const netdiskPresignedUrlSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  mimetype: z.string().min(1, 'mimetype is required'),
  size: numberLike,
});

export const netdiskCompleteSingleUploadSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  key: z.string().min(1, 'key is required'),
  size: z.union([z.number(), z.string()]),
  mimetype: z.string().min(1, 'mimetype is required'),
});

export const netdiskInitiateMultipartSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  mimetype: z.string().min(1, 'mimetype is required'),
  size: numberLike,
});

export const netdiskPresignPartsSchema = z.object({
  key: z.string().min(1, 'key is required'),
  uploadId: z.string().min(1, 'uploadId is required'),
  partNumbers: z.array(z.union([z.number(), z.string()])).min(1, 'partNumbers is required'),
});

export const netdiskCompleteMultipartSchema = z.object({
  key: z.string().min(1, 'key is required'),
  uploadId: z.string().min(1, 'uploadId is required'),
  parts: z.array(z.any()).min(1, 'parts is required'),
  filename: z.string().min(1, 'filename is required'),
  mimetype: z.string().min(1, 'mimetype is required'),
  size: z.union([z.number(), z.string()]),
});

export const netdiskAbortMultipartSchema = z.object({
  key: z.string().min(1, 'key is required'),
  uploadId: z.string().min(1, 'uploadId is required'),
});

// ============================================================================
// Resource route schemas
// ============================================================================

export const importExternalResourceSchema = z.object({
  url: z.string().min(1, 'url is required'),
  title: z.string().min(1, 'title is required'),
  type: z.string().min(1, 'type is required'),
  snippet: optionalString,
});

export const cancelTempUploadSchema = z.object({
  filePath: z.string().min(1, '无效的文件路径'),
});

export const resourcePresignedUrlSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  mimetype: z.string().min(1, 'mimetype is required'),
  size: numberLike,
  fieldname: z.string().optional(),
});

export const resourceCompleteSingleUploadSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  key: z.string().min(1, 'key is required'),
  size: z.union([z.number(), z.string()]),
  mimetype: z.string().min(1, 'mimetype is required'),
  fieldname: z.string().optional(),
});

export const resourceInitiateMultipartSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  mimetype: z.string().min(1, 'mimetype is required'),
  size: numberLike,
  fieldname: z.string().optional(),
});

export const resourcePresignPartsSchema = z.object({
  key: z.string().min(1, 'key is required'),
  uploadId: z.string().min(1, 'uploadId is required'),
  partNumbers: z.array(z.union([z.number(), z.string()])).min(1, 'partNumbers is required'),
  fieldname: z.string().optional(),
});

export const resourceCompleteMultipartSchema = z.object({
  key: z.string().min(1, 'key is required'),
  uploadId: z.string().min(1, 'uploadId is required'),
  parts: z.array(z.any()).min(1, 'parts is required'),
  filename: z.string().min(1, 'filename is required'),
  mimetype: z.string().min(1, 'mimetype is required'),
  size: z.union([z.number(), z.string()]),
  fieldname: z.string().optional(),
});

export const resourceAbortMultipartSchema = z.object({
  key: z.string().min(1, 'key is required'),
  uploadId: z.string().min(1, 'uploadId is required'),
  fieldname: z.string().optional(),
});

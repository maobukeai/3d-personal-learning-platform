import { Response, NextFunction } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { checkProjectQuota } from '../utils/quota';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../middlewares/error.middleware';
import {
  AIChatMessage as ServiceAIChatMessage,
  callLLM,
  streamLLMChat,
} from '../services/ai.service';
import { getAIModelById, settingsService } from '../services/settings.service';
import { parseBaiduNetdiskLink } from '../utils/baiduNetdisk';
import { hasPromptInjection } from '../utils/security';
import {
  PROJECT_GENERATION_PROMPT,
  AI_SPRITE_CHAT_PROMPT,
  BAIDU_NETDISK_ANALYSIS_PROMPT,
  getCoPlanChatPrompt,
} from '../config/prompts';
import { checkTeamProjectPermission } from './project.controller';

type AiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const MAX_AI_CHAT_MESSAGES = 12;
const MAX_AI_CHAT_MESSAGE_CHARS = 12000;
const MAX_AI_CHAT_TOTAL_CHARS = 36000;
const MAX_AI_HISTORY_ITEMS = 80;

const redactSensitiveContent = (content: string): string =>
  content
    .replace(
      /\b(?:api[_-]?key|token|secret|password|passwd|access[_-]?token|refresh[_-]?token)\s*[:=]\s*([^\s,;]+)/gi,
      (match) => match.replace(/([:=]\s*)([^\s,;]+)/, '$1[已脱敏]'),
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [已脱敏]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[邮箱已脱敏]')
    .replace(/\b1[3-9]\d{9}\b/g, '[手机号已脱敏]');

const normalizeAiChatMessages = (messages: unknown): AiChatMessage[] => {
  if (!Array.isArray(messages)) return [];

  return messages
    .slice(-MAX_AI_CHAT_MESSAGES)
    .map((message) => {
      if (!message || typeof message !== 'object') return null;
      const raw = message as Record<string, unknown>;
      const role = raw.role === 'assistant' ? 'assistant' : raw.role === 'user' ? 'user' : null;
      const content = typeof raw.content === 'string' ? raw.content.trim() : '';

      if (!role || !content) return null;

      return {
        role,
        content:
          content.length > MAX_AI_CHAT_MESSAGE_CHARS
            ? content.slice(0, MAX_AI_CHAT_MESSAGE_CHARS)
            : content,
      };
    })
    .filter((message): message is AiChatMessage => Boolean(message));
};

const cleanPromptContextValue = (value: unknown, maxLength = 120): string => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const buildAiChatContextPrompt = (context: unknown, req: AuthRequest): string => {
  if (!context || typeof context !== 'object') return '';

  const requestContext = context as Record<string, unknown>;
  const path = cleanPromptContextValue(requestContext.path, 240);
  const title = cleanPromptContextValue(requestContext.title);
  if (!path) return '';

  const lines = [
    '【当前可信页面上下文】',
    `页面路径: ${path}`,
    `页面标题: ${title || '未提供'}`,
    `用户角色: ${req.user?.role || 'GUEST'}`,
    `工作空间: ${req.workspaceId || '未认证访客'}`,
  ];

  if (path.includes('/assets/') || path.includes('/models') || path.includes('/my-works')) {
    lines.push(
      '场景: 3D 资产查看/管理。',
      '回答重点: WebGL/Three.js 渲染、材质贴图、光照、相机控制、格式兼容、性能优化和资产质量检查。',
    );
  } else if (
    path.includes('/work') ||
    path.includes('/tasks') ||
    path.includes('/team-tasks') ||
    path.includes('/project/')
  ) {
    lines.push(
      '场景: 项目协作或任务看板。',
      '回答重点: 任务拆解、优先级、依赖关系、风险控制、验收标准、团队协作节奏。',
    );
  } else if (path.includes('/academy') || path.includes('/course') || path.includes('/lesson')) {
    lines.push('场景: 课程学习。', '回答重点: 知识点解释、练习设计、阶段复盘、学习效果验证。');
  } else if (path.includes('/notes') || path.includes('/roadmaps')) {
    lines.push(
      '场景: 知识沉淀或学习路线。',
      '回答重点: 笔记结构、复习策略、路线里程碑、可衡量学习成果。',
    );
  } else if (path.includes('/admin')) {
    lines.push(
      '场景: 管理后台。',
      '回答重点: 配置安全、权限边界、审计、运营治理。不要暴露或要求用户提供密钥明文。',
    );
  }

  return lines.join('\n');
};

export const aiGenerateProjectText = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { prompt } = req.body;
  if (!prompt || !prompt.trim()) {
    return next(new AppError('输入设想不能为空', 400));
  }

  const userId = req.userId as string;

  try {
    const hasPermission = await checkTeamProjectPermission(userId, req.workspaceId);
    if (!hasPermission) {
      return next(new AppError('只有团队创建人或管理员才能在团队中生成项目规划', 403));
    }

    if (hasPromptInjection(prompt)) {
      return next(new AppError('检测到潜在的安全威胁或非法指令注入。', 400));
    }

    const generatedMarkdown = await callLLM(prompt.trim(), PROJECT_GENERATION_PROMPT);

    res.json({
      success: true,
      data: generatedMarkdown,
    });
  } catch (error) {
    next(error);
  }
};

export const aiChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { messages, context, modelId } = req.body;
  const normalizedMessages = normalizeAiChatMessages(messages);

  if (normalizedMessages.length === 0) {
    return next(new AppError('对话内容不能为空', 400));
  }

  const lastMessage = normalizedMessages[normalizedMessages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    return next(new AppError('最后一条对话内容必须来自用户', 400));
  }

  for (const m of normalizedMessages) {
    const tokenCount = Math.round((m.content?.length || 0) * 0.45);
    if (m.role === 'user' && tokenCount > 5400) {
      return next(new AppError('单个消息长度过长，请精简后再发送。', 400));
    }
    if (m.role === 'user' && hasPromptInjection(m.content)) {
      return next(new AppError('检测到潜在的安全威胁或非法指令注入。', 400));
    }
  }

  const totalChars = normalizedMessages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars > MAX_AI_CHAT_TOTAL_CHARS) {
    return next(new AppError('对话上下文过长，请清空历史或精简后再发送。', 400));
  }

  const contextPrompt = buildAiChatContextPrompt(context, req);
  const systemPrompt = contextPrompt
    ? `${AI_SPRITE_CHAT_PROMPT}\n\n${contextPrompt}`
    : AI_SPRITE_CHAT_PROMPT;

  const settings = await settingsService.getAll();
  const selectedModel = getAIModelById(
    settings,
    typeof modelId === 'string' ? modelId.trim() : undefined,
  );
  if (!selectedModel || !selectedModel.enabled) {
    return next(new AppError('当前没有可用的 AI 聊天模型，请联系管理员配置。', 503));
  }

  if (req.userId) {
    try {
      await prisma.aiMessage.create({
        data: {
          userId: req.userId,
          role: 'user',
          content: redactSensitiveContent(lastMessage.content),
        },
      });
    } catch (dbErr) {
      console.error('[AI Chat] Failed to save user message to DB:', dbErr);
    }
  }

  try {
    await streamLLMChat(
      normalizedMessages,
      systemPrompt,
      res,
      {
        AI_IMPORT_ENABLED: true,
        AI_PROVIDER: selectedModel.provider,
        AI_API_KEY: selectedModel.apiKey || settings.AI_API_KEY,
        AI_API_ENDPOINT: selectedModel.endpoint || settings.AI_API_ENDPOINT,
        AI_MODEL_NAME: selectedModel.modelName,
      },
      req.userId,
    );
  } catch (error) {
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.end();
      }
    } else {
      next(error);
    }
  }
};

export const getAiChatHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  try {
    const history = await prisma.aiMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_AI_HISTORY_ITEMS,
    });
    const orderedHistory = history.reverse();
    res.json({
      success: true,
      data: orderedHistory.map((h) => ({
        role: h.role,
        content: h.content,
        createdAt: h.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const clearAiChatHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  try {
    await prisma.aiMessage.deleteMany({
      where: { userId },
    });
    res.json({
      success: true,
      message: '聊天历史记录已清除',
    });
  } catch (error) {
    next(error);
  }
};

export const uploadAiChatImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next(new AppError('请选择要上传的图片', 400));
  }
  try {
    const fileUrl = `/uploads/ai/${req.file.filename}`;
    res.json({
      success: true,
      url: fileUrl,
      name: req.file.originalname,
    });
  } catch (error) {
    next(error);
  }
};

export const parseNetdiskLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { url, password } = req.body;
  if (!url) {
    return next(new AppError('链接不能为空', 400));
  }

  const userId = req.userId as string;

  try {
    const hasPermission = await checkTeamProjectPermission(userId, req.workspaceId);
    if (!hasPermission) {
      return next(new AppError('只有团队创建人或管理员才能在团队中生成项目规划', 403));
    }

    if (hasPromptInjection(url) || hasPromptInjection(password)) {
      return next(new AppError('检测到潜在的安全威胁或非法指令注入。', 400));
    }

    const urlTrimmed = url.trim();
    const isBaiduNetdiskUrl =
      /pan\.baidu\.com/i.test(urlTrimmed) &&
      (urlTrimmed.includes('/s/') || urlTrimmed.includes('surl='));
    if (!isBaiduNetdiskUrl) {
      return next(
        new AppError(
          '链接格式不正确。请输入有效的百度网盘分享链接（如 https://pan.baidu.com/s/1xxxxx 或包含 surl= 参数的链接）。',
          400,
        ),
      );
    }

    let parsedData;
    let isFallback = false;

    try {
      parsedData = await parseBaiduNetdiskLink(url, password);
    } catch (err: any) {
      console.warn(
        'Baidu Netdisk scraping failed. Falling back to LLM simulation. Reason:',
        err.message,
      );
      isFallback = true;

      const userPrompt = `链接：${url}\n密码：${password || '无'}`;
      const aiResponse = await callLLM(userPrompt, BAIDU_NETDISK_ANALYSIS_PROMPT);

      let cleanedResponse = aiResponse.trim();
      cleanedResponse = cleanedResponse
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();

      try {
        parsedData = JSON.parse(cleanedResponse);
      } catch (_parseErr) {
        console.error('Failed to parse AI fallback response as JSON. Raw response:', aiResponse);
        parsedData = {
          title: '百度网盘导入项目',
          directories: [
            {
              name: '01-基础概念与环境搭建',
              files: ['1.1 课程介绍与最终效果展示.mp4', '1.2 Vite与Three.js安装.mp4'],
            },
            {
              name: '02-三维核心要素深入',
              files: ['2.1 渲染器与场景配置.mp4', '2.2 正交与透视相机剖析.mp4'],
            },
          ],
        };
      }
    }

    res.json({
      success: true,
      data: {
        ...parsedData,
        isFallback,
      },
    });
  } catch (error) {
    next(error);
  }
};

const formatNetdiskInfoForPrompt = (netdiskInfo: any): string => {
  if (!netdiskInfo) return '无网盘资源数据';
  let result = `项目/课程名称: ${netdiskInfo.title || '未命名'}\n`;
  if (netdiskInfo.directories && Array.isArray(netdiskInfo.directories)) {
    netdiskInfo.directories.slice(0, 30).forEach((dir: any) => {
      result += `- 目录: ${dir.name || '未命名'}\n`;
      if (dir.files && Array.isArray(dir.files)) {
        dir.files.slice(0, 80).forEach((file: string) => {
          result += `  * ${file}\n`;
        });
      }
    });
  }
  return result.slice(0, 30000);
};

export const coPlanChatStream = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { messages, netdiskInfo, currentPlan } = req.body;
  const normalizedMessages = normalizeAiChatMessages(messages);

  if (normalizedMessages.length === 0) {
    return next(new AppError('对话内容不能为空', 400));
  }

  if (Array.isArray(messages) && messages.length > 20) {
    return next(new AppError('对话历史记录过长，请重置对话重新开始。', 400));
  }

  for (const m of normalizedMessages) {
    const tokenCount = Math.round((m.content?.length || 0) * 0.45);
    if (m.role === 'user' && tokenCount > 2000) {
      return next(new AppError('单个消息长度不能超过 2000 tokens。', 400));
    }
    if (m.role === 'user' && hasPromptInjection(m.content)) {
      return next(new AppError('检测到潜在的安全威胁或非法指令注入。', 400));
    }
  }

  const userId = req.userId as string;

  try {
    const hasPermission = await checkTeamProjectPermission(userId, req.workspaceId);
    if (!hasPermission) {
      return next(new AppError('只有团队创建人或管理员才能在团队中生成项目规划', 403));
    }

    const isNetdisk = !!netdiskInfo;
    const netdiskText = formatNetdiskInfoForPrompt(netdiskInfo);
    const systemPrompt = getCoPlanChatPrompt(isNetdisk);

    const contextContent = isNetdisk
      ? `【百度网盘资源文件大纲】\n${netdiskText}\n\n【当前待修改的项目学习计划 JSON】\n${JSON.stringify(currentPlan)}`
      : `【当前待修改的项目学习计划 JSON】\n${JSON.stringify(currentPlan)}`;
    const extendedMessages: ServiceAIChatMessage[] = [
      { role: 'user', content: contextContent.slice(0, 32000) },
      ...normalizedMessages,
    ];

    await streamLLMChat(extendedMessages, systemPrompt, res);
  } catch (error) {
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.end();
      }
    } else {
      next(error);
    }
  }
};

export const importProjectFromJson = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  let { plan } = req.body;
  const userId = req.userId as string;

  if (plan && !plan.title) {
    if (plan.plan && plan.plan.title) {
      plan = plan.plan;
    } else if (plan.project && plan.project.title) {
      plan = plan.project;
    }
  }

  if (!plan || !plan.title) {
    return next(new AppError('项目规划数据无效或缺失标题', 400));
  }

  try {
    const hasPermission = await checkTeamProjectPermission(userId, req.workspaceId);
    if (!hasPermission) {
      return next(new AppError('只有团队创建人或管理员才能在团队中导入项目', 403));
    }

    const quota = await checkProjectQuota(userId);
    if (!quota.allowed) {
      return next(new AppError(quota.message || '项目配额已满，无法导入新项目', 403));
    }

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          title: plan.title,
          description: plan.description || null,
          dueDate: plan.dueDate ? new Date(plan.dueDate) : null,
          color: plan.color || 'bg-accent',
          tags: plan.tags || null,
          visibility: 'PRIVATE',
          maxMembers: 10,
          teamId: req.workspaceId || null,
          members: {
            create: [
              {
                userId,
                role: 'OWNER',
              },
            ],
          },
        },
      });

      const createdTasks = [];
      if (plan.tasks && Array.isArray(plan.tasks)) {
        for (const t of plan.tasks) {
          const task = await tx.task.create({
            data: {
              title: t.title,
              description: t.description || null,
              status: 'TODO',
              priority: t.priority || 'MEDIUM',
              dueDate: t.dueDate ? new Date(t.dueDate) : null,
              projectId: project.id,
              userId,
              teamId: req.workspaceId || null,
              subtasks: t.subtasks && Array.isArray(t.subtasks) ? JSON.stringify(t.subtasks) : null,
            },
          });
          createdTasks.push(task);
        }
      }

      let roadmap = null;
      if (
        plan.roadmap &&
        plan.roadmap.steps &&
        Array.isArray(plan.roadmap.steps) &&
        plan.roadmap.steps.length > 0
      ) {
        const defaultTitles = ['学习路线', '学习规划', '学习大纲', 'Roadmap', 'ROADMAP'];
        const isGenericTitle =
          !plan.roadmap.title || defaultTitles.includes(plan.roadmap.title.trim());
        const roadmapTitle = isGenericTitle ? `学习路线 - ${plan.title}` : plan.roadmap.title;
        const roadmapDesc = plan.roadmap.description || `针对项目「${plan.title}」的专属学习路线`;

        roadmap = await tx.roadmap.create({
          data: {
            title: roadmapTitle,
            description: roadmapDesc,
            creatorId: userId,
            projectId: project.id,
          },
        });

        for (const step of plan.roadmap.steps) {
          await tx.roadmapStep.create({
            data: {
              roadmapId: roadmap.id,
              title: step.title,
              description: step.description || '',
              subtasks:
                step.subtasks && Array.isArray(step.subtasks)
                  ? JSON.stringify(step.subtasks)
                  : null,
              order: step.order,
            },
          });
        }
      }

      return { project, tasksCount: createdTasks.length, roadmap };
    });

    await auditService.log({
      userId,
      action: AuditAction.CREATE_PROJECT,
      module: AuditModule.PROJECT,
      description: `导入解析项目JSON: ${result.project.title} (包含看板任务数: ${result.tasksCount})`,
      newValue: result.project,
      req,
    });

    res.status(201).json({
      success: true,
      message: '项目及关联的看板任务、学习路线已成功解析导入！',
      project: result.project,
      roadmap: result.roadmap,
      tasksCount: result.tasksCount,
    });
  } catch (error) {
    next(error);
  }
};

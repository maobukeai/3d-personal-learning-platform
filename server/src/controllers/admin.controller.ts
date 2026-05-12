import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToUser, emitToAll } from '../services/socket.service';
import { parseBilibiliUrl } from '../utils/bilibili';
import { parseYoutubeUrl } from '../utils/youtube';
import { createNotification, createNotificationBatch } from '../utils/notification';
import { parseGithubUrl } from '../utils/github';

export const parseExternalLink = async (req: AuthRequest, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    let metadata;
    if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      metadata = await parseBilibiliUrl(url);
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      metadata = await parseYoutubeUrl(url);
    } else if (url.includes('github.com')) {
      metadata = await parseGithubUrl(url);
    } else {
      return res.status(400).json({ error: '不支持的平台，目前仅支持 B站、YouTube 和 GitHub。' });
    }
    res.json(metadata);
  } catch (error: any) {
    console.error('Parse link error:', error);
    res.status(400).json({ error: error.message || '解析链接失败' });
  }
};

export const createCourseWithLessons = async (req: AuthRequest, res: Response) => {
  const { title, description, thumbnail, lessons } = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: { title, description, thumbnail, categoryId: req.body.categoryId }
      });

      if (lessons && Array.isArray(lessons)) {
        await Promise.all(
          lessons.map((lesson: any) =>
            tx.lesson.create({
              data: {
                title: lesson.title,
                videoUrl: lesson.videoUrl,
                order: lesson.order,
                courseId: course.id,
                content: lesson.content || ''
              }
            })
          )
        );
      }

      return await tx.course.findUnique({
        where: { id: course.id },
        include: { lessons: { orderBy: { order: 'asc' } } }
      });
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Batch create course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAdminStats = async (req: AuthRequest, res: Response) => {
  try {
    const [
      userCount,
      assetCount,
      courseCount,
      enrollmentCount,
      feedbackCount,
      discussionCount,
      pendingAssets,
      openFeedbacks,
      materialCount,
      showcaseCount,
      teamCount,
      pendingMaterials,
      pendingShowcases
    ] = await Promise.all([
      prisma.user.count(),
      prisma.asset.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
      prisma.feedback.count(),
      prisma.discussion.count(),
      prisma.asset.count({ where: { status: 'PENDING' } }),
      prisma.feedback.count({ where: { status: 'OPEN' } }),
      prisma.material.count(),
      prisma.showcase.count(),
      prisma.team.count(),
      prisma.material.count({ where: { status: 'PENDING' } }),
      prisma.showcase.count({ where: { status: 'PENDING' } })
    ]);

    // Get recent activity (last 5 users, last 5 assets)
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, createdAt: true, avatarUrl: true }
    });

    const recentAssets = await prisma.asset.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } }
    });

    res.json({
      counts: {
        users: userCount,
        assets: assetCount,
        courses: courseCount,
        enrollments: enrollmentCount,
        feedbacks: feedbackCount,
        discussions: discussionCount,
        pendingAssets,
        openFeedbacks,
        materials: materialCount,
        showcases: showcaseCount,
        teams: teamCount,
        pendingMaterials,
        pendingShowcases
      },
      recentUsers,
      recentAssets
    });
  } catch (error) {
    console.error('Get Admin Stats Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body; // Expecting [{key, value}, ...]
    console.log('[Admin Settings] Updating settings:', settings);
    
    const updates = settings.map((s: { key: string, value: string }) => 
      prisma.systemSetting.upsert({
        where: { key: s.key },
        update: { value: s.value },
        create: { key: s.key, value: s.value }
      })
    );

    await Promise.all(updates);
    res.json({ message: '设置已成功保存' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const testSmtp = async (req: AuthRequest, res: Response) => {
  try {
    const { host, port, user, pass, from, secure } = req.body;
    
    if (!host || !user || !pass) {
      return res.status(400).json({ error: 'SMTP 配置不完整' });
    }

    const isSecure = secure === true || secure === 'true';
    const portNum = parseInt(port) || 465;

    console.log(`[SMTP Test] Attempting connection: ${host}:${portNum}, secure: ${isSecure}`);

    const transporter = nodemailer.createTransport({
      host,
      port: portNum,
      secure: isSecure,
      auth: {
        user,
        pass,
      },
      tls: {
        // Essential for security, should be true
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      },
      // Essential for Gmail to prevent early connection drops
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
    });

    // Detailed verification
    await transporter.verify().catch(err => {
      console.error('[SMTP Verify Error]:', err);
      throw err;
    });

    const admin = req.user;
    
    await transporter.sendMail({
      from: from || user,
      to: admin?.email || user,
      subject: 'SMTP 测试邮件',
      text: '如果您收到这封邮件，说明您的 SMTP 配置已成功！',
      html: `<h3>SMTP 配置测试成功</h3><p>如果您收到这封邮件，说明您的 SMTP 配置已成功！</p><p>测试时间: ${new Date().toLocaleString()}</p>`,
    });

    res.json({ message: 'SMTP 连接测试成功，已向您的邮箱发送测试邮件' });
  } catch (error: any) {
    console.error('SMTP Test Error Detail:', error);
    let errorMsg = error.message;
    
    // Detailed error mapping
    if (error.code === 'ECONNRESET') errorMsg = '连接被重置。通常是因为网络防火墙拦截或 SSL/TLS 协议不匹配。';
    else if (error.code === 'ETIMEDOUT') errorMsg = '连接超时。请检查 465/587 端口是否在云服务器安全组中开放。';
    else if (error.code === 'ECONNREFUSED') errorMsg = '连接被拒绝。目标服务器可能不可达，或端口被本地 ISP 封锁。';
    else if (error.code === 'EAUTH') errorMsg = '验证失败。请确保您使用的是 Gmail 的 16 位“应用专用密码”而非主密码。';
    else if (error.message.includes('secure TLS connection')) errorMsg = 'TLS 握手失败。请尝试切换 465 (勾选 SSL) 或 587 (取消勾选 SSL)。';

    res.status(500).json({ error: `SMTP 连接失败: ${errorMsg}` });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, email, role, status } = req.body;

  try {
    // Prevent self-demotion or self-banning if you are an admin
    if (id === req.userId && (role !== 'ADMIN' || status === 'BANNED')) {
      return res.status(400).json({ error: '不能修改自己的管理员权限或封禁自己' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { name, email, role, status },
      select: { id: true, email: true, name: true, role: true, status: true }
    });
    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: '密码长度至少为 6 位' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });
    res.json({ message: '用户密码已成功重置' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { role } = req.body;

  const validRoles = ['USER', 'ADMIN', 'INSTRUCTOR'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role value' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true }
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    // Prevent self-deletion
    if (id === req.userId) {
      return res.status(400).json({ error: '不能删除自己的账户' });
    }

    // Check if user exists
    const userToDelete = await prisma.user.findUnique({ where: { id } });
    if (!userToDelete) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // Prevent deleting the last admin
    if (userToDelete.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: '不能删除最后一个管理员账户' });
      }
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getAllFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(feedbacks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateFeedbackStatus = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { status, adminReply } = req.body;

  const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const updateData: any = {};
    if (status) updateData.status = status;
    if (adminReply !== undefined) {
      updateData.adminReply = adminReply;
      updateData.repliedAt = new Date();
      updateData.adminId = req.userId;
    }

    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: updateData
    });

    // Create notification for the user
    let notificationTitle = '反馈更新';
    let notificationContent = '';

    if (status && !adminReply) {
      notificationContent = `您的反馈 "${updatedFeedback.title}" 状态已更新为: ${status}`;
    } else if (adminReply) {
      notificationContent = `管理员回复了您的反馈 "${updatedFeedback.title}"`;
    }

    if (notificationContent) {
      await createNotification({
        type: 'SYSTEM',
        title: notificationTitle,
        content: notificationContent,
        userId: updatedFeedback.userId,
        link: '/settings',
        category: 'SYSTEM'
      });
    }

    res.json(updatedFeedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteFeedback = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    // Check if feedback exists
    const feedback = await prisma.feedback.findUnique({ where: { id } });
    if (!feedback) {
      return res.status(404).json({ error: '反馈不存在' });
    }

    await prisma.feedback.delete({ where: { id } });
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Roadmap Management ---

export const getAllRoadmaps = async (req: AuthRequest, res: Response) => {
  try {
    const roadmaps = await prisma.roadmap.findMany({
      include: {
        steps: { orderBy: { order: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(roadmaps);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createRoadmap = async (req: AuthRequest, res: Response) => {
  const { title, description } = req.body;
  try {
    const roadmap = await prisma.roadmap.create({
      data: { title, description }
    });
    res.status(201).json(roadmap);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateRoadmap = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description } = req.body;
  try {
    const roadmap = await prisma.roadmap.update({
      where: { id },
      data: { title, description }
    });
    res.json(roadmap);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteRoadmap = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.roadmap.delete({ where: { id } });
    res.json({ message: 'Roadmap deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createRoadmapStep = async (req: AuthRequest, res: Response) => {
  const { roadmapId, title, description, order } = req.body;
  try {
    const step = await prisma.roadmapStep.create({
      data: { roadmapId, title, description, order: parseInt(order) }
    });
    res.status(201).json(step);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateRoadmapStep = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, order } = req.body;
  try {
    const updateData: any = { title, description };
    if (order !== undefined) updateData.order = parseInt(order);

    const step = await prisma.roadmapStep.update({
      where: { id },
      data: updateData
    });
    res.json(step);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteRoadmapStep = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.roadmapStep.delete({ where: { id } });
    res.json({ message: 'Roadmap step deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Course Category Management ---

export const getAllCourseCategories = async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.courseCategory.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCourseCategory = async (req: AuthRequest, res: Response) => {
  const { name, order } = req.body;
  try {
    const category = await prisma.courseCategory.create({
      data: { name, order: order ? parseInt(order) : 0 }
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCourseCategory = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, order } = req.body;
  try {
    const category = await prisma.courseCategory.update({
      where: { id },
      data: { name, order: order !== undefined ? parseInt(order) : undefined }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCourseCategory = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.courseCategory.delete({ where: { id } });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Course Management ---

export const getAllCourses = async (req: AuthRequest, res: Response) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        lessons: { orderBy: { order: 'asc' } },
        category: true,
        _count: { select: { enrollments: true, reviews: true } },
        reviews: { select: { rating: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    const coursesWithStats = courses.map(course => {
      const { reviews, ...rest } = course;
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
        : 0;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10 };
    });
    res.json(coursesWithStats);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCourse = async (req: AuthRequest, res: Response) => {
  const { title, description, thumbnail, categoryId, difficulty, status } = req.body;
  try {
    const course = await prisma.course.create({
      data: { title, description, thumbnail, categoryId: categoryId || null, difficulty: difficulty || 'BEGINNER', status: status || 'PUBLISHED' }
    });
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCourse = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, thumbnail, categoryId, difficulty, status } = req.body;
  try {
    const course = await prisma.course.update({
      where: { id },
      data: { title, description, thumbnail, categoryId: categoryId || null, difficulty, status }
    });
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCourse = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.course.delete({ where: { id } });
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createLesson = async (req: AuthRequest, res: Response) => {
  const { courseId, title, content, videoUrl, order, duration } = req.body;
  try {
    const lesson = await prisma.lesson.create({
      data: { courseId, title, content, videoUrl, order: parseInt(order), duration: duration ? parseInt(duration) : 0 }
    });
    res.status(201).json(lesson);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateLesson = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, content, videoUrl, order, duration } = req.body;
  try {
    const updateData: any = { title, content, videoUrl };
    if (order !== undefined) updateData.order = parseInt(order);
    if (duration !== undefined) updateData.duration = parseInt(duration);

    const lesson = await prisma.lesson.update({
      where: { id },
      data: updateData
    });
    res.json(lesson);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteLesson = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.lesson.delete({ where: { id } });
    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Team Management ---

export const getAllTeams = async (req: AuthRequest, res: Response) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'asc' }
        },
        _count: { select: { members: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTeam = async (req: AuthRequest, res: Response) => {
  const { name, description, avatarUrl, ownerId } = req.body;
  const creatorId = ownerId || req.userId;

  if (!name) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  try {
    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          name,
          description,
          avatarUrl,
          ownerId: creatorId,
          type: 'TEAM'
        }
      });

      await tx.teamMember.create({
        data: {
          teamId: newTeam.id,
          userId: creatorId,
          role: 'OWNER'
        }
      });

      return newTeam;
    });

    res.status(201).json(team);
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTeam = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, description, avatarUrl, ownerId } = req.body;

  try {
    const team = await prisma.$transaction(async (tx) => {
      const oldTeam = await tx.team.findUnique({ where: { id } });
      if (!oldTeam) throw new Error('Team not found');

      const updatedTeam = await tx.team.update({
        where: { id },
        data: { name, description, avatarUrl, ownerId }
      });

      if (ownerId && ownerId !== oldTeam.ownerId) {
        // Remove old owner as owner in members
        await tx.teamMember.updateMany({
          where: { teamId: id, role: 'OWNER' },
          data: { role: 'MEMBER' }
        });

        // Add or update new owner
        const existingMember = await tx.teamMember.findUnique({
          where: { teamId_userId: { teamId: id, userId: ownerId } }
        });

        if (existingMember) {
          await tx.teamMember.update({
            where: { id: existingMember.id },
            data: { role: 'OWNER' }
          });
        } else {
          await tx.teamMember.create({
            data: { teamId: id, userId: ownerId, role: 'OWNER' }
          });
        }
      }

      return updatedTeam;
    });

    res.json(team);
  } catch (error: any) {
    console.error('Update team error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.team.delete({ where: { id } });
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTeamMemberRole = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  const userId = req.params.userId as string;
  const { role } = req.body;

  if (!['ADMIN', 'MEMBER'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } }
    });

    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.role === 'OWNER') return res.status(400).json({ error: 'Cannot change owner role' });

    const updated = await prisma.teamMember.update({
      where: { id: member.id },
      data: { role }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeTeamMember = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  const userId = req.params.userId as string;
  try {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } }
    });

    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.role === 'OWNER') return res.status(400).json({ error: 'Cannot remove owner' });

    await prisma.teamMember.delete({ where: { id: member.id } });
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Audit Management ---

export const getAllMaterialsForAdmin = async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  try {
    const materials = await prisma.material.findMany({
      where: status ? { status: status as string } : {},
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMaterialStatus = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { status, rejectReason } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const updateData: any = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const material = await prisma.material.update({
      where: { id },
      data: updateData
    });

    await createNotification({
      type: 'SYSTEM',
      title: status === 'APPROVED' ? '材料审核通过' : '材料审核未通过',
      content: status === 'REJECTED' && rejectReason
        ? `你上传的材料 "${material.title}" 未通过审核，原因：${rejectReason}`
        : `你上传的材料 "${material.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
      userId: material.userId,
      link: '/materials',
      category: 'SYSTEM'
    });

    res.json(material);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const batchUpdateMaterialStatus = async (req: AuthRequest, res: Response) => {
  const { ids, status, rejectReason } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择至少一个材料' });
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const updateData: any = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const result = await prisma.material.updateMany({
      where: { id: { in: ids } },
      data: updateData
    });

    const materials = await prisma.material.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, userId: true }
    });

    await createNotificationBatch(materials.map(material => ({
      type: 'SYSTEM',
      title: status === 'APPROVED' ? '材料审核通过' : '材料审核未通过',
      content: status === 'REJECTED' && rejectReason
        ? `你上传的材料 "${material.title}" 未通过审核，原因：${rejectReason}`
        : `你上传的材料 "${material.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
      userId: material.userId,
      link: '/materials',
      category: 'SYSTEM'
    })));

    res.json({ message: `成功更新 ${result.count} 个材料状态`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminUpdateMaterial = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, category, tags, status } = req.body;
  try {
    const material = await prisma.material.update({
      where: { id },
      data: { title, description, category, tags, status }
    });
    res.json(material);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminDeleteMaterial = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const material = await prisma.material.findUnique({ where: { id } });
    if (!material) return res.status(404).json({ error: 'Material not found' });

    // Delete files
    const deleteFile = (url: string) => {
      const fileName = url.split('/').pop();
      if (fileName) {
        const filePath = path.join(__dirname, '../../uploads/materials', fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    };

    deleteFile(material.fileUrl);
    if (material.previewUrl) deleteFile(material.previewUrl);

    await prisma.material.delete({ where: { id } });
    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllShowcasesForAdmin = async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  try {
    const showcases = await prisma.showcase.findMany({
      where: status ? { status: status as string } : {},
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(showcases);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateShowcaseStatus = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body; // 'APPROVED', 'REJECTED'

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const showcase = await prisma.showcase.update({
      where: { id },
      data: { status }
    });

    await createNotification({
      type: 'SYSTEM',
      title: status === 'APPROVED' ? '作品审核通过' : '作品审核未通过',
      content: `你发布的作品 "${showcase.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
      userId: showcase.userId,
      link: '/showcase',
      category: 'SYSTEM'
    });

    res.json(showcase);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminDeleteShowcase = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const showcase = await prisma.showcase.findUnique({ where: { id } });
    if (!showcase) {
      return res.status(404).json({ error: 'Showcase not found' });
    }

    await prisma.showcase.delete({ where: { id } });
    res.json({ message: 'Showcase deleted successfully' });
  } catch (error) {
    console.error('Admin delete showcase error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBroadcasts = async (req: AuthRequest, res: Response) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteBroadcast = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.broadcast.delete({
      where: { id }
    });
    res.json({ message: '广播已成功撤回' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendBroadcast = async (req: AuthRequest, res: Response) => {
  const { title, content, link } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: '标题和内容不能为空' });
  }

  try {
    const broadcast = await prisma.broadcast.create({
      data: { title, content, link }
    });

    const users = await prisma.user.findMany({
      select: { id: true }
    });

    await createNotificationBatch(users.map(user => ({
      type: 'SYSTEM',
      title,
      content,
      link,
      userId: user.id,
      broadcastId: broadcast.id,
      category: 'SYSTEM'
    })));

    emitToAll('new_notification', {
      type: 'SYSTEM',
      title,
      content,
      link,
      createdAt: new Date(),
      broadcastId: broadcast.id
    });
    
    res.json({ message: `广播发送成功，共发送给 ${users.length} 名用户` });
  } catch (error) {
    console.error('Send Broadcast Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllSubscriptionPlans = async (req: AuthRequest, res: Response) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priority: 'asc' },
      include: { _count: { select: { subscriptions: true } } }
    });
    res.json(plans.map(p => ({
      ...p,
      features: JSON.parse(p.features || '[]'),
      subscriberCount: p._count.subscriptions
    })));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSubscriptionPlan = async (req: AuthRequest, res: Response) => {
  const { name, displayName, price, yearlyPrice, interval, features, maxStorage, maxTeams, maxProjects, maxAssets, priority, isPopular, badgeColor } = req.body;
  try {
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        displayName,
        price: parseFloat(price),
        yearlyPrice: yearlyPrice ? parseFloat(yearlyPrice) : null,
        interval: interval || 'MONTHLY',
        features: JSON.stringify(features || []),
        maxStorage: parseFloat(maxStorage) || 1,
        maxTeams: parseInt(maxTeams) || 1,
        maxProjects: parseInt(maxProjects) || 5,
        maxAssets: parseInt(maxAssets) || 50,
        priority: parseInt(priority) || 0,
        isPopular: isPopular || false,
        badgeColor: badgeColor || null,
      }
    });
    res.status(201).json({ ...plan, features: JSON.parse(plan.features || '[]') });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ error: '计划名称已存在' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSubscriptionPlan = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, displayName, price, yearlyPrice, interval, features, maxStorage, maxTeams, maxProjects, maxAssets, priority, isPopular, badgeColor } = req.body;
  try {
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (yearlyPrice !== undefined) updateData.yearlyPrice = yearlyPrice ? parseFloat(yearlyPrice) : null;
    if (interval !== undefined) updateData.interval = interval;
    if (features !== undefined) updateData.features = JSON.stringify(features);
    if (maxStorage !== undefined) updateData.maxStorage = parseFloat(maxStorage);
    if (maxTeams !== undefined) updateData.maxTeams = parseInt(maxTeams);
    if (maxProjects !== undefined) updateData.maxProjects = parseInt(maxProjects);
    if (maxAssets !== undefined) updateData.maxAssets = parseInt(maxAssets);
    if (priority !== undefined) updateData.priority = parseInt(priority);
    if (isPopular !== undefined) updateData.isPopular = isPopular;
    if (badgeColor !== undefined) updateData.badgeColor = badgeColor;

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: updateData
    });
    res.json({ ...plan, features: JSON.parse(plan.features || '[]') });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSubscriptionPlan = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const subscriberCount = await prisma.subscription.count({
      where: { planId: id, status: 'ACTIVE' }
    });
    if (subscriberCount > 0) {
      return res.status(400).json({ error: `该计划仍有 ${subscriberCount} 名活跃订阅者，无法删除` });
    }
    await prisma.subscriptionPlan.delete({ where: { id } });
    res.json({ message: '订阅计划已删除' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllSubscriptions = async (req: AuthRequest, res: Response) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        plan: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSubscription = async (req: AuthRequest, res: Response) => {
  const { userId, planId, status, interval, startDate, endDate, autoRenew, cancelAtPeriodEnd, paymentMethod } = req.body;

  if (!userId || !planId) {
    return res.status(400).json({ error: '用户ID和计划ID为必填项' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ error: '订阅计划不存在' });

    const existingSub = await prisma.subscription.findUnique({ where: { userId } });
    if (existingSub) return res.status(400).json({ error: '该用户已有订阅，请使用编辑功能修改' });

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: status || 'ACTIVE',
        interval: interval || 'MONTHLY',
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        autoRenew: autoRenew !== undefined ? autoRenew : true,
        cancelAtPeriodEnd: cancelAtPeriodEnd || false,
        paymentMethod: paymentMethod || 'ADMIN_ASSIGN',
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        plan: true
      }
    });

    res.status(201).json(subscription);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ error: '该用户已有订阅' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSubscription = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { planId, status, interval, startDate, endDate, autoRenew, cancelAtPeriodEnd, paymentMethod } = req.body;

  try {
    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '订阅不存在' });

    const updateData: any = {};
    if (planId !== undefined) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) return res.status(404).json({ error: '订阅计划不存在' });
      updateData.planId = planId;
    }
    if (status !== undefined) updateData.status = status;
    if (interval !== undefined) updateData.interval = interval;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (autoRenew !== undefined) updateData.autoRenew = autoRenew;
    if (cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = cancelAtPeriodEnd;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;

    const subscription = await prisma.subscription.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        plan: true
      }
    });

    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSubscription = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '订阅不存在' });

    await prisma.subscription.delete({ where: { id } });
    res.json({ message: '订阅已删除' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

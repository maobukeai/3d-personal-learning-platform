import { Response } from 'express';
import nodemailer from 'nodemailer';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToUser, emitToAll } from '../services/socket.service';

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
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
  const { status } = req.body;

  const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: { status }
    });
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

// --- Course Management ---

export const getAllCourses = async (req: AuthRequest, res: Response) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        lessons: { orderBy: { order: 'asc' } },
        _count: { select: { enrollments: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCourse = async (req: AuthRequest, res: Response) => {
  const { title, description, thumbnail } = req.body;
  try {
    const course = await prisma.course.create({
      data: { title, description, thumbnail }
    });
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCourse = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, thumbnail } = req.body;
  try {
    const course = await prisma.course.update({
      where: { id },
      data: { title, description, thumbnail }
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
  const { courseId, title, content, videoUrl, order } = req.body;
  try {
    const lesson = await prisma.lesson.create({
      data: { courseId, title, content, videoUrl, order: parseInt(order) }
    });
    res.status(201).json(lesson);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateLesson = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, content, videoUrl, order } = req.body;
  try {
    const updateData: any = { title, content, videoUrl };
    if (order !== undefined) updateData.order = parseInt(order);

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
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } }
          }
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
  const { status } = req.body; // 'APPROVED', 'REJECTED'

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const material = await prisma.material.update({
      where: { id },
      data: { status }
    });

    const notification = await prisma.notification.create({
      data: {
        type: 'SYSTEM',
        title: status === 'APPROVED' ? '材料审核通过' : '材料审核未通过',
        content: `你上传的材料 "${material.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
        userId: material.userId,
        link: '/materials'
      }
    });
    emitToUser(material.userId, 'new_notification', notification);

    res.json(material);
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

    const notification = await prisma.notification.create({
      data: {
        type: 'SYSTEM',
        title: status === 'APPROVED' ? '作品审核通过' : '作品审核未通过',
        content: `你发布的作品 "${showcase.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
        userId: showcase.userId,
        link: '/showcase'
      }
    });
    emitToUser(showcase.userId, 'new_notification', notification);

    res.json(showcase);
  } catch (error) {
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
    // 1. Create the broadcast record
    const broadcast = await prisma.broadcast.create({
      data: { title, content, link }
    });

    const users = await prisma.user.findMany({
      select: { id: true }
    });

    const notifications = users.map(user => ({
      type: 'SYSTEM',
      title,
      content,
      link,
      userId: user.id,
      broadcastId: broadcast.id
    }));

    // 2. Create individual notifications linked to the broadcast
    await prisma.notification.createMany({
      data: notifications
    });

    // Notify all online users via socket
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

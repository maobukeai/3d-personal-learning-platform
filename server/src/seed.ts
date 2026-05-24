import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Admin User
  const adminSeedPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin_Secure_2026!';
  const hashedPassword = await bcrypt.hash(adminSeedPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: '系统管理员',
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  console.log('Created Admin User:', admin.email);

  // 2. Create Regular User
  const userSeedPassword = process.env.USER_INITIAL_PASSWORD || 'User_Secure_2026!';
  const userPassword = await bcrypt.hash(userSeedPassword, 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      password: userPassword,
      name: '学习者小张',
      role: 'USER',
      emailVerified: true,
    },
  });
  console.log('Created Regular User:', user.email);

  // 3. Create Courses
  const course1 = await prisma.course.create({
    data: {
      title: 'Blender 4.0 核心基础训练营',
      description: '从零开始掌握 3D 建模、材质与渲染的全流程。',
      thumbnail:
        'https://images.unsplash.com/photo-1615147342761-9238e15d8b96?w=800&auto=format&fit=crop&q=60',
      lessons: {
        create: [
          {
            title: 'Blender 界面与基础操作',
            order: 1,
            content: '学习 Blender 的核心界面布局与视图操作。',
          },
          {
            title: '初探 3D 空间：小黄鸭建模',
            order: 2,
            content: '利用基础几何体构建一个小黄鸭。',
            videoUrl:
              'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
          },
          {
            title: 'PBR 材质基础',
            order: 3,
            content: '理解基于物理的渲染流。',
            videoUrl:
              'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
          },
        ],
      },
    },
  });

  const course2 = await prisma.course.create({
    data: {
      title: 'Three.js 交互式 Web 3D 开发',
      description: '学习如何在浏览器中渲染高质量的 3D 场景并进行交互。',
      thumbnail:
        'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=60',
      lessons: {
        create: [
          { title: 'Three.js 环境搭建', order: 1, content: 'Scene, Camera, Renderer 的基本概念。' },
          { title: '几何体与材质', order: 2, content: '学习 BufferGeometry 与 ShaderMaterial。' },
        ],
      },
    },
  });
  console.log('Created Courses:', course1.title, course2.title);

  // 4. Create Roadmaps
  const roadmap1 = await prisma.roadmap.create({
    data: {
      title: '3D 建模师成长之路',
      description: '从入门建模到高级渲染的完整学习路径。',
      steps: {
        create: [
          { title: '基础几何体建模', description: '掌握挤出、细分等基础技巧。', order: 1 },
          { title: 'UV 拆解与贴图绘制', description: '为模型穿上精美的外衣。', order: 2 },
          { title: '光影渲染实战', description: '使用 Cycles 渲染高质量视觉稿。', order: 3 },
        ],
      },
    },
  });
  console.log('Created Roadmap:', roadmap1.title);

  // 5. Create Assets
  await prisma.asset.create({
    data: {
      title: '精细化小黄鸭模型',
      description: '来自 Khronos 官方的 GLB 演示模型。',
      url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
      type: 'GLB',
      status: 'APPROVED',
      userId: admin.id,
      vertices: 3500,
      faces: 2800,
      size: 0.5,
    },
  });

  await prisma.asset.create({
    data: {
      title: '受损的太空头盔 (PBR)',
      description: '经典的 PBR 材质演示模型。',
      url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
      type: 'GLB',
      status: 'APPROVED',
      userId: admin.id,
      vertices: 15000,
      faces: 12000,
      size: 3.2,
    },
  });
  console.log('Created Sample Assets.');

  // 6. Create some tasks for the user
  await prisma.task.createMany({
    data: [
      { title: '完成 Blender 第一章', status: 'TODO', userId: user.id },
      { title: '上传个人第一件作品', status: 'IN_PROGRESS', userId: user.id },
    ],
  });
  console.log('Created Sample Tasks.');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

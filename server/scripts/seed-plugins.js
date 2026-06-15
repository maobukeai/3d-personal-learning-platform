const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'USER' }
  });

  if (!user) {
    console.error('No regular user found to associate plugins with. Please seed users first.');
    return;
  }

  // Define some mock plugins
  const mockPlugins = [
    {
      title: 'Blender 自动拓扑助手 (Auto-Retopo)',
      description: '一键对高模进行智能重新拓扑，生成均匀的四边形网格，支持保留边缘硬特征。',
      category: 'Blender 插件',
      version: '1.0.5',
      compatibility: 'Blender 3.6 / 4.0 / 4.1',
      tags: 'retopo, modeling, blender, tool',
      fileUrl: '/uploads/plugins/auto_retopo_v1.zip',
      fileSize: 4.2,
      previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
      installGuide: '### 安装说明\n1. 在 Blender 偏好设置中选择插件分类。\n2. 点击安装并激活即可。',
      status: 'PENDING',
      userId: user.id,
    },
    {
      title: 'Three.js 粒子特效包 (Sparkles Particle System)',
      description: '为 Three.js 项目快速生成火焰、烟雾、下雨与魔法光点等粒子特效，支持 GPU 渲染加速。',
      category: 'Three.js 插件',
      version: '2.1.0',
      compatibility: 'Three.js r140+',
      tags: 'three.js, particles, effect, webgl',
      fileUrl: '/uploads/plugins/sparkles_particles.zip',
      fileSize: 1.8,
      previewUrl: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=500&auto=format&fit=crop&q=60',
      installGuide: '### 使用指南\n导入之后配置 Emitter 即可产生粒子：\n`const particles = new SparklesEmitter();`',
      status: 'PENDING',
      userId: user.id,
    },
    {
      title: 'Substance Painter 智能锈蚀生成器',
      description: '根据法线与曲率图实时计算边缘磨损，生成最真实的风化与氧化锈蚀效果。',
      category: 'Substance 工具',
      version: '1.4',
      compatibility: 'Substance Painter 9.x+',
      tags: 'rust, generator, substance, smart-material',
      fileUrl: '/uploads/plugins/rusted_generator.sbsar',
      fileSize: 8.5,
      previewUrl: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=500&auto=format&fit=crop&q=60',
      installGuide: '### 导入说明\n将 sbsar 拖入 Substance Shelf，选择为 Generator / Filter 即可。',
      status: 'APPROVED',
      userId: user.id,
    }
  ];

  console.log('Seeding mock plugins...');
  for (const p of mockPlugins) {
    const created = await prisma.plugin.create({ data: p });
    console.log(`Created plugin: ${created.title} (Status: ${created.status})`);
  }

  console.log('Plugin seeding completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'user@example.com' }
    });

    if (!user) {
      console.log('User user@example.com not found.');
      return;
    }

    const team = await prisma.team.findFirst({
      where: { ownerId: user.id, type: 'PERSONAL' }
    });

    if (!team) {
      console.log('Personal team not found for user.');
      return;
    }

    console.log(`Found user: ${user.name} (${user.id}), Personal Team: ${team.name} (${team.id})`);

    // Fetch asset categories
    const categories = await prisma.category.findMany();
    if (categories.length === 0) {
      console.log('No asset categories found. Creating default categories...');
      await prisma.category.createMany({
        data: [
          { name: '角色' },
          { name: '场景' },
          { name: '道具' },
          { name: '载具' },
          { name: '其他' }
        ]
      });
    }
    const freshCategories = await prisma.category.findMany();
    const propCategory = freshCategories.find(c => c.name === '道具') || freshCategories[0];
    const vehicleCategory = freshCategories.find(c => c.name === '载具') || freshCategories[0];

    // Check existing counts
    const assetCount = await prisma.asset.count({ where: { userId: user.id } });
    const materialCount = await prisma.material.count({ where: { userId: user.id } });
    const showcaseCount = await prisma.showcase.count({ where: { userId: user.id } });

    if (assetCount === 0) {
      console.log('Seeding assets for user...');
      await prisma.asset.createMany({
        data: [
          {
            title: '复古双镜头反光相机',
            description: '包含 4K PBR 贴图的复古相机模型，高精度网格划分，适合特写镜头渲染。',
            url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
            thumbnail: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&auto=format&fit=crop&q=60',
            type: 'GLB',
            status: 'APPROVED',
            categoryId: propCategory.id,
            userId: user.id,
            teamId: team.id,
            vertices: 45000,
            faces: 42000,
            size: 12.4,
            downloads: 15,
            likes: 8,
            viewCount: 142
          },
          {
            title: '科幻脉冲步枪概念设计',
            description: '用于游戏开发的轻量化低多边形（Low-poly）硬表面枪械模型，包含发光与金属度贴图。',
            url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
            thumbnail: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=500&auto=format&fit=crop&q=60',
            type: 'FBX',
            status: 'PENDING',
            categoryId: propCategory.id,
            userId: user.id,
            teamId: team.id,
            vertices: 18500,
            faces: 16200,
            size: 5.8,
            downloads: 0,
            likes: 0,
            viewCount: 12
          },
          {
            title: '重型穿梭机「奥德赛号」',
            description: '科幻飞船载具模型，带有完全展开的折叠机翼动画，适用于动画短片或实时场景。',
            url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
            thumbnail: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=500&auto=format&fit=crop&q=60',
            type: 'GLTF',
            status: 'APPROVED',
            categoryId: vehicleCategory.id,
            userId: user.id,
            teamId: team.id,
            vertices: 125000,
            faces: 118000,
            hasAnimations: true,
            size: 38.2,
            downloads: 42,
            likes: 29,
            viewCount: 388
          }
        ]
      });
    } else {
      console.log('User already has assets. Skipping asset seed.');
    }

    if (materialCount === 0) {
      console.log('Seeding materials for user...');
      await prisma.material.createMany({
        data: [
          {
            title: '手绘风格卡通草地材质',
            description: '无缝平铺（Seamless Tile）的手绘卡通草地材质包，包含 Diffuse, Normal, Roughness 通道。',
            category: '织物', // matching frontend categories or '其他'
            resolution: '2K',
            fileUrl: 'http://localhost:3001/uploads/materials/grass.zip',
            previewUrl: 'https://images.unsplash.com/photo-1515150144380-bca9f1650ed9?w=500&auto=format&fit=crop&q=60',
            fileSize: 4.5,
            tags: JSON.stringify(['handpainted', 'stylized', 'grass']),
            isProcedural: false,
            status: 'APPROVED',
            userId: user.id,
            teamId: team.id,
            downloads: 88
          },
          {
            title: '金属氧化与锈蚀材质（程序化）',
            description: 'Blender 格式的程序化锈蚀铁材质，通过参数可自由调节生锈比例及磨损细节。',
            category: '金属',
            resolution: 'Procedural',
            fileUrl: 'http://localhost:3001/uploads/materials/rusted_iron.blend',
            previewUrl: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=500&auto=format&fit=crop&q=60',
            fileSize: 1.2,
            tags: JSON.stringify(['rust', 'metal', 'procedural']),
            isProcedural: true,
            status: 'APPROVED',
            userId: user.id,
            teamId: team.id,
            downloads: 124
          }
        ]
      });
    } else {
      console.log('User already has materials. Skipping material seed.');
    }

    if (showcaseCount === 0) {
      console.log('Seeding showcases for user...');
      
      // Get one of the newly created assets to link
      const userAsset = await prisma.asset.findFirst({
        where: { userId: user.id, title: '复古双镜头反光相机' }
      });

      await prisma.showcase.create({
        data: {
          title: '复古双反相机日常渲染小练习',
          description: '尝试在 Cycles 渲染器中利用三点光源渲染经典相机，探索硬表面微小物体的微距质感与材质表达。',
          tags: JSON.stringify(['Render', 'Cycles', 'Retro']),
          type: 'IMAGE',
          thumbnailUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=60',
          images: JSON.stringify(['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=60']),
          views: 105,
          status: 'APPROVED',
          assetId: userAsset ? userAsset.id : null,
          userId: user.id,
          teamId: team.id
        }
      });
    } else {
      console.log('User already has showcases. Skipping showcase seed.');
    }

    // Check plugin count
    const pluginCount = await prisma.plugin.count({ where: { userId: user.id } });
    if (pluginCount === 0) {
      console.log('Seeding plugins for user...');
      await prisma.plugin.createMany({
        data: [
          {
            title: 'Blender 自动拓扑助手 (Auto-Retopo)',
            description: '一键对高模进行智能重新拓扑，生成均匀的四边形网格，支持保留边缘硬特征。',
            category: 'Blender 插件',
            version: '1.0.5',
            compatibility: 'Blender 3.6 / 4.0 / 4.1',
            tags: JSON.stringify(['retopo', 'modeling', 'blender', 'tool']),
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
            tags: JSON.stringify(['three.js', 'particles', 'effect', 'webgl']),
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
            tags: JSON.stringify(['rust', 'generator', 'substance', 'smart-material']),
            fileUrl: '/uploads/plugins/rusted_generator.sbsar',
            fileSize: 8.5,
            previewUrl: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=500&auto=format&fit=crop&q=60',
            installGuide: '### 导入说明\n将 sbsar 拖入 Substance Shelf，选择为 Generator / Filter 即可。',
            status: 'APPROVED',
            userId: user.id,
          }
        ]
      });
    } else {
      console.log('User already has plugins. Skipping plugin seed.');
    }

    console.log('User data seeding completed successfully!');
  } catch (err) {
    console.error('Error seeding user data:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

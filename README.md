# 3D Personal Learning Platform

Vue 3 + TypeScript + Vite + Three.js 前端，Express 5 + Prisma 6 + Redis + BullMQ 后端。

## 技术栈

- **前端**: Vue 3.5+, TypeScript, Vite, Pinia, Vue Router, Socket.io Client, Tailwind CSS v4, Three.js r184+
- **后端**: Express 5, Prisma 6, Redis, Cloudflare R2, BullMQ, Zod, Jest
- **进程管理**: PM2 (api / worker / queue-worker / api-fastify)

## 开发

```bash
# 安装前端依赖
npm install

# 启动前端开发服务器
npm run dev

# 安装后端依赖
cd server && npm install

# 生成 Prisma Client
cd server && npx prisma generate

# 启动后端开发服务器
cd server && npm run dev
```

### 环境变量

前端: 在项目根目录创建 `.env` 文件，参考 `.env.example`

后端: 在 `server/` 目录创建 `.env` 文件，需包含:

- `DATABASE_URL` — MySQL/PostgreSQL 连接字符串
- `JWT_SECRET` — JWT 签名密钥（缺失时抛错，无硬编码默认值）
- `REDIS_URL` — Redis 连接（BullMQ 队列、Socket.io 适配器）
- `R2_*` — Cloudflare R2 存储配置（endpoint, accessKeyId, secretAccessKey, bucketName, publicUrl）

## 部署

```bash
# 一键部署（需 root/sudo 权限）
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` 执行流程:

1. 检查 Node 环境，自动创建 swap（小内存服务器）
2. 安装前端依赖 + Vite 打包
3. 安装后端依赖 + Prisma 迁移 + TypeScript 编译
4. PM2 重启服务

部署选项:

- `SKIP_TYPECHECK=0 ./deploy.sh` — 启用 vue-tsc 类型检查（默认跳过以加速热部署）
- `NODE_BUILD_MEMORY_MB=2048 ./deploy.sh` — 调整构建内存限制
- `PM2_APP_NAME=my-app ./deploy.sh` — 自定义 PM2 应用名

### PM2 进程

```bash
pm2 start ecosystem.config.cjs   # 启动所有进程
pm2 logs                          # 查看日志
pm2 list                          # 查看状态
```

## 测试

```bash
# 前端单元测试
npx vitest run

# 后端集成测试
cd server && npx jest --config jest.config.ts
```

## 项目结构

```
├── src/                    # 前端源码
│   ├── components/         # Vue 组件（含 ModelViewer, GlassCard 等）
│   ├── stores/             # Pinia 状态管理
│   ├── utils/              # 工具函数（含 3d/ 子目录）
│   └── styles/             # 全局样式（glass.css 等）
├── server/                 # 后端源码
│   ├── src/
│   │   ├── controllers/    # Express 控制器
│   │   ├── routes/         # 路由定义（含 Zod 验证）
│   │   ├── services/       # 业务服务（BullMQ, Socket.io, Prisma 等）
│   │   ├── middlewares/    # 中间件（auth, rate-limit, zod-validation）
│   │   └── utils/          # 工具函数（schemas.ts, file.ts 等）
│   ├── prisma/             # Prisma schema 和迁移
│   └── tests/              # 集成测试
├── deploy.sh               # 部署脚本
└── ecosystem.config.cjs    # PM2 配置
```

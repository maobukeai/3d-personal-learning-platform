# 服务器部署与 MySQL 迁移完成指南

我已为你完成了所有生产环境保护和自动化部署脚本的编写。你的项目现在已经完全具备了**一键热部署**的能力，并且所有的长文本字段都已适配了 MySQL 的存储需求。

## 已完成的改造清单

### 1. 数据库兼容 (Prisma -> MySQL)
- 已将 `server/prisma/schema.prisma` 中的引擎修改为 `mysql`。
- **防止数据截断**：仔细遍历了所有 800 多行模型结构，对 `content` (文章/消息)、`description` (描述)、`images/tags/metadata` (长JSON字符串) 等可能会超过 191 字符的字段，全部加上了 `@db.Text` 注解。这避免了在线上发布长篇帖子或上传带有大量元数据的模型时引起数据库崩溃。

### 2. 自动化部署脚本 (`deploy.sh`)
- 创建了 [deploy.sh](file:///c:/Users/20269/Desktop/3d-personal-learning-platform/deploy.sh)。
- **国内网络加速**：默认启用 `https://registry.npmmirror.com` (淘宝镜像源)，安装依赖速度极快。
- **自动迁移**：自动执行 `npx prisma migrate deploy` 确保生产库表结构更新，而不会像 `dev` 那样重置数据。
- **构建联动**：同时编译前端 Vue 和 后端 Node。

### 3. PM2 进程守护守护 (`ecosystem.config.cjs`)
- 创建了 [ecosystem.config.cjs](file:///c:/Users/20269/Desktop/3d-personal-learning-platform/ecosystem.config.cjs)。
- 将后端服务设定为守护模式运行，如果发生崩溃会自动重启。
- 支持 `pm2 reload`，可以在更新代码后做到服务 **0 停机时间平滑重启**。

### 4. 生产网关配置 (`nginx.conf.example`)
- 创建了 [nginx.conf.example](file:///c:/Users/20269/Desktop/3d-personal-learning-platform/nginx.conf.example)。
- 配置了前端 Vue Router History 模式的 `try_files` (防止刷新 404)。
- 配置了正确的 WebSocket 反向代理头 (解决 Socket.io 连接失败、聊天室无法使用的常见问题)。

## 接下来你在服务器上的操作流程

1. **装环境**：在你的 Linux 服务器上安装好 Node.js (推荐 v18/v20)、PM2 (`npm i pm2 -g`)、Nginx 和 MySQL。
2. **建数据库**：在 MySQL 里新建一个空的数据库，例如命名为 `learning_platform`。
3. **改环境变量**：将代码放到服务器后，打开 `server/.env`，配置数据库连接：
   ```env
   DATABASE_URL="mysql://用户名:密码@localhost:3306/learning_platform"
   ```
4. **跑脚本**：在项目根目录，给部署脚本加上执行权限，然后运行：
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
5. **配 Nginx**：参考 `nginx.conf.example` 里面的配置，改一下里面的绝对路径，放到 Nginx 的配置目录重启即可。

以后你再更新功能，只需要把代码拉到服务器，再次执行 `./deploy.sh`，一切就会自动完成！🚀

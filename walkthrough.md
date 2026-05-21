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

## 镜像站和资源站分类大类分组与侧边栏渲染优化 (本次更新)

为了支持管理员能够将镜像站和资源站的侧边分类划分为大类（二级分类），我们在数据库、后端控制器、Pinia Store、后台管理视图以及全局侧边栏组件中进行了一体化的功能升级：

1. **数据库关系 (Prisma)**
   - 在 `ManualCategory` 表中添加了 nullable 的 `parentId` 自引用字段及外键关联，保证子分类能够归属于一个父级分类。
   - 数据库已平滑推送同步完毕。

2. **后端控制器 (Manual & Mirror)**
   - 修改了手动资源站的创建和更新 API，使其支持并能够安全存储 `parentId`。
   - 深度重构了镜像源与手动站的 `getResources` API。现在，当用户点击或过滤“父级分类”（大类）时，API 将自动检索该父级分类本身以及其下所有“子级分类”关联的全部资源。

3. **前端 Pinia 状态层**
   - 统一在 `MirrorCategory` 和 `ManualCategory` interface 中引入了父级关联字段 (`parentExternalId` 和 `parentId`)。

4. **后台配置管理面板 (Admin Views)**
   - **手动站管理** (`AdminManualView.vue`) 和 **镜像站管理** (`AdminMirrorView.vue`)：
     - 在“分类配置/分类管理”中，当新增或编辑分类时，新增了 **父级分类 (可选)** 的下拉选择框，管理员可方便地指定或清除大类归属。
     - 在管理端的所有资源检索筛选、资源所属分类选择 dropdowns 中，将分类排序算法升级为 **层级拓扑排序**：子分类将排布在父级大类正下方，并自动前缀 `　└─ ` 符号实现高颜值的多级缩进排版。
     - 分类卡片/列表中会高亮展示子分类所归属的父级大类名称。

5. **全局侧边栏分组渲染 (Sidebar Menu Grouping)**
   - 重构了 `MainLayout.vue` 中 `mirrorGroups` 与 `manualGroups` 侧边栏菜单生成逻辑：
     - 拓扑分析当前站点的分类：对于无子分类的独立大类，保持扁平列表状态合并入主菜单中；
     - 对于拥有子分类的“父级大类”，将其动态单独拆分为一个独立的 **Sidebar Menu Group**，其分组标题直接显示大类的名称。
     - 每个独立的大类分组的第一项为“全部 [大类名称]”，点击可直接访问该大类及其下所有子分类的聚合资源；后续子项则是排序后的各个子分类，点击直接访问对应的子分类资源。

## 验证与测试结果

1. **类型检查**：
   运行静态类型检查：
   ```bash
   npx vue-tsc -b
   ```
   **结果**：完全无报错，TypeScript 编译通过。

2. **生产构建**：
   运行前端打包：
   ```bash
   npm run build
   ```
   **结果**：打包流程顺利（`✓ built in 1.80s`），所有经过重构的页面组件均无 Warning 或 Error，全部成功编译并生成在 `dist/assets/` 目录中。

5. **配 Nginx**：参考 `nginx.conf.example` 里面的配置，改一下里面的绝对路径，放到 Nginx 的配置目录重启即可。

以后你再更新功能，只需要把代码拉到服务器，再次执行 `./deploy.sh`，一切就会自动完成！🚀

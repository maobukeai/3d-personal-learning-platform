# Google 与 GitHub OAuth 社交登录实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 Google 和 GitHub OAuth 2.0 登录，并允许管理员在后台动态配置 Client ID 和 Secret。

**架构：** 采用手动 OAuth 流程（非 Passport.js），以便能够实时从数据库 `SystemSetting` 中读取最新的 Client ID 和 Secret 进行认证。

**技术栈：** Node.js, Express, Prisma, Axios (后端), Vue 3, Pinia (前端)。

---

## 文件结构与职责

### 后端 (Server)
- `server/prisma/schema.prisma`: 修改 `User` 模型，增加社交 ID 字段。
- `server/src/services/oauth.service.ts`: 处理 OAuth 重定向 URL 生成、Code 换 Token、获取用户信息的核心逻辑。
- `server/src/controllers/auth.controller.ts`: 处理 OAuth 回调请求，实现用户匹配、关联和登录逻辑。
- `server/src/controllers/admin.controller.ts`: 提供管理 OAuth 设置的 API 接口。
- `server/src/routes/auth.routes.ts`: 暴露 OAuth 相关路由。
- `server/src/routes/admin.routes.ts`: 暴露管理 OAuth 设置的路由。

### 前端 (Frontend)
- `src/views/Admin/AdminSettingsView.vue`: 增加“社交登录”选项卡及配置表单。
- `src/views/Auth/LoginView.vue`: 更新登录按钮链接，动态处理登录逻辑。

---

## 任务列表

### 任务 1：数据库模型更新与依赖安装

**文件：**
- 修改：`server/prisma/schema.prisma`

- [ ] **步骤 1：修改 Prisma Schema**
在 `User` 模型中增加 `googleId` 和 `githubId`。
```prisma
model User {
  // ... 现有字段
  googleId   String? @unique
  githubId   String? @unique
}
```

- [ ] **步骤 2：生成并执行迁移**
运行：`npx prisma migrate dev --name add_oauth_ids`

- [ ] **步骤 3：安装 Axios**
在 `server` 目录运行：`npm install axios`

- [ ] **步骤 4：Commit**
```bash
git add server/prisma/schema.prisma server/package.json server/package-lock.json
git commit -m "feat(db): add oauth fields to user model and install axios"
```

### 任务 2：实现后端 OAuth 服务层

**文件：**
- 创建：`server/src/services/oauth.service.ts`

- [ ] **步骤 1：编写 OAuth 服务逻辑**
创建 `OAuthService` 类，包含获取授权地址、用 Code 换 Token 以及获取用户信息的方法。需要从 `prisma.systemSetting` 中读取配置。

- [ ] **步骤 2：Commit**
```bash
git add server/src/services/oauth.service.ts
git commit -m "feat(server): implement OAuthService for Google and GitHub"
```

### 任务 3：实现 OAuth 控制器逻辑

**文件：**
- 修改：`server/src/controllers/auth.controller.ts`
- 修改：`server/src/routes/auth.routes.ts`

- [ ] **步骤 1：实现重定向与回调 Handler**
在 `auth.controller.ts` 中添加 `googleLogin`, `googleCallback`, `githubLogin`, `githubCallback` 等方法。
实现逻辑：
1. 获取用户信息后，通过 `email` 或 `googleId`/`githubId` 查找用户。
2. 若匹配邮箱但未绑定社交 ID，则自动绑定。
3. 若是新用户，创建用户并生成 JWT。
4. 回调完成后重定向回前端，并带上临时 Token 或直接设置 Cookie。

- [ ] **步骤 2：注册路由**
在 `auth.routes.ts` 中添加相应的 GET 路由。

- [ ] **步骤 3：Commit**
```bash
git add server/src/controllers/auth.controller.ts server/src/routes/auth.routes.ts
git commit -m "feat(server): add oauth routes and controller logic"
```

### 任务 4：实现后台设置管理逻辑

**文件：**
- 修改：`server/src/controllers/admin.controller.ts` (确认是否存在，不存在则创建)
- 修改：`server/src/routes/admin.routes.ts`

- [ ] **步骤 1：添加设置管理 API**
确保管理员可以 GET/POST 包含 OAuth 相关的 `SystemSetting`。

- [ ] **步骤 2：Commit**
```bash
git add server/src/controllers/admin.controller.ts server/src/routes/admin.routes.ts
git commit -m "feat(admin): support oauth settings management"
```

### 任务 5：前端后台设置 UI 更新

**文件：**
- 修改：`src/views/Admin/AdminSettingsView.vue`

- [ ] **步骤 1：新增“社交登录”选项卡**
在 `tabs` 数组中增加项，并编写对应的配置表单（Google/GitHub 的 Enabled, Client ID, Client Secret）。

- [ ] **步骤 2：Commit**
```bash
git add src/views/Admin/AdminSettingsView.vue
git commit -m "feat(admin): add oauth settings tab to admin panel"
```

### 任务 6：前端登录页面集成

**文件：**
- 修改：`src/views/Auth/LoginView.vue`

- [ ] **步骤 1：更新登录按钮**
将 Google 和 GitHub 按钮的 `click` 事件指向后端的授权接口。例如：`window.location.href = api.defaults.baseURL + '/api/auth/google'`。

- [ ] **步骤 2：Commit**
```bash
git add src/views/Auth/LoginView.vue
git commit -m "feat(auth): integrate social login buttons on login page"
```

### 任务 7：验证与收尾

- [ ] **步骤 1：环境验证**
配置本地 Google/GitHub 开发凭据，测试全流程。
- [ ] **步骤 2：最终清理**
确保没有敏感信息泄露在日志中。

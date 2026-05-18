# 规格说明：OAuth 社交登录集成与动态后台管理

## 1. 概述
为平台增加 Google 和 GitHub 第三方社交登录功能。管理员可以通过后台管理界面动态配置 OAuth 凭据，无需修改服务器代码或重启服务。

## 2. 目标
- 支持 Google 和 GitHub 登录/注册。
- 实现“自动关联”策略：如果第三方邮箱已存在，自动绑定社交账户。
- 提供后台配置界面，允许管理员管理 Client ID 和 Client Secret。
- 新用户首次登录自动创建账户并同步资料（头像、昵称）。

## 3. 架构设计
- **后端框架**: Node.js + Express + Prisma。
- **认证处理**: 手动实现 OAuth 2.0 流程或使用 Passport.js。
- **配置存储**: 使用 `SystemSetting` 数据库表存储配置项。

## 4. 详细设计

### 4.1 数据库变更 (Prisma)
在 `User` 模型中增加以下字段：
- `googleId`: String? @unique
- `githubId`: String? @unique

### 4.2 后台配置项
在 `SystemSetting` 表中存储以下键值对：
- `OAUTH_GOOGLE_ENABLED`: "true" | "false"
- `OAUTH_GOOGLE_CLIENT_ID`: String
- `OAUTH_GOOGLE_CLIENT_SECRET`: String (存储加密或脱敏处理)
- `OAUTH_GITHUB_ENABLED`: "true" | "false"
- `OAUTH_GITHUB_CLIENT_ID`: String
- `OAUTH_GITHUB_CLIENT_SECRET`: String

### 4.3 认证流程逻辑
1. **重定向**: 用户点击按钮 -> 重定向至 `/api/auth/google` 或 `/api/auth/github`。
2. **获取 Code**: 第三方平台重定向回 `/api/auth/google/callback`。
3. **换取 Token**: 后端使用 Code + Client Secret 获取 Access Token。
4. **用户信息**: 调用第三方 API 获取用户邮箱、ID、名称和头像。
5. **匹配策略**:
    - 若 `googleId` 已匹配用户 -> 登录成功。
    - 若 `email` 已匹配用户 -> 自动填充 `googleId` 字段 -> 登录成功。
    - 若均未匹配 -> 创建新用户 -> 登录成功。

### 4.4 前端界面
- **登录页 (`LoginView.vue`)**:
  - 更新 Google/GitHub 按钮，链接至后端重定向接口。
  - 按钮应根据后台配置的开启状态动态显示（可选，初版可全显示）。
- **后台设置 (`AdminSettingsView.vue`)**:
  - 新增“社交登录”选项卡。
  - 提供表单配置上述 6 个配置项。
  - 显示各个平台所需的 `Callback URL` 提示。

## 5. 安全性
- **Secrets 保护**: 后端在返回设置列表给前端预览时，应对 `CLIENT_SECRET` 进行脱敏处理。
- **验证**: 严格验证第三方平台返回的 `state` 参数以防止 CSRF。

## 6. 测试计划
- 测试新用户通过 Google 注册。
- 测试现有邮箱用户通过 GitHub 登录（自动关联）。
- 测试管理员更改配置后，登录流程是否立即生效。

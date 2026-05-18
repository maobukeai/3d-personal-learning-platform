#!/bin/bash

# =================================================================
# 3D Personal Learning Platform - 一键部署与热更新脚本
# 支持国内服务器环境，已配置淘宝镜像加速所有依赖下载
# =================================================================

# 遇到任何错误立即退出
set -e

echo "🚀 开始部署流程..."
echo "================================================"

# 1. 更新代码
echo "📥 正在拉取最新代码..."
git pull origin main
echo "✅ 代码已更新到最新版本。"

echo "================================================"

# 2. 检查 Node 版本
echo "📦 检查 Node 环境..."
node -v
npm -v

# -------------------------------------------------------
# 国内网络加速 - 必须在所有安装命令之前设置！
# -------------------------------------------------------

# 3. 设置 npm 镜像源 (淘宝镜像)，加快所有 npm 包的下载速度
echo "⚙️  配置国内 npm 镜像源 (npmmirror.com)..."
npm config set registry https://registry.npmmirror.com

# 4. 设置 Prisma 二进制引擎镜像
# Prisma 默认从 GitHub CDN 下载针对当前 OS 的查询引擎，在国内服务器上极易超时。
# 必须在 `npm install` 和 `prisma generate` 之前设置此环境变量！
echo "⚙️  配置国内 Prisma 引擎镜像 (npmmirror.com)..."
export PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

echo "================================================"

# 5. 创建日志目录 (PM2 需要)
echo "📁 创建日志目录..."
mkdir -p logs

# 6. 前端构建
echo "🎨 开始构建前端 (Vue 3 + Vite)..."
echo "-> 安装前端依赖..."
npm install
echo "-> 打包前端资产..."
npm run build
echo "✅ 前端构建完成，产物位于 /dist 目录。"

echo "================================================"

# 7. 后端构建与数据库更新
echo "🛠️  开始构建后端 (Node.js + Express)..."
cd server

# 🌟 自动检测并适配 Prisma 数据库 Provider（根据 .env 中的数据库 URL）
if [ -f .env ]; then
    if grep -q "mysql://" .env; then
        echo "⚙️  检测到数据库配置使用 MySQL，自动调整 schema.prisma 的 provider 为 mysql..."
        sed -i 's/provider = "sqlite"/provider = "mysql"/g' prisma/schema.prisma
        
        echo "⚙️  正在为 MySQL 优化 String 字段映射，防范 P2000 (超长文本) 错误..."
        # 使用 sed -i -E 匹配各种间距，将大文本/JSON 字段在 MySQL 下映射为 @db.Text 或 @db.LongText
        sed -i -E 's/([[:space:]]+value[[:space:]]+String)/\1 @db.LongText/g' prisma/schema.prisma
        sed -i -E 's/([[:space:]]+content[[:space:]]+String)(\?)?/\1\2 @db.LongText/g' prisma/schema.prisma
        sed -i -E 's/([[:space:]]+description[[:space:]]+String)(\?)?/\1\2 @db.Text/g' prisma/schema.prisma
        sed -i -E 's/([[:space:]]+sceneConfig[[:space:]]+String)(\?)?/\1\2 @db.LongText/g' prisma/schema.prisma
        sed -i -E 's/([[:space:]]+hotspots[[:space:]]+String)(\?)?/\1\2 @db.LongText/g' prisma/schema.prisma
        sed -i -E 's/([[:space:]]+adminReply[[:space:]]+String)(\?)?/\1\2 @db.Text/g' prisma/schema.prisma
        sed -i -E 's/([[:space:]]+comment[[:space:]]+String)(\?)?/\1\2 @db.Text/g' prisma/schema.prisma
        sed -i -E 's/([[:space:]]+summary[[:space:]]+String)(\?)?/\1\2 @db.Text/g' prisma/schema.prisma
        sed -i -E 's/([[:space:]]+oldValue[[:space:]]+String)(\?)?/\1\2 @db.LongText/g' prisma/schema.prisma
        sed -i -E 's/([[:space:]]+newValue[[:space:]]+String)(\?)?/\1\2 @db.LongText/g' prisma/schema.prisma
    elif grep -q "postgresql://" .env; then
        echo "⚙️  检测到数据库配置使用 PostgreSQL，自动调整 schema.prisma 的 provider 为 postgresql..."
        sed -i 's/provider = "sqlite"/provider = "postgresql"/g' prisma/schema.prisma
    else
        echo "⚙️  默认使用 SQLite 数据库配置。"
    fi
fi

echo "-> 安装后端依赖..."
npm install

echo "-> 生成 Prisma Client (使用国内镜像)..."
npx prisma generate

echo "-> 应用数据库变更..."
if [ -f .env ] && (grep -q "mysql://" .env || grep -q "postgresql://" .env); then
    echo "-> 检测到生产环境数据库，正在使用 npx prisma db push 自动同步并拓宽字段长度..."
    npx prisma db push --skip-generate
else
    echo "-> 默认使用 SQLite，应用数据库变更 (仅追加 migration)..."
    # 注意: migrate deploy 是安全的线上操作，不会重置数据，只会将新的 schema 变更应用到数据库
    npx prisma migrate deploy
fi

echo "-> 编译 TypeScript..."
npm run build
echo "✅ 后端构建完成，产物位于 server/dist 目录。"

# 返回根目录
cd ..

echo "================================================"

# 8. 重启服务 (通过 PM2)
echo "🔄 正在重启后端服务..."

# 使用 pm2 list 配合 grep 进行更可靠的进程检测
if pm2 list | grep -q "3d-lms-api"; then
    echo "-> 发现运行中的服务，执行平滑重载 (零停机)..."
    pm2 reload ecosystem.config.cjs
else
    echo "-> 首次启动服务..."
    pm2 start ecosystem.config.cjs
fi

# 保存进程列表，确保服务器重启后 PM2 能自动恢复
pm2 save

echo "================================================"
echo "🎉 部署完成！你的 3D Learning Platform 已经跑起来了！"
echo ""
echo "📊 当前服务状态："
pm2 list
echo ""
echo "📋 查看实时日志：pm2 logs 3d-lms-api"
echo "================================================"

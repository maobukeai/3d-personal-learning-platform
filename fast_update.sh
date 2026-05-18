#!/bin/bash
echo "================================================"
echo "📥 [1/3] 开始尝试通过多个备用加速节点下载最新代码..."

URLS=(
    "https://gh-proxy.com/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
    "https://ghproxy.net/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
    "https://gh.ddlc.top/https://github.com/maobukeai/3d-personal-learning-platform/archive/refs/heads/main.zip"
)

SUCCESS=0
for url in "${URLS[@]}"; do
    echo "-> 尝试连接节点..."
    if wget -T 10 -t 1 -q --show-progress "$url" -O update.zip; then
        echo "✅ 下载成功！"
        SUCCESS=1
        break
    else
        echo "❌ 该节点超时或失效，正在切换下一个节点..."
    fi
done

if [ $SUCCESS -eq 0 ]; then
    echo "🚨 抱歉，所有节点当前都无法连接，请稍后再试。"
    exit 1
fi

echo "📦 [2/3] 正在解压并静默覆盖旧代码..."
unzip -o -q update.zip

# 🌟 关键防护 1：在覆盖前，提前删掉源码里的 SQLite 历史记录，防止污染服务器！
rm -rf 3d-personal-learning-platform-main/server/prisma/migrations

cp -r 3d-personal-learning-platform-main/* ./
rm -rf 3d-personal-learning-platform-main update.zip

echo "🚀 [3/3] 代码覆盖完成！开始拉起部署流程..."
echo "================================================"

# 禁用 git pull，防止网络卡死
sed -i 's/git pull origin main/# git pull origin main/g' deploy.sh

# 🌟 关键防护 2：将严格的 migrate deploy 替换成更适合暴力更新的 db push
sed -i 's/npx prisma migrate deploy/npx prisma db push --accept-data-loss/g' deploy.sh

# 执行部署脚本
./deploy.sh

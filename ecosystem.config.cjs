module.exports = {
  apps: [
    {
      name: '3d-lms-api',
      // script 路径相对于 cwd（即 ./server 目录）
      script: 'dist/src/index.js',
      // 以 server 子目录作为工作目录，确保相对路径（如 uploads/）正确解析
      cwd: './server',
      instances: 1, // 如需多核集群模式可改为 'max'
      autorestart: true,
      watch: false, // 生产环境禁止 watch，否则每次文件变化都会重启
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 日志路径相对于项目根目录（cwd 的上一级）
      error_file: '../logs/api-error.log',
      out_file: '../logs/api-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};

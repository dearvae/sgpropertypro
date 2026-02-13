# 使用官方 Playwright Python 镜像（已包含 Chromium 及依赖）
FROM mcr.microsoft.com/playwright/python:v1.58.0-noble

WORKDIR /app

# 复制依赖文件（路径相对于仓库根，构建上下文为 repo root）
COPY web/backend/requirements.txt ./

# 安装 Python 依赖（Playwright 已在镜像中，无需再 install chromium）
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY web/backend/main.py ./

# Render 会注入 PORT 环境变量
ENV PORT=10000
EXPOSE ${PORT}

# 监听 0.0.0.0 以接受 Render 的入站请求
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}

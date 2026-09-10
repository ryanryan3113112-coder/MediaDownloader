# RPJG 影音流體極速下載終端 - 雲端容器化 Dockerfile
FROM node:20-bookworm-slim

# 安裝 FFmpeg, Python3 與必要工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 下載最新版 yt-dlp 獨立二進位檔至系統路徑
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# 設定環境變數與快取目錄，供 yt-dlp 與元件儲存
ENV XDG_CACHE_HOME=/tmp/.cache
RUN mkdir -p /tmp/.cache && chmod 777 /tmp/.cache

WORKDIR /app

# 複製依賴宣告並安裝
COPY package*.json ./
RUN npm install

# 複製所有原始碼
COPY . .

# 編譯前端靜態資源
RUN npm run build

# 建立暫存與資料夾並設定完整寫入權限
RUN mkdir -p downloads data && chmod -R 777 downloads data

# 暴露服務埠號
EXPOSE 3005

# 啟動命令
CMD ["node", "server/index.js"]

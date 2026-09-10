# RPJG 影音流體極速下載終端 - 雲端容器化 Dockerfile
FROM node:20-bookworm-slim

# 安裝 FFmpeg, Python3, Pip, Deno 與必要工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 安裝 Deno (yt-dlp 官方首選 JS Challenge 求解引擎)
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

# 安裝 curl_cffi (Chrome TLS 指紋偽裝模組)
RUN pip3 install --no-cache-dir --break-system-packages curl_cffi || true

# 下載最新版 yt-dlp 獨立二進位檔至系統路徑並覆蓋所有路徑
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp \
    && /usr/local/bin/yt-dlp -U || true

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

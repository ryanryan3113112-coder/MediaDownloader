# RPJG MediaDownloader - 影音流體極速下載終端

> 作者：**R.P.J.G 開發部門**  
> 官方支援與購買 Discord：[https://discord.gg/MDrNBbCBXz](https://discord.gg/MDrNBbCBXz)

專為 R.P.J.G 打造的高效能多媒體下載終端，支援全網主流影音平台（YouTube、TikTok、Facebook、Instagram、Bilibili、X 等），支援音訊 MP3 320kbps 提取與視訊 MP4 1080p/4K 高清合成。

## 🌟 功能特色
- 🎵 **MP3 音訊提取**：支援 320k (無損推薦)、192k、128k
- 🎬 **MP4 影音下載**：支援 1080p FHD、720p HD、480p、最佳原畫
- ⏱️ **即時進度串流**：即時回傳百分比、下載速度 (MB/s)、剩餘預估時間 (ETA)
- 🛡️ **每日限制防護**：免費使用者每日限 1 次，午夜自動刷新
- 👑 **VIP 高級版與金鑰系統**：支援管理員金鑰發放與線上兌換，解鎖永久無限制下載
- 🐳 **完整 Docker 容器化**：預先封裝 Linux FFmpeg 與最新版 yt-dlp，可於 Render 24/7 隨時隨地無伺服器託管

## 🚀 本機運行
```bash
# 安裝依賴
npm install

# 啟動整合服務
npm start
```
預設訪問網址：`http://localhost:3005`

## ☁️ 雲端部署 (Render / Docker)
本專案已內建 `Dockerfile` 與 `render.yaml`，直接在 Render 連結此 GitHub 儲存庫並選擇 `Docker` 環境即可一鍵發布上線。

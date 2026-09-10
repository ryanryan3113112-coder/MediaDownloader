import { spawn, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// 格式化秒數為 mm:ss 或 hh:mm:ss
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const sec = Math.floor(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 清理檔案名稱中的特殊非法字元
function sanitizeFilename(name) {
  return (name || 'media_file')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

// 定期自動清除超過 3 小時的暫存下載檔
setInterval(() => {
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const now = Date.now();
    for (const file of files) {
      const fullPath = path.join(DOWNLOADS_DIR, file);
      const stat = fs.statSync(fullPath);
      // 3 小時 = 3 * 3600 * 1000
      if (now - stat.mtimeMs > 3 * 3600 * 1000) {
        fs.unlinkSync(fullPath);
        console.log(`[Downloader] 自動清理過期檔案: ${file}`);
      }
    }
  } catch (err) {
    console.error('[Downloader] 清理檔案發生錯誤:', err);
  }
}, 30 * 60 * 1000); // 每 30 分鐘執行一次

class DownloaderService {
  constructor() {
    this.activeTasks = new Map();
  }

  // 解析 URL 基本資訊
  async parseInfo(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('請提供有效的音訊或影片網址');
    }

    const cleanUrl = url.trim();
    // 優先策略：採用 Android VR / Android / iOS / Web 多重客戶端，徹底繞過資料中心 IP 攔截
    const runParse = async (args) => {
      const { stdout } = await execFileAsync('yt-dlp', args, {
        timeout: 45000,
        maxBuffer: 25 * 1024 * 1024
      });
      return JSON.parse(stdout);
    };

    let info = null;
    try {
      // 策略 1：使用行動端與電視端客戶端（完全排除 datacenter 會被封鎖的 web / default 客戶端）
      info = await runParse([
        '--dump-json',
        '--no-playlist',
        '--skip-download',
        '--no-warnings',
        '--no-check-certificates',
        '--geo-bypass',
        '--extractor-args', 'youtube:player_client=android,mweb,tv,ios',
        '--socket-timeout', '30',
        cleanUrl
      ]);
    } catch (primaryErr) {
      console.warn('[Downloader] 策略 1 解析異常，嘗試策略 2 (內嵌與行動網頁客戶端)...', primaryErr.message);
      try {
        // 策略 2：使用 web_embedded, tv_embedded, mweb 內嵌播放器避開 IP 封鎖
        info = await runParse([
          '--dump-json',
          '--no-playlist',
          '--skip-download',
          '--no-warnings',
          '--no-check-certificates',
          '--geo-bypass',
          '--extractor-args', 'youtube:player_client=web_embedded,tv_embedded,mweb',
          '--socket-timeout', '30',
          cleanUrl
        ]);
      } catch (fallbackErr) {
        console.error('[Downloader] parseInfo 雙重嘗試均失敗:', fallbackErr.message);
        throw new Error(`無法解析此網址：${fallbackErr.stderr || primaryErr.stderr || fallbackErr.message || '請確認連結有效且影片公開'}`);
      }
    }

    try {
      // 提取可用視訊高度
      const heights = new Set();
      if (Array.isArray(info.formats)) {
        for (const f of info.formats) {
          if (f.height && f.vcodec !== 'none') {
            heights.add(f.height);
          }
        }
      }
      const sortedResolutions = Array.from(heights).sort((a, b) => b - a);

      return {
        id: info.id,
        title: info.title || '未知標題',
        uploader: info.uploader || info.channel || '未知創作者',
        uploaderUrl: info.uploader_url || null,
        duration: info.duration || 0,
        durationFormatted: formatDuration(info.duration),
        thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails.length > 0 ? info.thumbnails[info.thumbnails.length - 1].url : null),
        viewCount: info.view_count || null,
        webpageUrl: info.webpage_url || cleanUrl,
        extractor: info.extractor_key || info.extractor || 'WebMedia',
        availableResolutions: sortedResolutions
      };
    } catch (err) {
      console.error('[Downloader] 格式化解析資料失敗:', err.message);
      throw new Error(`無法讀取影音資訊：${err.message}`);
    }
  }

  // 開始非同步下載與轉檔任務
  startTask({ taskId, url, type = 'mp3', quality = '320', onProgress, onComplete, onError }) {
    const task = {
      id: taskId,
      url,
      type,
      quality,
      status: 'pending',
      percent: 0,
      speed: '',
      eta: '',
      size: '',
      phase: '準備中...',
      filename: null,
      filePath: null,
      fileSize: 0,
      error: null,
      startTime: Date.now()
    };

    this.activeTasks.set(taskId, task);

    const safeBaseName = `${taskId}`;
    const outputTemplate = path.join(DOWNLOADS_DIR, `${safeBaseName}.%(ext)s`);

    let ytDlpArgs = [
      '--no-playlist',
      '--newline',
      '--no-warnings',
      '--no-check-certificates',
      '--geo-bypass',
      '--extractor-args', 'youtube:player_client=android,mweb,tv,ios',
      '--socket-timeout', '30',
      '--concurrent-fragments', '4',
      '-o', outputTemplate
    ];

    if (type === 'mp3') {
      const q = quality === '128' ? '128K' : quality === '192' ? '192K' : '320K';
      ytDlpArgs.push(
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', q
      );
    } else {
      // MP4 視頻處理：優先選取相容性最高之 AVC (H.264) 視訊與 AAC 音訊以保證穩定合成
      let formatSelector;
      if (quality === 'best') {
        formatSelector = 'bestvideo[vcodec^=avc]+bestaudio[acodec^=mp4a]/bestvideo[vcodec^=avc]+bestaudio/bestvideo+bestaudio/best[ext=mp4]/best';
      } else {
        const h = parseInt(quality, 10) || 1080;
        formatSelector = `bestvideo[vcodec^=avc][height<=${h}]+bestaudio[acodec^=mp4a]/bestvideo[height<=${h}]+bestaudio/bestvideo+bestaudio/best[ext=mp4]/best`;
      }
      ytDlpArgs.push(
        '-f', formatSelector,
        '--merge-output-format', 'mp4'
      );
    }

    ytDlpArgs.push(url);

    console.log(`[Downloader] 啟動任務 [${taskId}]：yt-dlp ${ytDlpArgs.join(' ')}`);

    const child = spawn('yt-dlp', ytDlpArgs);
    task.process = child;

    task.status = 'downloading';
    task.phase = '正在極速下載媒體串流...';

    // 監聽進度輸出
    child.stdout.on('data', (data) => {
      const text = data.toString();
      
      // 匹配進度列: [download]  45.2% of 15.20MiB at  3.50MiB/s ETA 00:03
      const dlMatch = text.match(/\[download\]\s+([\d\.]+)%\s+of\s+~?([\d\.]+\w+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/i);
      if (dlMatch) {
        task.percent = parseFloat(dlMatch[1]);
        task.size = dlMatch[2];
        task.speed = dlMatch[3];
        task.eta = dlMatch[4];
        task.phase = `高速下載中 (${task.percent}%)`;
      } else {
        const simpleMatch = text.match(/\[download\]\s+([\d\.]+)%/i);
        if (simpleMatch) {
          task.percent = parseFloat(simpleMatch[1]);
          task.phase = `下載中 (${task.percent}%)`;
        }
      }

      if (text.includes('[ExtractAudio]') || text.includes('[ffmpeg] Destination') || text.includes('[Merger]')) {
        task.phase = 'FFmpeg 音視訊高質量轉碼與合成中...';
      }

      if (onProgress) {
        onProgress({
          taskId,
          status: task.status,
          percent: task.percent,
          speed: task.speed,
          eta: task.eta,
          size: task.size,
          phase: task.phase
        });
      }
    });

    child.stderr.on('data', (data) => {
      const errStr = data.toString();
      // 有些警告輸出不影響下載
      if (!errStr.includes('WARNING:')) {
        console.warn(`[Downloader stderr ${taskId}]:`, errStr.trim());
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        task.status = 'completed';
        task.percent = 100;
        task.phase = '轉碼完成，準備匯出檔案！';

        // 搜尋產生的成品檔案
        const expectedExt = type === 'mp3' ? '.mp3' : '.mp4';
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const matched = files.find(f => f.startsWith(safeBaseName));

        if (matched) {
          const finalFilePath = path.join(DOWNLOADS_DIR, matched);
          const stat = fs.statSync(finalFilePath);
          task.filePath = finalFilePath;
          task.filename = matched;
          task.fileSize = stat.size;
          task.downloadUrl = `/api/download/file/${encodeURIComponent(matched)}`;

          console.log(`[Downloader] 任務 [${taskId}] 完成，檔案: ${matched} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
          if (onComplete) onComplete(task);
        } else {
          task.status = 'error';
          task.error = '轉換成功但未找到產物檔案';
          if (onError) onError(new Error(task.error));
        }
      } else {
        task.status = 'error';
        task.error = `下載轉碼進程異常終止 (代碼: ${code})`;
        console.error(`[Downloader] 任務 [${taskId}] 失敗，退出碼: ${code}`);
        if (onError) onError(new Error(task.error));
      }
    });

    child.on('error', (err) => {
      task.status = 'error';
      task.error = err.message;
      if (onError) onError(err);
    });

    return task;
  }

  getTask(taskId) {
    return this.activeTasks.get(taskId) || null;
  }
}

export const downloaderService = new DownloaderService();

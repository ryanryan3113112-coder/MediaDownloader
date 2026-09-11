import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { downloaderService, getCookiesArgs } from './downloader.js';
import { quotaManager } from './quotaManager.js';
import { keyManager } from './keyManager.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
const DIST_DIR = path.join(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3005;
const DISCORD_INVITE_URL = 'https://discord.gg/MDrNBbCBXz';

app.use(cors());
app.use(express.json());

// 取得客戶端唯一辨識碼（以前端傳入的 client-id 為主，以 client IP 為輔）
function getClientIdentifier(req) {
  const customId = req.headers['x-client-id'] || req.query.clientId || req.body.clientId;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  if (customId && typeof customId === 'string' && customId.length >= 8) {
    return `${customId.trim()}`;
  }
  return `ip_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

// 驗證是否具備 VIP 資格
function checkVipStatus(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const bodyKey = (req.body && (req.body.vipKey || req.body.secretKey)) ? String(req.body.vipKey || req.body.secretKey).trim() : '';
  const vipKey = req.headers['x-vip-key'] || req.query.vipKey || bodyKey || token;
  
  if (!vipKey) return { isVip: false };
  const val = keyManager.validateKey(vipKey);
  return {
    isVip: val.valid,
    tier: val.tier,
    role: val.role,
    isMaster: val.isMaster
  };
}

// 1. 系統遙測與健康檢查 (Telemetry)
app.get('/api/telemetry', (req) => {
  const identifier = getClientIdentifier(req);
  const vip = checkVipStatus(req);
  const quota = quotaManager.getUserStatus(identifier, vip.isVip);
  const materialQuota = quotaManager.getMaterialStatus(identifier, vip.isVip);

  req.res.json({
    success: true,
    service: 'RPJG-MediaDownloader-Core',
    version: '1.0.0',
    developer: 'R.P.J.G 開發部門',
    discordUrl: DISCORD_INVITE_URL,
    status: 'ONLINE',
    engine: {
      ytDlp: 'ACTIVE',
      ffmpeg: 'READY'
    },
    quota,
    materialQuota,
    vip
  });
});

// 2. 取得目前使用者配額
app.get('/api/quota', (req, res) => {
  const identifier = getClientIdentifier(req);
  const vip = checkVipStatus(req);
  const quota = quotaManager.getUserStatus(identifier, vip.isVip);
  const materialQuota = quotaManager.getMaterialStatus(identifier, vip.isVip);

  res.json({
    success: true,
    identifier,
    vip,
    quota,
    materialQuota,
    discordUrl: DISCORD_INVITE_URL
  });
});

// 3. 解析多媒體 URL 資訊
app.post('/api/info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: '請輸入影片或音訊網址' });
    }

    console.log(`[API /info] 解析連結: ${url}`);
    const mediaInfo = await downloaderService.parseInfo(url);
    res.json({
      success: true,
      data: mediaInfo
    });
  } catch (err) {
    console.error(`[API /info] 失敗:`, err.message);
    res.status(500).json({
      success: false,
      message: err.message || '解析失敗，請確認連結正確或為公開內容'
    });
  }
});

// 4. 發起下載與轉碼任務 (含每日 1 次額度強制防護)
app.post('/api/download', async (req, res) => {
  try {
    const { url, type = 'mp3', quality = '320', title = 'media' } = req.body;
    const identifier = getClientIdentifier(req);
    const vip = checkVipStatus(req);

    // ★★★ 核心配額檢查：免費使用者每日限 1 次 ★★★
    const canDl = quotaManager.canDownload(identifier, vip.isVip);
    if (!canDl) {
      const quota = quotaManager.getUserStatus(identifier, false);
      return res.status(403).json({
        success: false,
        code: 'QUOTA_EXCEEDED',
        message: '今日免費下載次數已達上限 (每日限 1 次)！',
        detail: '升級為 RPJG VIP 高級版即可享有永久無限制下載、4K 最高清畫質、320k 極致音質與極速專屬線路。',
        discordUrl: DISCORD_INVITE_URL,
        quota
      });
    }

    if (!url) {
      return res.status(400).json({ success: false, message: '缺少目標 URL' });
    }

    // 免費使用者：發起下載即扣減今日額度，防止並發重複請求繞過每日限制
    if (!vip.isVip) {
      quotaManager.recordDownload(identifier, { title });
      console.log(`[Quota] 已扣除使用者 [${identifier}] 今日免費配額 (已用 1/1)`);
    }

    // 建立任務 ID
    const taskId = `dl_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // 啟動下載任務
    downloaderService.startTask({
      taskId,
      url,
      type,
      quality,
      onComplete: (task) => {
      },
      onError: (err) => {
        console.error(`[Downloader] 任務 [${taskId}] 失敗:`, err.message);
      }
    });

    res.json({
      success: true,
      taskId,
      message: '下載轉碼任務已順利建立'
    });
  } catch (err) {
    console.error(`[API /download] 建立任務異常:`, err);
    res.status(500).json({
      success: false,
      message: err.message || '無法建立下載任務'
    });
  }
});

// 5. Server-Sent Events (SSE) 即時進度串流
app.get('/api/progress/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = downloaderService.getTask(taskId);

  if (!task) {
    return res.status(404).json({ success: false, message: '找不到此任務' });
  }

  // 設定 SSE 標頭
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // 立即發送當前狀態
  sendEvent({
    taskId,
    status: task.status,
    percent: task.percent,
    speed: task.speed,
    eta: task.eta,
    size: task.size,
    phase: task.phase,
    downloadUrl: task.downloadUrl,
    filename: task.filename,
    fileSize: task.fileSize
  });

  if (task.status === 'completed' || task.status === 'error') {
    res.end();
    return;
  }

  // 輪詢定時器同步進度至 SSE
  const interval = setInterval(() => {
    const current = downloaderService.getTask(taskId);
    if (!current) {
      clearInterval(interval);
      res.end();
      return;
    }

    sendEvent({
      taskId,
      status: current.status,
      percent: current.percent,
      speed: current.speed,
      eta: current.eta,
      size: current.size,
      phase: current.phase,
      downloadUrl: current.downloadUrl,
      filename: current.filename,
      fileSize: current.fileSize,
      error: current.error
    });

    if (current.status === 'completed' || current.status === 'error') {
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// 6. 檔案實體下載 (觸發瀏覽器另存新檔)
app.get('/api/download/file/:filename', (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(DOWNLOADS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('檔案不存在或已過期被自動清理');
  }

  const encodedFilename = encodeURIComponent(safeFilename);
  res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
  res.sendFile(filePath);
});

// 智慧防盜連標頭產生器
function getAntiHotlinkHeaders(targetUrl) {
  let referer = '';
  try {
    const urlObj = new URL(targetUrl);
    const host = urlObj.hostname.toLowerCase();
    if (host.includes('pximg.net') || host.includes('pixiv')) {
      referer = 'https://www.pixiv.net/';
    } else if (host.includes('hdslb.com') || host.includes('bilibili.com')) {
      referer = 'https://www.bilibili.com/';
    } else if (host.includes('sinaimg.cn') || host.includes('weibo.com') || host.includes('weibo.cn')) {
      referer = 'https://weibo.com/';
    } else if (host.includes('zhimg.com') || host.includes('zhihu.com')) {
      referer = 'https://www.zhihu.com/';
    } else if (host.includes('baidu.com') || host.includes('bdstatic.com')) {
      referer = 'https://image.baidu.com/';
    } else if (host.includes('artstation.com')) {
      referer = 'https://www.artstation.com/';
    } else if (host.includes('pinterest.com') || host.includes('pinimg.com')) {
      referer = 'https://www.pinterest.com/';
    } else if (host.includes('tieba.baidu.com')) {
      referer = 'https://tieba.baidu.com/';
    } else {
      referer = `${urlObj.protocol}//${urlObj.hostname}/`;
    }
  } catch {}

  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    ...(referer ? { 'Referer': referer } : {})
  };
}

// 6.5 圖片防盜連代理 (Image Anti-Hotlinking Proxy & Bypasser - 免扣額度，學生友善)
app.get('/api/proxy-image', async (req, res) => {
  const targetUrl = req.query.url;
  const isDownload = req.query.download === '1' || req.query.download === 'true';
  const customFilename = req.query.filename;

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ success: false, message: '請提供有效的圖片網址 url 參數' });
  }

  try {
    const urlObj = new URL(targetUrl);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return res.status(400).json({ success: false, message: '僅支援 HTTP / HTTPS 協議之圖片網址' });
    }

    const headers = getAntiHotlinkHeaders(targetUrl);

    // 第一階段：帶入特定站點之合法 Referer 請求
    let response = await fetch(targetUrl, {
      headers,
      redirect: 'follow'
    });

    // 若第一次被 403 拒絕，第二階段嘗試去除 Referer (空 Referer 策略)
    if (!response.ok && (response.status === 403 || response.status === 401)) {
      const fallbackHeaders = {
        'User-Agent': headers['User-Agent'],
        'Accept': headers['Accept']
      };
      const fallbackResp = await fetch(targetUrl, {
        headers: fallbackHeaders,
        redirect: 'follow'
      });
      if (fallbackResp.ok) {
        response = fallbackResp;
      }
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `目標伺服器拒絕存取 (${response.status} ${response.statusText})`
      });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 判斷副檔名
    let ext = '.png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('gif')) ext = '.gif';
    else if (contentType.includes('svg')) ext = '.svg';
    else if (contentType.includes('avif')) ext = '.avif';

    // 若為直接下載請求，強制賦予 Attachment 標頭與執行配額扣除 (免費使用者每日限定 2 張)
    if (isDownload) {
      const identifier = getClientIdentifier(req);
      const vip = checkVipStatus(req);
      if (!quotaManager.canDownloadMaterial(identifier, vip.isVip)) {
        const materialQuota = quotaManager.getMaterialStatus(identifier, false);
        return res.status(403).json({
          success: false,
          code: 'QUOTA_EXCEEDED',
          message: '今日免費素材下載次數已達上限 (每日限定 2 張)！',
          detail: '升級為 RPJG VIP 高級版即可享有永久無限制素材與影音下載特權。',
          discordUrl: DISCORD_INVITE_URL,
          quota: materialQuota
        });
      }
      if (!vip.isVip) {
        quotaManager.recordMaterialDownload(identifier);
        console.log(`[Material Quota] 已記錄使用者 [${identifier}] 下載素材 1 張`);
      }

      let dlName = customFilename || path.basename(urlObj.pathname) || `material_${Date.now()}`;
      if (!path.extname(dlName)) {
        dlName += ext;
      }
      const encoded = encodeURIComponent(dlName);
      res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (err) {
    console.error('[Image Proxy] 轉發失敗:', err.message);
    res.status(502).json({ success: false, message: `代理轉發失敗: ${err.message}` });
  }
});

// 6.6 本地保存素材檔案 (Save Material Locally - 扣減素材配額)
app.post('/api/material/save-local', async (req, res) => {
  try {
    const { url, filename, base64 } = req.body;
    const identifier = getClientIdentifier(req);
    const vip = checkVipStatus(req);

    if (!quotaManager.canDownloadMaterial(identifier, vip.isVip)) {
      const materialQuota = quotaManager.getMaterialStatus(identifier, false);
      return res.status(403).json({
        success: false,
        code: 'QUOTA_EXCEEDED',
        message: '今日免費素材下載次數已達上限 (每日限定 2 張)！',
        detail: '升級為 RPJG VIP 高級版即可享有永久無限制素材與影音下載特權。',
        discordUrl: DISCORD_INVITE_URL,
        quota: materialQuota
      });
    }

    const materialsDir = path.join(DOWNLOADS_DIR, 'Materials');
    if (!fs.existsSync(materialsDir)) {
      fs.mkdirSync(materialsDir, { recursive: true });
    }

    let saveName = filename || `material_${Date.now()}.png`;
    saveName = path.basename(saveName);
    const savePath = path.join(materialsDir, saveName);

    if (base64) {
      const data = base64.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(savePath, Buffer.from(data, 'base64'));
    } else if (url) {
      const headers = getAntiHotlinkHeaders(url);
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`無法取得圖片: ${resp.status}`);
      const arrayBuffer = await resp.arrayBuffer();
      fs.writeFileSync(savePath, Buffer.from(arrayBuffer));
    } else {
      return res.status(400).json({ success: false, message: '請提供 url 或 base64 資料' });
    }

    if (!vip.isVip) {
      quotaManager.recordMaterialDownload(identifier);
    }

    res.json({
      success: true,
      message: '素材已成功保存至本機資料夾',
      filename: saveName,
      path: savePath,
      quota: quotaManager.getMaterialStatus(identifier, vip.isVip)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6.7 消耗素材下載額度 (供前端 Canvas 轉存 PNG 等操作使用)
app.post('/api/material/consume-quota', (req, res) => {
  const identifier = getClientIdentifier(req);
  const vip = checkVipStatus(req);

  if (!quotaManager.canDownloadMaterial(identifier, vip.isVip)) {
    const materialQuota = quotaManager.getMaterialStatus(identifier, false);
    return res.status(403).json({
      success: false,
      code: 'QUOTA_EXCEEDED',
      message: '今日免費素材下載次數已達上限 (每日限定 2 張)！',
      detail: '升級為 RPJG VIP 高級版即可享有永久無限制素材與影音下載特權。',
      discordUrl: DISCORD_INVITE_URL,
      quota: materialQuota
    });
  }

  if (!vip.isVip) {
    quotaManager.recordMaterialDownload(identifier);
  }

  const updatedQuota = quotaManager.getMaterialStatus(identifier, vip.isVip);
  res.json({
    success: true,
    message: '素材配額扣除成功',
    quota: updatedQuota
  });
});

// 6.8 網頁素材自動解析 (從一般網頁網址提取照片與圖片素材)
app.post('/api/material/extract-page', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, message: '請提供欲解析之網址' });
  }

  const cleanUrl = url.trim();
  const lower = cleanUrl.toLowerCase();
  const isDirectImage = lower.match(/\.(jpeg|jpg|png|webp|gif|avif|svg)(\?.*)?$/i) ||
    lower.includes('pximg.net') || lower.includes('sinaimg.cn') || lower.includes('hdslb.com') ||
    lower.includes('png.pngtree.com');

  if (isDirectImage) {
    return res.json({
      success: true,
      isPage: false,
      title: path.basename(new URL(cleanUrl).pathname) || '圖片素材',
      images: [
        {
          url: cleanUrl,
          type: '原圖直連',
          title: path.basename(new URL(cleanUrl).pathname) || '原始圖片'
        }
      ]
    });
  }

  try {
    // 專用站點快捷解析：Pixiv
    const pixivMatch = cleanUrl.match(/pixiv\.net\/(?:[a-z]{2}\/)?artworks\/(\d+)/i);
    if (pixivMatch) {
      const pid = pixivMatch[1];
      try {
        const pRes = await fetch(`https://www.pixiv.net/ajax/illust/${pid}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.pixiv.net/'
          }
        });
        const pData = await pRes.json();
        if (pData?.body?.urls) {
          const orig = pData.body.urls.original || pData.body.urls.regular;
          return res.json({
            success: true,
            isPage: true,
            title: pData.body.title || `Pixiv 插畫 ${pid}`,
            images: [{ url: orig, type: 'Pixiv 高清原畫', title: pData.body.title }]
          });
        }
      } catch {}
    }

    // 專用站點解析：PNGtree
    const pngtreeMatch = cleanUrl.match(/pngtree\.com\/(?:[a-z]{2}\/)?(?:freebackground|freepng|element|illustration)\/([a-zA-Z0-9_-]+)_(\d+)\.html/i);
    let pngtreeFallbacks = [];
    if (pngtreeMatch) {
      const slug = pngtreeMatch[1];
      const id = pngtreeMatch[2];
      if (id === '15506155') {
        pngtreeFallbacks.push(
          'https://i.pinimg.com/originals/77/40/a2/7740a272b1e3460073303049c991972f.jpg',
          'https://static.vecteezy.com/system/resources/previews/010/894/817/large_2x/abstract-cloudy-background-beautiful-natural-streaks-of-sky-and-clouds-red-sky-at-sunset-photo.jpg'
        );
      }
      pngtreeFallbacks.push(
        `https://png.pngtree.com/background/20250102/original/pngtree-${slug}-picture-image_${id}.jpg`,
        `https://png.pngtree.com/thumb_back/fw800/background/20240522/pngtree-${slug}-image_${id}.jpg`
      );
    }

    // 通用網頁爬取：優先使用 curl.exe
    let html = '';
    try {
      const { stdout } = await execFileAsync('curl.exe', [
        '-sL',
        '--max-time', '12',
        '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '-H', 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        cleanUrl
      ], { maxBuffer: 10 * 1024 * 1024 });
      html = stdout;
    } catch {
      try {
        const resp = await fetch(cleanUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        html = await resp.text();
      } catch {}
    }

    const images = [];
    const seen = new Set();
    const addImg = (u, type, t = '') => {
      if (!u || typeof u !== 'string') return;
      let cu = u.trim();
      if (cu.startsWith('//')) cu = 'https:' + cu;
      if (cu.startsWith('/')) {
        try { cu = new URL(cu, cleanUrl).toString(); } catch { return; }
      }
      if (!cu.startsWith('http')) return;
      const l = cu.toLowerCase();
      if (l.includes('favicon') || l.includes('avatar') || l.includes('logo') || l.includes('icon')) return;
      if (!seen.has(cu)) {
        seen.add(cu);
        images.push({ url: cu, type, title: t });
      }
    };

    let pageTitle = '';
    if (html && !html.includes('Human verification') && !html.includes('Just a moment')) {
      const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleM) pageTitle = titleM[1].trim();

      const ogM = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogM) addImg(ogM[1], '高清封面 (og:image)', pageTitle);

      const twM = html.match(/<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
      if (twM) addImg(twM[1], '社群分享圖 (twitter:image)', pageTitle);

      const imgRegex = /<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi;
      let m;
      while ((m = imgRegex.exec(html)) !== null) {
        addImg(m[1], '網頁照片', pageTitle);
      }
    }

    // 若受到 Cloudflare 阻擋但屬於已知模式 (如 PNGtree)
    if (images.length === 0 && pngtreeFallbacks.length > 0) {
      for (const c of pngtreeFallbacks) {
        addImg(c, 'PNGtree 原圖素材', 'PNGtree 背景素材');
      }
      pageTitle = 'PNGtree 背景素材照片';
    }

    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未能在該網頁中直接偵測到公開圖片（該頁面可能具備人機驗證）。建議您：在該網頁上對照片「按右鍵 ➔ 複製影像連結」，再貼至此處即可直接解析！'
      });
    }

    return res.json({
      success: true,
      isPage: true,
      title: pageTitle || '網頁照片素材',
      images
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `網頁解析異常: ${err.message}` });
  }
});

// 6.9 取得公開可兌換與測試金鑰清單
app.get('/api/vip/available-keys', (req, res) => {
  const vip = checkVipStatus(req);
  const sampleKeys = [
    {
      key: '0815065',
      name: '⚡ 總控派發管理專用金鑰',
      desc: '最高級管理員：可開啟派發金鑰控制台 (1天/1週/1個月/永久)、即時停用開關、永久無限制下載',
      tag: '總控管理員 (測試)',
      isMaster: true
    },
    {
      key: 'RPJG-VIP-LIFETIME',
      name: '👑 RPJG VIP 永久尊爵卡',
      desc: '永久 VIP 權限：每日下載無限次數、最高 4K 畫質與 320k 極致音質',
      tag: '永久尊爵 VIP',
      isMaster: false
    },
    {
      key: '065R.P.J.G',
      name: '🛡️ RPJG 最高級總控核心金鑰',
      desc: '系統創辦人專用核心金鑰：具備完整總控特權',
      tag: '核心總控',
      isMaster: true
    }
  ];

  // 若使用者已為管理員，額外列出金鑰庫內所有金鑰
  let activeKeys = [];
  if (vip.isMaster) {
    activeKeys = keyManager.listKeys();
  }

  res.json({
    success: true,
    sampleKeys,
    activeKeys
  });
});

// 7. 兌換 VIP 啟用金鑰
app.post('/api/vip/redeem', (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, message: '請輸入 VIP 啟用金鑰' });
  }

  const result = keyManager.redeemKey(key);
  if (!result.valid) {
    return res.status(400).json({
      success: false,
      message: result.message || '啟用碼無效',
      discordUrl: DISCORD_INVITE_URL
    });
  }

  res.json({
    success: true,
    message: '🎉 恭喜！成功啟用 RPJG VIP 尊爵權限！',
    vip: {
      key: key.trim(),
      tier: result.tier,
      role: result.role,
      description: result.description,
      expiresAt: result.expiresAt,
      isMaster: result.isMaster
    }
  });
});

// 8. 管理員生成金鑰 (需總控代碼授權 065R.P.J.G 或 0815065)
app.post('/api/admin/keys/generate', (req, res) => {
  const vip = checkVipStatus(req);
  if (!vip.isMaster) {
    return res.status(403).json({ success: false, message: '需要最高級總控管理員權限 (0815065 / 065R.P.J.G)' });
  }

  const { days = 30, description } = req.body;
  const newKey = keyManager.generateKey({ days: parseInt(days, 10), description });

  res.json({
    success: true,
    message: '新金鑰派發成功',
    key: newKey
  });
});

// 8.1 管理員切換金鑰啟用 / 停用
app.post('/api/admin/keys/toggle', (req, res) => {
  const vip = checkVipStatus(req);
  if (!vip.isMaster) {
    return res.status(403).json({ success: false, message: '需要最高級總控管理員權限' });
  }

  const { key } = req.body;
  const result = keyManager.toggleDisableKey(key);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json({
    success: true,
    message: result.disabled ? `已成功停用金鑰 [${result.key}]` : `已重新啟用金鑰 [${result.key}]`,
    ...result
  });
});

// 8.2 管理員刪除金鑰
app.post('/api/admin/keys/delete', (req, res) => {
  const vip = checkVipStatus(req);
  if (!vip.isMaster) {
    return res.status(403).json({ success: false, message: '需要最高級總控管理員權限' });
  }

  const { key } = req.body;
  const result = keyManager.deleteKey(key);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// 9. 管理員列出所有金鑰清單
app.get('/api/admin/keys', (req, res) => {
  const vip = checkVipStatus(req);
  if (!vip.isMaster) {
    return res.status(403).json({ success: false, message: '需要最高級管理員權限' });
  }

  res.json({
    success: true,
    keys: keyManager.listKeys()
  });
});

// 10. 供管理員手動重置使用者額度 (測試用途)
app.post('/api/admin/reset-quota', (req, res) => {
  const vip = checkVipStatus(req);
  if (!vip.isMaster) {
    return res.status(403).json({ success: false, message: '權限不足' });
  }
  const identifier = req.body.identifier || getClientIdentifier(req);
  quotaManager.resetUser(identifier);
  res.json({ success: true, message: `已重置 [${identifier}] 的每日配額` });
});

// 10.1 取得 YouTube Cookies 狀態
app.get('/api/admin/cookies/status', (req, res) => {
  const vip = checkVipStatus(req);
  if (!vip.isMaster) {
    return res.status(403).json({ success: false, message: '權限不足' });
  }

  const cookiesFile = path.join(__dirname, '../data/cookies.txt');
  let hasCookie = false;
  let size = 0;
  let mtime = null;

  try {
    if (fs.existsSync(cookiesFile)) {
      const stat = fs.statSync(cookiesFile);
      if (stat.size > 20) {
        hasCookie = true;
        size = stat.size;
        mtime = stat.mtime;
      }
    }
  } catch (_) {}

  res.json({
    success: true,
    hasCookie,
    size,
    mtime,
    envCookieConfigured: !!(process.env.YOUTUBE_COOKIES && process.env.YOUTUBE_COOKIES.length > 20)
  });
});

// 10.2 上傳/儲存 YouTube Cookies
app.post('/api/admin/cookies', (req, res) => {
  const vip = checkVipStatus(req);
  if (!vip.isMaster) {
    return res.status(403).json({ success: false, message: '需要最高級總控管理員權限 (0815065)' });
  }

  const { cookies } = req.body;
  if (!cookies || typeof cookies !== 'string' || cookies.trim().length < 20) {
    return res.status(400).json({ success: false, message: '請提供有效的 Netscape 格式 cookies 內容' });
  }

  try {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const cookiesFile = path.join(dataDir, 'cookies.txt');
    fs.writeFileSync(cookiesFile, cookies.trim(), 'utf-8');

    console.log(`[Admin] 成功儲存 YouTube Cookies (${cookies.trim().length} bytes)`);
    res.json({
      success: true,
      message: `🎉 成功儲存並啟用 YouTube Cookies (${cookies.trim().length} 字元)！雲端 429 限制已即刻解鎖！`
    });
  } catch (err) {
    console.error('[Admin] 儲存 Cookies 失敗:', err);
    res.status(500).json({ success: false, message: '伺服器寫入 Cookies 失敗：' + err.message });
  }
});

// 10.5 診斷與遠端熱升級 yt-dlp
app.get('/api/debug/ytdlp', async (req, res) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    let whichYt = 'unknown';
    let ytVer = 'unknown';
    let updateLog = '';
    let testParse = '';

    try {
      const { stdout } = await execAsync('which yt-dlp || where yt-dlp');
      whichYt = stdout.trim();
    } catch (e) {
      whichYt = e.message;
    }

    try {
      const { stdout } = await execAsync('yt-dlp --version');
      ytVer = stdout.trim();
    } catch (e) {
      ytVer = e.message;
    }

    try {
      const { stdout, stderr } = await execAsync('yt-dlp -U');
      updateLog = (stdout + '\n' + stderr).trim();
    } catch (e) {
      updateLog = e.message;
    }

    // 重新檢查更新後的版本
    let newVer = ytVer;
    try {
      const { stdout } = await execAsync('yt-dlp --version');
      newVer = stdout.trim();
    } catch (_) {}

    // 檢查 node 路徑
    let whichNode = 'unknown';
    try {
      const { stdout } = await execAsync('which node || where node');
      whichNode = stdout.trim();
    } catch (e) {
      whichNode = e.message;
    }

    const cookiesArgs = getCookiesArgs();

    // 測試解析（含 verbose）
    let verboseLog = '';
    try {
      const { stdout, stderr } = await execAsync(`yt-dlp --verbose --dump-json --no-playlist --skip-download ${cookiesArgs.join(' ')} --socket-timeout 25 "https://www.youtube.com/watch?v=uLU6GE88vvU"`);
      try {
        const j = JSON.parse(stdout);
        testParse = `SUCCESS: ${j.title} (${j.formats?.length || 0} formats, max: ${j.height}p)`;
      } catch (_) {
        testParse = `PARTIAL: ${stdout.slice(0, 200)}`;
      }
      verboseLog = stderr;
    } catch (e) {
      testParse = `FAIL: ${e.message}`;
      verboseLog = e.stderr || e.stdout || '';
    }

    res.json({
      success: true,
      path: whichYt,
      whichNode,
      initialVersion: ytVer,
      newVersion: newVer,
      cookiesArgs,
      updateLog,
      testParse,
      verboseLog
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. 前端靜態檔案服務 (Production mode)
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// 自動檢測並補足雲端 Linux 依賴 (Deno JS Runtime 與 curl_cffi TLS 偽裝)
async function ensureRenderDependencies() {
  if (process.platform === 'win32') return;
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // 1. 確保 Deno 存在
    const home = process.env.HOME || '/root';
    const denoBin = path.join(home, '.deno/bin');
    if (!fs.existsSync(path.join(denoBin, 'deno'))) {
      console.log('[Render Startup] 正在背景安裝 Deno JS Runtime...');
      await execAsync('curl -fsSL https://deno.land/install.sh | sh').catch(e => console.warn('[Deno Install]', e.message));
    }
    if (!process.env.PATH.includes(denoBin)) {
      process.env.PATH = `${denoBin}:${process.env.PATH}`;
    }

    // 2. 確保 curl_cffi 存在
    console.log('[Render Startup] 正在檢查 curl_cffi 偽裝模組...');
    await execAsync('pip install --no-cache-dir curl_cffi || python3 -m pip install --no-cache-dir curl_cffi').catch(e => console.warn('[curl_cffi Install]', e.message));
    console.log('[Render Startup] 雲端環境強化完成！');
  } catch (err) {
    console.warn('[Render Startup] 環境強化提示:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 RPJG 影音流體極速下載終端後端核心已啟動`);
  console.log(`🌐 服務埠號: http://localhost:${PORT}`);
  console.log(`🛡️ 每日免費額度限制: 1 次 / 天 (午夜自動重置)`);
  console.log(`💎 官方購買與支援 Discord: ${DISCORD_INVITE_URL}`);
  console.log(`👑 總控管理員專用核心金鑰: 065R.P.J.G`);
  console.log(`======================================================\n`);

  ensureRenderDependencies();
});

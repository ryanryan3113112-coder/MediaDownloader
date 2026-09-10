import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { downloaderService } from './downloader.js';
import { quotaManager } from './quotaManager.js';
import { keyManager } from './keyManager.js';

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
  const vipKey = req.headers['x-vip-key'] || req.query.vipKey || token;
  
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
    vip
  });
});

// 2. 取得目前使用者配額
app.get('/api/quota', (req, res) => {
  const identifier = getClientIdentifier(req);
  const vip = checkVipStatus(req);
  const quota = quotaManager.getUserStatus(identifier, vip.isVip);

  res.json({
    success: true,
    identifier,
    vip,
    quota,
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

    // 測試解析
    try {
      const { stdout } = await execAsync('yt-dlp --dump-json --no-playlist --skip-download --extractor-args "youtube:player_client=android_vr,ios,mweb,android" --socket-timeout 20 "https://www.youtube.com/watch?v=uLU6GE88vvU"');
      const j = JSON.parse(stdout);
      testParse = `SUCCESS: ${j.title} (${j.formats?.length || 0} formats, max: ${j.height}p)`;
    } catch (e) {
      testParse = `FAIL: ${e.stderr || e.stdout || e.message}`;
    }

    res.json({
      success: true,
      path: whichYt,
      initialVersion: ytVer,
      newVersion: newVer,
      updateLog,
      testParse
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

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 RPJG 影音流體極速下載終端後端核心已啟動`);
  console.log(`🌐 服務埠號: http://localhost:${PORT}`);
  console.log(`🛡️ 每日免費額度限制: 1 次 / 天 (午夜自動重置)`);
  console.log(`💎 官方購買與支援 Discord: ${DISCORD_INVITE_URL}`);
  console.log(`👑 總控管理員專用核心金鑰: 065R.P.J.G`);
  console.log(`======================================================\n`);
});

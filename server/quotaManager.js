import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const QUOTA_FILE = path.join(DATA_DIR, 'quota.json');

// 確保 data 資料夾存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 取得今日日期字串 YYYY-MM-DD (台灣時區 UTC+8)
function getTodayDateStr() {
  const d = new Date();
  const twTime = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const y = twTime.getFullYear();
  const m = String(twTime.getMonth() + 1).padStart(2, '0');
  const day = String(twTime.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 計算距離台灣時間今日午夜 23:59:59 的剩餘秒數
function getSecondsUntilMidnight() {
  const d = new Date();
  const twTime = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const midnight = new Date(twTime);
  midnight.setHours(23, 59, 59, 999);
  return Math.max(0, Math.floor((midnight.getTime() - twTime.getTime()) / 1000));
}

class QuotaManager {
  constructor() {
    this.records = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(QUOTA_FILE)) {
        const raw = fs.readFileSync(QUOTA_FILE, 'utf-8');
        this.records = JSON.parse(raw);
      } else {
        this.records = {};
        this.save();
      }
    } catch (e) {
      console.error('[QuotaManager] 載入配額檔案失敗，使用空資料:', e);
      this.records = {};
    }
  }

  save() {
    try {
      fs.writeFileSync(QUOTA_FILE, JSON.stringify(this.records, null, 2), 'utf-8');
    } catch (e) {
      console.error('[QuotaManager] 儲存配額檔案失敗:', e);
    }
  }

  getRecord(identifier) {
    this.load(); // 保持與磁碟最新數據同步
    const today = getTodayDateStr();
    const entry = this.records[identifier];

    if (!entry || entry.date !== today) {
      return {
        identifier,
        date: today,
        downloadsCount: 0,
        lastDownloadAt: null
      };
    }
    return entry;
  }

  getUserStatus(identifier, isVip = false) {
    const record = this.getRecord(identifier);
    const maxDaily = isVip ? Infinity : 1; // 免費使用者每日 1 次
    const used = record.downloadsCount || 0;
    const remaining = isVip ? 9999 : Math.max(0, maxDaily - used);
    const secondsRemaining = getSecondsUntilMidnight();

    return {
      identifier,
      date: record.date,
      isVip,
      usedToday: used,
      maxDaily: isVip ? 'UNLIMITED' : maxDaily,
      remainingToday: isVip ? 'UNLIMITED' : remaining,
      canDownload: isVip || remaining > 0,
      resetInSeconds: secondsRemaining
    };
  }

  canDownload(identifier, isVip = false) {
    if (isVip) return true;
    const status = this.getUserStatus(identifier, false);
    return status.canDownload;
  }

  recordDownload(identifier, mediaInfo = {}) {
    const today = getTodayDateStr();
    const record = this.getRecord(identifier);

    record.date = today;
    record.downloadsCount = (record.downloadsCount || 0) + 1;
    record.lastDownloadAt = new Date().toISOString();
    record.lastDownloadedTitle = mediaInfo.title || '未知標題';

    this.records[identifier] = record;
    this.save();

    return record;
  }

  // === 素材下載專屬配額 (免費使用者每日限定 2 張，VIP 永久無限制) ===
  getMaterialStatus(identifier, isVip = false) {
    const record = this.getRecord(identifier);
    const maxDaily = isVip ? Infinity : 2; // 免費使用者素材每日限定 2 張
    const used = record.materialsCount || 0;
    const remaining = isVip ? 9999 : Math.max(0, maxDaily - used);
    const secondsRemaining = getSecondsUntilMidnight();

    return {
      identifier,
      date: record.date,
      isVip,
      usedToday: used,
      maxDaily: isVip ? 'UNLIMITED' : maxDaily,
      remainingToday: isVip ? 'UNLIMITED' : remaining,
      canDownload: isVip || remaining > 0,
      resetInSeconds: secondsRemaining
    };
  }

  canDownloadMaterial(identifier, isVip = false) {
    if (isVip) return true;
    const status = this.getMaterialStatus(identifier, false);
    return status.canDownload;
  }

  recordMaterialDownload(identifier, info = {}) {
    const today = getTodayDateStr();
    const record = this.getRecord(identifier);

    record.date = today;
    record.materialsCount = (record.materialsCount || 0) + 1;
    record.lastMaterialAt = new Date().toISOString();

    this.records[identifier] = record;
    this.save();

    return record;
  }

  // 若發起失敗進行配額退還
  refundQuota(identifier) {
    const record = this.getRecord(identifier);
    if (record && record.downloadsCount > 0) {
      record.downloadsCount -= 1;
      this.records[identifier] = record;
      this.save();
    }
  }

  // 供測試或管理員重置配額
  resetUser(identifier) {
    delete this.records[identifier];
    this.save();
    return true;
  }
}

export const quotaManager = new QuotaManager();

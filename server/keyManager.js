import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const KEYS_FILE = path.join(DATA_DIR, 'vip_keys.json');

// 總控特權金鑰清單：065R.P.J.G 與 0815065 皆具備派發、停用、生成金鑰之完整管理員權限
const MASTER_ADMIN_KEYS = ['065R.P.J.G', '0815065'];

const DEFAULT_VIP_KEYS = [
  {
    key: '065R.P.J.G',
    description: 'RPJG 最高級總控管理員專用核心金鑰 (永久無限制)',
    tier: 'MASTER_ADMIN',
    role: '最高級總控管理員',
    maxUses: Infinity,
    usedCount: 0,
    disabled: false,
    expiresAt: null,
    createdAt: new Date().toISOString()
  },
  {
    key: '0815065',
    description: 'RPJG 總控派發管理專用金鑰 (具備金鑰生成與停用特權)',
    tier: 'MASTER_ADMIN',
    role: '最高級總控管理員',
    maxUses: Infinity,
    usedCount: 0,
    disabled: false,
    expiresAt: null,
    createdAt: new Date().toISOString()
  },
  {
    key: 'RPJG-VIP-LIFETIME',
    description: 'RPJG Discord VIP 永久尊爵卡',
    tier: 'VIP_LIFETIME',
    role: 'RPJG VIP 尊爵會員',
    maxUses: 100,
    usedCount: 0,
    disabled: false,
    expiresAt: null,
    createdAt: new Date().toISOString()
  }
];

class KeyManager {
  constructor() {
    this.keys = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(KEYS_FILE)) {
        const raw = fs.readFileSync(KEYS_FILE, 'utf-8');
        this.keys = JSON.parse(raw);
      } else {
        this.keys = DEFAULT_VIP_KEYS;
        this.save();
      }
    } catch (e) {
      console.error('[KeyManager] 載入金鑰資料失敗，使用預設金鑰:', e);
      this.keys = DEFAULT_VIP_KEYS;
    }
  }

  save() {
    try {
      fs.writeFileSync(KEYS_FILE, JSON.stringify(this.keys, null, 2), 'utf-8');
    } catch (e) {
      console.error('[KeyManager] 儲存金鑰失敗:', e);
    }
  }

  validateKey(keyStr) {
    this.load();
    if (!keyStr) return { valid: false, message: '請輸入金鑰' };
    const trimmed = keyStr.trim();

    // 總控最高權限金鑰直通 (065R.P.J.G 與 0815065)
    if (MASTER_ADMIN_KEYS.includes(trimmed)) {
      return {
        valid: true,
        tier: 'MASTER_ADMIN',
        role: '最高級總控管理員',
        description: 'RPJG 總控核心金鑰 - 具備金鑰派發、停用與無限制極速通道',
        expiresAt: null,
        isMaster: true
      };
    }

    const item = this.keys.find(k => k.key.toUpperCase() === trimmed.toUpperCase());
    if (!item) {
      return { valid: false, message: '此 VIP 啟用碼不存在或輸入錯誤，請確認後重試' };
    }

    if (item.disabled) {
      return { valid: false, message: '⚠️ 此 VIP 金鑰已被管理員停用或作廢，請洽詢官方 Discord' };
    }

    if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) {
      return { valid: false, message: '此 VIP 金鑰已過期，請至 Discord 續費' };
    }

    if (item.maxUses && item.usedCount >= item.maxUses) {
      return { valid: false, message: '此金鑰兌換次數已達上限' };
    }

    return {
      valid: true,
      tier: item.tier || 'VIP',
      role: item.role || (item.tier === 'MASTER_ADMIN' ? '最高級總控管理員' : 'RPJG VIP 尊爵會員'),
      description: item.description,
      expiresAt: item.expiresAt,
      isMaster: item.tier === 'MASTER_ADMIN' || MASTER_ADMIN_KEYS.includes(item.key)
    };
  }

  redeemKey(keyStr) {
    const check = this.validateKey(keyStr);
    if (!check.valid) return check;

    const trimmed = keyStr.trim();
    const item = this.keys.find(k => k.key.toUpperCase() === trimmed.toUpperCase());
    if (item) {
      item.usedCount = (item.usedCount || 0) + 1;
      this.save();
    }

    return check;
  }

  // 派發金鑰：支援 1 天、1 週 (7天)、1 個月 (30天)、永久 (0天)
  generateKey({ days = 30, description = '' } = {}) {
    this.load();
    const d = parseInt(days, 10);
    let keyPrefix = 'RPJG-KEY';
    let defaultDesc = 'Discord 購買授權';
    let actualTier = 'VIP_MONTHLY';

    if (d === 1) {
      keyPrefix = 'RPJG-1DAY';
      actualTier = 'VIP_DAILY';
      defaultDesc = '1 天體驗卡';
    } else if (d === 7) {
      keyPrefix = 'RPJG-WEEK';
      actualTier = 'VIP_WEEKLY';
      defaultDesc = '1 週週卡';
    } else if (d === 30) {
      keyPrefix = 'RPJG-MONTH';
      actualTier = 'VIP_MONTHLY';
      defaultDesc = '1 個月月卡';
    } else if (d === 0 || d === -1) {
      keyPrefix = 'RPJG-PERM';
      actualTier = 'VIP_LIFETIME';
      defaultDesc = '永久尊爵卡';
    }

    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const key = `${keyPrefix}-${randomHex}`;

    let expiresAt = null;
    if (d > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + d);
      expiresAt = expDate.toISOString();
    }

    const newEntry = {
      key,
      description: description || defaultDesc,
      tier: actualTier,
      role: d === 0 ? 'RPJG 永久尊爵會員' : `RPJG VIP (${d === 1 ? '1天' : d === 7 ? '1週' : '30天'})`,
      maxUses: 1,
      usedCount: 0,
      disabled: false,
      expiresAt,
      createdAt: new Date().toISOString()
    };

    this.keys.unshift(newEntry); // 新金鑰置頂
    this.save();
    return newEntry;
  }

  // 切換金鑰啟用 / 停用狀態
  toggleDisableKey(keyStr) {
    this.load();
    if (!keyStr) return { success: false, message: '請指定金鑰' };
    const target = keyStr.trim().toUpperCase();

    if (MASTER_ADMIN_KEYS.map(k => k.toUpperCase()).includes(target)) {
      return { success: false, message: '總控核心金鑰不可停用' };
    }

    const item = this.keys.find(k => k.key.toUpperCase() === target);
    if (!item) return { success: false, message: '找不到此金鑰' };

    item.disabled = !item.disabled;
    this.save();
    return { success: true, disabled: item.disabled, key: item.key };
  }

  // 刪除金鑰
  deleteKey(keyStr) {
    this.load();
    if (!keyStr) return { success: false, message: '請指定金鑰' };
    const target = keyStr.trim().toUpperCase();

    if (MASTER_ADMIN_KEYS.map(k => k.toUpperCase()).includes(target)) {
      return { success: false, message: '總控核心金鑰不可刪除' };
    }

    const idx = this.keys.findIndex(k => k.key.toUpperCase() === target);
    if (idx === -1) return { success: false, message: '找不到此金鑰' };

    this.keys.splice(idx, 1);
    this.save();
    return { success: true, message: '已成功刪除此金鑰' };
  }

  listKeys() {
    this.load();
    return this.keys.map(k => ({
      ...k,
      isExpired: k.expiresAt ? new Date(k.expiresAt).getTime() < Date.now() : false
    }));
  }
}

export const keyManager = new KeyManager();

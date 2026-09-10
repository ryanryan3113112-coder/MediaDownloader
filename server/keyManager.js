import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const KEYS_FILE = path.join(DATA_DIR, 'vip_keys.json');

const MASTER_ADMIN_KEY = '065R.P.J.G';

const DEFAULT_VIP_KEYS = [
  {
    key: MASTER_ADMIN_KEY,
    description: 'RPJG 最高級總控管理員專用核心金鑰 (永久無限制)',
    tier: 'MASTER_ADMIN',
    maxUses: Infinity,
    usedCount: 0,
    expiresAt: null, // 永久
    createdAt: new Date().toISOString()
  },
  {
    key: 'RPJG-VIP-LIFETIME',
    description: 'RPJG Discord VIP 永久尊爵卡',
    tier: 'VIP_LIFETIME',
    maxUses: 100,
    usedCount: 0,
    expiresAt: null,
    createdAt: new Date().toISOString()
  },
  {
    key: 'RPJG-VIP-PRO-2026',
    description: 'RPJG 2026 年度旗艦會員',
    tier: 'VIP_YEARLY',
    maxUses: 50,
    usedCount: 0,
    expiresAt: '2026-12-31T23:59:59.000Z',
    createdAt: new Date().toISOString()
  },
  {
    key: '0815065',
    description: 'RPJG 測試專用體驗金鑰 (無限制極速下載)',
    tier: 'VIP_BETA',
    role: 'RPJG 測試體驗官',
    maxUses: 99999,
    usedCount: 0,
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
    this.load(); // 即時載入最新檔案
    if (!keyStr) return { valid: false, message: '請輸入金鑰' };
    const trimmed = keyStr.trim();

    // 總控最高權限金鑰直通
    if (trimmed === MASTER_ADMIN_KEY) {
      return {
        valid: true,
        tier: 'MASTER_ADMIN',
        role: '最高級管理員',
        description: 'RPJG 總控核心金鑰 - 解鎖最高畫質與無限制極速通道',
        expiresAt: null,
        isMaster: true
      };
    }

    const item = this.keys.find(k => k.key.toUpperCase() === trimmed.toUpperCase());
    if (!item) {
      return { valid: false, message: '此 VIP 啟用碼不存在或輸入錯誤，請確認後重試' };
    }

    if (item.disabled) {
      return { valid: false, message: '此 VIP 金鑰已被停用或作廢' };
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
      role: item.role || (item.tier === 'MASTER_ADMIN' ? '最高級管理員' : 'RPJG VIP 尊爵會員'),
      description: item.description,
      expiresAt: item.expiresAt,
      isMaster: item.tier === 'MASTER_ADMIN'
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

  generateKey({ tier = 'VIP_MONTHLY', days = 30, description = 'Discord 購買授權' } = {}) {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const key = `RPJG-${tier.replace('VIP_', '')}-${randomHex}`;
    
    let expiresAt = null;
    if (days && days > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + days);
      expiresAt = expDate.toISOString();
    }

    const newEntry = {
      key,
      description,
      tier,
      maxUses: 1,
      usedCount: 0,
      expiresAt,
      createdAt: new Date().toISOString()
    };

    this.keys.push(newEntry);
    this.save();
    return newEntry;
  }

  listKeys() {
    return this.keys.map(k => ({
      ...k,
      isExpired: k.expiresAt ? new Date(k.expiresAt).getTime() < Date.now() : false
    }));
  }
}

export const keyManager = new KeyManager();

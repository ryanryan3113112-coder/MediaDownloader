import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Download,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Layers,
  FileCode2,
  FolderDown,
  AlertCircle,
  HelpCircle,
  Trash2,
  Compass,
  Crown,
  Link2,
  Code,
  FileText,
  Loader2
} from 'lucide-react';

// 學生常用防盜連示範素材（包含用戶指定的 PNGtree 網頁與全網圖床）
const DEMO_PRESETS = [
  {
    name: 'PNGtree 晚霞背景',
    site: 'PNGtree網頁',
    tag: '網頁提取直連',
    url: 'https://zh.pngtree.com/freebackground/abstract-cloudy-background-beautiful-natural-streaks-of-sky-and-clouds-red-sky-at-sunset_15506155.html'
  },
  {
    name: 'B站高清頭像',
    site: 'Bilibili',
    tag: 'B站防盜連',
    url: 'https://i0.hdslb.com/bfs/face/member/noface.jpg'
  },
  {
    name: '新浪微博高清圖',
    site: 'Weibo',
    tag: '微博防盜連',
    url: 'https://tvax1.sinaimg.cn/crop.0.0.1080.1080.180/0060lm7Tly8h0w95ffuikj30u00u0gnz.jpg'
  },
  {
    name: 'Pinterest 晚霞原圖',
    site: 'Pinterest',
    tag: 'Pinterest直連',
    url: 'https://i.pinimg.com/originals/77/40/a2/7740a272b1e3460073303049c991972f.jpg'
  }
];

export default function MaterialHelper({
  apiBase = '',
  isDesktopApp = false,
  clientId = '',
  vip = { isVip: false },
  materialQuota = { usedToday: 0, maxDaily: 2, remainingToday: 2, canDownload: true },
  fetchQuota,
  onOpenPaywall
}) {
  const [inputUrl, setInputUrl] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [materialList, setMaterialList] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedType, setCopiedType] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);

  const isVip = vip && vip.isVip;
  const remaining = materialQuota ? materialQuota.remainingToday : 2;

  // 取得免防盜連代理完整直連外鏈 (可直接嵌入任何網頁、Discord、RPG Maker)
  const getFullProxyUrl = (rawUrl, download = false, filename = '') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3005';
    const base = apiBase || origin;
    const params = new URLSearchParams({
      url: rawUrl.trim()
    });
    if (download) params.set('download', '1');
    if (filename) params.set('filename', filename);
    if (clientId) params.set('clientId', clientId);
    if (vip?.key) params.set('vipKey', vip.key);
    return `${base}/api/proxy-image?${params.toString()}`;
  };

  // 快捷獲取相對或絕對 proxyUrl (供預覽使用)
  const getProxyUrl = (rawUrl, download = false, filename = '') => {
    return getFullProxyUrl(rawUrl, download, filename);
  };

  // 加入素材至清單 (支援單張圖片網址，亦支援 PNGtree / 網頁網址自動提取)
  const handleAddMaterial = async (urlToAdd) => {
    const target = (urlToAdd || inputUrl).trim();
    if (!target) return;

    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      showNotice('請輸入以 http:// 或 https:// 開頭的有效網址！', true);
      return;
    }

    if (isBatchMode) {
      const lines = target.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.startsWith('http'));
      if (lines.length === 0) return;
      const newItems = lines.map((u, idx) => ({
        id: `mat_${Date.now()}_${idx}`,
        rawUrl: u,
        title: `批次素材 #${idx + 1}`,
        typeBadge: '批次素材',
        addedAt: new Date().toLocaleTimeString(),
        filename: `material_${Date.now()}_${idx + 1}`
      }));
      setMaterialList(prev => [...newItems, ...prev]);
      setInputUrl('');
      showNotice(`已成功載入 ${newItems.length} 個素材連結！`);
      return;
    }

    // 判斷是否為普通網頁 (需透過後端 extract-page 自動萃取圖片)
    const lower = target.toLowerCase();
    const isDirectImage = lower.match(/\.(jpeg|jpg|png|webp|gif|avif|svg)(\?.*)?$/i) ||
      lower.includes('pximg.net') || lower.includes('sinaimg.cn') || lower.includes('hdslb.com') ||
      lower.includes('pinimg.com/originals') || lower.includes('pinimg.com/736x');

    if (!isDirectImage) {
      // 網頁解析流程 (如 PNGtree、Pixiv 網頁、部落格頁面)
      setIsExtracting(true);
      showNotice('🔍 正在從網頁中萃取真實素材照片，請稍候...');
      try {
        const res = await fetch(`${apiBase}/api/material/extract-page`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: target })
        });
        const data = await res.json();
        setIsExtracting(false);

        if (data.success && Array.isArray(data.images) && data.images.length > 0) {
          const newItems = data.images.map((img, idx) => ({
            id: `mat_${Date.now()}_${idx}`,
            rawUrl: img.url,
            sourcePage: target,
            title: img.title || data.title || '網頁照片素材',
            typeBadge: img.type || '網頁提取',
            addedAt: new Date().toLocaleTimeString(),
            filename: `material_${Date.now()}_${idx + 1}`
          }));
          setMaterialList(prev => [...newItems, ...prev]);
          setInputUrl('');
          showNotice(`🎉 成功從網頁提取 ${newItems.length} 張素材並轉換為直連外鏈！`);
        } else {
          showNotice(data.message || '未能在該網頁中直接偵測到公開圖片，建議在網頁照片上按右鍵複製圖片網址貼入', true);
        }
      } catch (err) {
        setIsExtracting(false);
        showNotice(`網頁解析通訊異常: ${err.message}`, true);
      }
    } else {
      // 直接圖片網址
      const newItem = {
        id: `mat_${Date.now()}`,
        rawUrl: target,
        title: '圖片素材',
        typeBadge: '原圖直連',
        addedAt: new Date().toLocaleTimeString(),
        filename: `material_${Date.now()}`
      };
      setMaterialList(prev => [newItem, ...prev.filter(x => x.rawUrl !== target)]);
      setInputUrl('');
      showNotice('🎉 素材已成功轉換為免防盜連直連連結！');
    }
  };

  const showNotice = (msg, isErr = false) => {
    setStatusNotice({ msg, isErr });
    setTimeout(() => setStatusNotice(null), 4000);
  };

  // 複製文字至剪貼簿
  const copyToClipboard = (text, id, type) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setCopiedType(type);
    setTimeout(() => {
      setCopiedId(null);
      setCopiedType(null);
    }, 2000);
  };

  // 1. 下載原圖 (檢查每日 2 張配額)
  const handleDownloadOriginal = async (item) => {
    if (!isVip && remaining <= 0) {
      showNotice('今日免費素材下載次數已達上限 (每日限定 2 張)！請升級 VIP', true);
      if (onOpenPaywall) onOpenPaywall();
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json', 'x-client-id': clientId };
      if (vip?.key) headers['x-vip-key'] = vip.key;

      // 扣除素材下載配額
      const res = await fetch(`${apiBase}/api/material/consume-quota`, {
        method: 'POST',
        headers
      });
      const data = await res.json();

      if (!res.ok || data.code === 'QUOTA_EXCEEDED') {
        showNotice(data.message || '今日免費素材下載次數已達上限 (每日限定 2 張)！', true);
        if (onOpenPaywall) onOpenPaywall();
        if (fetchQuota) fetchQuota();
        return;
      }

      // 觸發真實瀏覽器下載
      const dlUrl = getProxyUrl(item.rawUrl, true, `${item.filename}.png`);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `${item.filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (fetchQuota) fetchQuota();
      showNotice('🎉 圖片下載中！已扣除 1 張今日素材額度');
    } catch (err) {
      showNotice(`下載失敗: ${err.message}`, true);
    }
  };

  // 2. 將圖片透過 Canvas 轉換為 PNG 格式並觸發下載 (檢查每日 2 張配額)
  const convertAndDownloadPng = async (rawUrl, filename) => {
    if (!isVip && remaining <= 0) {
      showNotice('今日免費素材下載次數已達上限 (每日限定 2 張)！請升級 VIP', true);
      if (onOpenPaywall) onOpenPaywall();
      return;
    }

    setIsConverting(true);
    try {
      const headers = { 'Content-Type': 'application/json', 'x-client-id': clientId };
      if (vip?.key) headers['x-vip-key'] = vip.key;

      const res = await fetch(`${apiBase}/api/material/consume-quota`, {
        method: 'POST',
        headers
      });
      const data = await res.json();

      if (!res.ok || data.code === 'QUOTA_EXCEEDED') {
        setIsConverting(false);
        showNotice(data.message || '今日免費素材下載次數已達上限 (每日限定 2 張)！', true);
        if (onOpenPaywall) onOpenPaywall();
        if (fetchQuota) fetchQuota();
        return;
      }

      if (fetchQuota) fetchQuota();

      // 執行 Canvas 轉檔
      const proxyUrl = getProxyUrl(rawUrl);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((blob) => {
            if (!blob) {
              showNotice('轉換失敗，伺服器可能不允許跨域 Canvas 讀取', true);
              setIsConverting(false);
              return;
            }
            const dlUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = dlUrl;
            a.download = `${filename || 'material'}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(dlUrl);
            setIsConverting(false);
            showNotice('🎉 成功轉碼並下載高畫質 PNG！相容 RPG Maker (已計 1 次額度)');
          }, 'image/png');
        } catch (err) {
          setIsConverting(false);
          showNotice(`轉換錯誤: ${err.message}`, true);
        }
      };
      img.onerror = () => {
        setIsConverting(false);
        showNotice('載入圖片失敗，請確認網址是否有效', true);
      };
      img.src = proxyUrl;
    } catch (err) {
      setIsConverting(false);
      showNotice(`通訊失敗: ${err.message}`, true);
    }
  };

  // 3. 複製 Base64 Data URI (免額度，方便寫程式碼)
  const copyBase64Data = (rawUrl, id) => {
    const proxyUrl = getProxyUrl(rawUrl);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        copyToClipboard(dataUrl, id, 'base64');
        showNotice('✅ 已複製 Base64 代碼！可直接寫入 CSS 或 HTML 程式碼中');
      } catch (err) {
        showNotice(`Base64 擷取失敗: ${err.message}`, true);
      }
    };
    img.onerror = () => {
      showNotice('載入圖片失敗', true);
    };
    img.src = proxyUrl;
  };

  // 4. 本地端直接儲存至本機資料夾 (僅限桌面版或本地環境，檢查每日 2 張配額)
  const handleSaveToLocalFolder = async (rawUrl, filename) => {
    if (!isVip && remaining <= 0) {
      showNotice('今日免費素材下載次數已達上限 (每日限定 2 張)！請升級 VIP', true);
      if (onOpenPaywall) onOpenPaywall();
      return;
    }

    try {
      showNotice('正在保存素材至電腦本機資料夾...');
      const headers = { 'Content-Type': 'application/json', 'x-client-id': clientId };
      if (vip?.key) headers['x-vip-key'] = vip.key;

      const res = await fetch(`${apiBase}/api/material/save-local`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: rawUrl,
          filename: `${filename || 'material'}.png`
        })
      });
      const data = await res.json();
      if (data.success) {
        if (fetchQuota) fetchQuota();
        showNotice(`🎉 素材已存入電腦！檔名：${data.filename} (已扣 1 張額度)`);
      } else {
        if (data.code === 'QUOTA_EXCEEDED' && onOpenPaywall) {
          onOpenPaywall();
        }
        showNotice(`保存失敗: ${data.message}`, true);
      }
    } catch (err) {
      showNotice(`本地通訊異常: ${err.message}`, true);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* 標題與簡介 */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>學生創作專用 • 免防盜連素材助手</span>
          {isVip ? (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center space-x-1">
              <Crown className="w-3 h-3 text-amber-400" />
              <span>VIP 永久無限下載</span>
            </span>
          ) : (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              remaining > 0
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}>
              今日下載剩餘：{remaining} / 2 張 (午夜重置)
            </span>
          )}
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
          貼上任何網頁或防盜連網址，<span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400">一秒轉為直接可用外鏈</span>
        </h2>

        <p className="mt-3 text-xs sm:text-sm text-gray-400 leading-relaxed max-w-2xl mx-auto">
          專為 RPG Maker、網頁設計作業、Discord Bot 與簡報學生打造！支援 PNGtree、Pixiv、B站、微博、知乎等全網素材。自動偽造與剝除 Referer 標頭，貼上網址立即產生可直接嵌入的直連外鏈，免費版每日限定下載 2 張素材！
        </p>
      </div>

      {/* 狀態訊息提示通知 */}
      {statusNotice && (
        <div className={`p-3.5 px-5 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between transition-all ${
          statusNotice.isErr
            ? 'bg-rose-950/80 border border-rose-800 text-rose-200 shadow-lg shadow-rose-950/40'
            : 'bg-emerald-950/80 border border-emerald-800 text-emerald-200 shadow-lg shadow-emerald-950/40'
        }`}>
          <div className="flex items-center space-x-2.5">
            {statusNotice.isErr ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{statusNotice.msg}</span>
          </div>
          <button
            onClick={() => setStatusNotice(null)}
            className="text-gray-400 hover:text-white text-xs ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* 快捷示範按鈕區 */}
      <div className="bg-[#0c1222]/80 border border-slate-800/80 p-4 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-gray-400">
          <div className="flex items-center space-x-1.5 font-semibold text-gray-300">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>學生常用防盜連網站測試樣本（點擊直接一鍵解析）：</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsBatchMode(!isBatchMode)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                isBatchMode
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {isBatchMode ? '切換為：單一網址模式' : '切換為：批次多行模式'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DEMO_PRESETS.map((demo, idx) => (
            <button
              key={idx}
              onClick={() => handleAddMaterial(demo.url)}
              disabled={isExtracting}
              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/60 text-left transition group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                  {demo.site}
                </span>
                <span className="text-[10px] text-gray-500 group-hover:text-cyan-400 transition">
                  {demo.tag} ➔
                </span>
              </div>
              <div className="text-xs font-semibold text-gray-200 truncate">
                {demo.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 網址輸入面板 */}
      <div className="bg-[#0c1222] border border-[#1e293b] rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              <span>{isBatchMode ? '輸入多張圖片網址（每行一個）：' : '貼上網址（支援 PNGtree 等網頁連結 或 圖片直連）：'}</span>
            </span>
            {materialList.length > 0 && (
              <button
                onClick={() => setMaterialList([])}
                className="text-[11px] text-gray-500 hover:text-rose-400 flex items-center space-x-1 transition"
              >
                <Trash2 className="w-3 h-3" />
                <span>清空素材清單</span>
              </button>
            )}
          </label>

          {isBatchMode ? (
            <textarea
              rows={4}
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://zh.pngtree.com/...&#10;https://i0.hdslb.com/...&#10;https://tvax1.sinaimg.cn/..."
              className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono transition"
            />
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isExtracting && handleAddMaterial()}
                placeholder="貼上網頁或圖片網址，例如：https://zh.pngtree.com/... 或 https://i0.hdslb.com/..."
                className="flex-1 bg-[#070b14] border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition"
              />
              <button
                onClick={() => handleAddMaterial()}
                disabled={isExtracting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 flex items-center space-x-2 shrink-0 transition"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>解析萃取中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>轉成直接可用連結</span>
                  </>
                )}
              </button>
            </div>
          )}

          {isBatchMode && (
            <button
              onClick={() => handleAddMaterial()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg flex items-center justify-center space-x-2 transition"
            >
              <Layers className="w-4 h-4" />
              <span>批次載入並轉換全部素材</span>
            </button>
          )}
        </div>
      </div>

      {/* 素材展示畫廊與工具面板 */}
      {materialList.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold text-gray-300">
              已解析素材畫廊 ({materialList.length} 件)
            </span>
            <span className="text-[11px] text-gray-500">
              💡 提示：點擊「另存為 PNG」可自動轉碼相容 RPG Maker 遊戲引擎
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {materialList.map((item) => {
              const proxyUrl = getProxyUrl(item.rawUrl);

              return (
                <div
                  key={item.id}
                  className="bg-[#0c1222] border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-xl flex flex-col justify-between space-y-4 transition group"
                >
                  {/* 圖片預覽區 (有棋盤格背景，方便檢視透明素材) */}
                  <div className="relative w-full h-56 rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 flex items-center justify-center">
                    {/* 透明背景網格 */}
                    <div
                      className="absolute inset-0 opacity-15"
                      style={{
                        backgroundImage: `radial-gradient(#475569 1px, transparent 1px)`,
                        backgroundSize: '12px 12px'
                      }}
                    />

                    <img
                      src={proxyUrl}
                      alt="素材預覽"
                      className="relative max-w-full max-h-full object-contain z-10 select-none group-hover:scale-[1.02] transition duration-300"
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = item.rawUrl;
                        e.target.referrerPolicy = 'no-referrer';
                      }}
                    />

                    {/* 右上角快捷狀態標籤 */}
                    <div className="absolute top-2.5 right-2.5 z-20 flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-emerald-400 text-[10px] font-mono border border-emerald-500/30">
                        {item.typeBadge || '免防盜連直連'}
                      </span>
                    </div>
                  </div>

                  {/* 標題與原始網址預覽 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-200">
                      <span className="truncate max-w-[280px]">
                        {item.title || '素材照片'}
                      </span>
                      <a
                        href={item.sourcePage || item.rawUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 shrink-0 ml-2 flex items-center space-x-1 text-[11px]"
                        title="開啟原網址"
                      >
                        <span>來源頁面</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-[11px] text-gray-500 truncate font-mono">
                      原圖: {item.rawUrl}
                    </div>
                  </div>

                  {/* 核心重點：可以直接使用的連結 (免防盜連外鏈) 區塊 */}
                  <div className="bg-[#070b14] border border-emerald-500/30 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-emerald-300 flex items-center space-x-1.5">
                        <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>可以直接使用的連結 (破除 403)</span>
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">免 Referer 限制</span>
                    </div>

                    {/* 外鏈網址輸入框 + 複製按鈕 */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={proxyUrl}
                        className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-emerald-200 font-mono select-all focus:outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard(proxyUrl, item.id, 'url')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 flex items-center space-x-1 transition shadow"
                        title="複製直接外鏈網址"
                      >
                        {copiedId === item.id && copiedType === 'url' ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>已複製</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>複製外鏈</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* 快捷標籤代碼複製：HTML 標籤 & Markdown 語法 */}
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <button
                        onClick={() => copyToClipboard(`<img src="${proxyUrl}" alt="${item.title || '素材'}" />`, item.id, 'html')}
                        className="py-1 px-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-gray-300 text-[11px] font-mono flex items-center justify-center space-x-1 transition border border-slate-700/60"
                        title="複製 HTML <img> 標籤代碼"
                      >
                        <Code className="w-3 h-3 text-cyan-400" />
                        <span>{copiedId === item.id && copiedType === 'html' ? '已複製 <img>' : '複製 HTML 標籤'}</span>
                      </button>

                      <button
                        onClick={() => copyToClipboard(`![${item.title || '素材'}](${proxyUrl})`, item.id, 'md')}
                        className="py-1 px-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-gray-300 text-[11px] font-mono flex items-center justify-center space-x-1 transition border border-slate-700/60"
                        title="複製 Markdown 圖片語法"
                      >
                        <FileText className="w-3 h-3 text-amber-400" />
                        <span>{copiedId === item.id && copiedType === 'md' ? '已複製 MD' : '複製 Markdown'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 操作按鈕群 (下載、另存為 PNG、Base64) */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                    {/* 1. 下載原圖 (每日限定 2 張) */}
                    <button
                      onClick={() => handleDownloadOriginal(item)}
                      className="px-2 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-gray-200 text-xs font-semibold flex items-center justify-center space-x-1 transition border border-slate-700/50"
                      title="下載原始圖片（免費版每日限定 2 張）"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>下載原圖</span>
                    </button>

                    {/* 2. 另存為 PNG (Canvas 轉碼，相容 RPG Maker，每日限定 2 張) */}
                    <button
                      onClick={() => convertAndDownloadPng(item.rawUrl, item.filename)}
                      disabled={isConverting}
                      className="px-2 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-xs font-semibold flex items-center justify-center space-x-1 transition border border-emerald-800/50"
                      title="自動轉換為無損 PNG 格式，適用於 RPG Maker MV/MZ/XP 等遊戲引擎（免費版每日限定 2 張）"
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>轉為 PNG</span>
                    </button>

                    {/* 3. 複製 Base64 代碼 (離線嵌入專用) */}
                    <button
                      onClick={() => copyBase64Data(item.rawUrl, item.id)}
                      className="px-2 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-gray-300 text-xs font-semibold flex items-center justify-center space-x-1 transition border border-slate-700/50"
                      title="複製 Base64 代碼，可直接貼入 HTML/CSS 免聯網載入"
                    >
                      {copiedId === item.id && copiedType === 'base64' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">已複製</span>
                        </>
                      ) : (
                        <>
                          <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>複製 Base64</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 桌面版專屬：本機一鍵儲存 */}
                  {isDesktopApp && (
                    <button
                      onClick={() => handleSaveToLocalFolder(item.rawUrl, item.filename)}
                      className="w-full py-2 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 text-xs font-bold flex items-center justify-center space-x-1.5 transition border border-cyan-800/40"
                    >
                      <FolderDown className="w-3.5 h-3.5 text-cyan-400" />
                      <span>📂 直接存入本機「下載/RPJG_Downloads/Materials」</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 空狀態引導 */
        <div className="bg-[#0c1222]/50 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-gray-500">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-gray-300">
            目前尚無解析素材
          </div>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            在上方輸入圖片連結，或點擊上方的「快捷測試樣本」，即可立即預覽並解鎖全網防盜連素材。
          </p>
        </div>
      )}

      {/* 學生創作指南與常見問題 */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 text-xs text-gray-400 space-y-3">
        <div className="flex items-center space-x-2 font-bold text-gray-200 text-sm">
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span>🎓 學生創作指南：為什麼網路上找的素材經常「破圖」？</span>
        </div>
        <ul className="list-disc list-inside space-y-1.5 text-gray-400 leading-relaxed">
          <li>
            <strong className="text-gray-300">防盜連原理：</strong>Pixiv、微博、B站等各大網站會檢查請求標頭中的 <code className="text-cyan-300 bg-slate-800 px-1 py-0.5 rounded">Referer</code>。如果發現你在自己的網頁或遊戲中直連，就會回傳 403 Forbidden 導致破圖。
          </li>
          <li>
            <strong className="text-gray-300">每日限定 2 次體驗：</strong>免費使用者每日享有 2 次素材下載或轉碼額度，超過可前往 Discord 解鎖 VIP 永久無限制特權。
          </li>
          <li>
            <strong className="text-gray-300">RPG Maker / 遊戲引擎建議：</strong>許多遊戲引擎（如 RPG Maker MV/MZ/XP）只支援 PNG 格式，若網頁抓下來是 WebP 往往無法載入。請使用本工具的「<span className="text-emerald-400 font-semibold">另存為 PNG</span>」按鈕，可無損轉換格式並保留透明通道！
          </li>
        </ul>
      </div>
    </div>
  );
}

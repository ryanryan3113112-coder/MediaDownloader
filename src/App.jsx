import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import UrlInput from './components/UrlInput';
import MediaPreview from './components/MediaPreview';
import DownloadProgress from './components/DownloadProgress';
import PaywallModal from './components/PaywallModal';
import VipRedeemModal from './components/VipRedeemModal';
import LocalClientModal from './components/LocalClientModal';
import HistoryPanel from './components/HistoryPanel';
import MaterialHelper from './components/MaterialHelper';
import {
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  Radio,
  FileAudio,
  FileVideo,
  Award,
  AlertTriangle,
  ExternalLink,
  Download,
  Monitor,
  FolderOpen
} from 'lucide-react';

const DISCORD_URL = 'https://discord.gg/MDrNBbCBXz';

// 取得或初始化客戶端專屬識別碼 (Client Fingerprint)
function getOrCreateClientId() {
  let id = localStorage.getItem('rpjg_media_client_id');
  if (!id) {
    id = 'rpjg_usr_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    localStorage.setItem('rpjg_media_client_id', id);
  }
  return id;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('media');
  const [clientId] = useState(getOrCreateClientId);
  const [url, setUrl] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [mediaInfo, setMediaInfo] = useState(null);

  // VIP 與 配額狀態
  const [vip, setVip] = useState(() => {
    try {
      const saved = localStorage.getItem('rpjg_media_vip');
      return saved ? JSON.parse(saved) : { isVip: false };
    } catch {
      return { isVip: false };
    }
  });

  const [quota, setQuota] = useState({
    usedToday: 0,
    maxDaily: 1,
    remainingToday: 1,
    canDownload: true,
    resetInSeconds: 86400
  });

  // 素材下載配額狀態 (免費使用者每日限定 2 張)
  const [materialQuota, setMaterialQuota] = useState({
    usedToday: 0,
    maxDaily: 2,
    remainingToday: 2,
    canDownload: true,
    resetInSeconds: 86400
  });

  // 下載進度任務
  const [activeTask, setActiveTask] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);

  // 模態視窗開關
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [isLocalModalOpen, setIsLocalModalOpen] = useState(false);

  // 偵測是否直接在桌面 EXE 或本地環境中運行
  const isDesktopApp = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // 本地端連線模式 (Hybrid 雙引擎支援)
  const [isLocalMode, setIsLocalMode] = useState(() => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return true;
    }
    try {
      return localStorage.getItem('rpjg_local_mode') === 'true';
    } catch {
      return false;
    }
  });

  // 在桌面 EXE 內運行使用相對路徑，防止動態埠號失效；在雲端且開啟本地端時連線 3005
  const apiBase = isDesktopApp ? '' : (isLocalMode ? 'http://localhost:3005' : '');

  const toggleLocalMode = (val) => {
    setIsLocalMode(val);
    try {
      localStorage.setItem('rpjg_local_mode', val ? 'true' : 'false');
    } catch {}
  };

  const handleOpenDownloadFolder = async () => {
    try {
      const res = await fetch(`${apiBase}/api/open-folder`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert('開啟資料夾失敗：' + (data.message || '未知錯誤'));
      }
    } catch (err) {
      console.error('開啟資料夾失敗:', err);
    }
  };

  // 歷史紀錄
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('rpjg_media_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 1. 取得最新配額狀態
  const fetchQuota = useCallback(async () => {
    try {
      const headers = {
        'x-client-id': clientId
      };
      if (vip && vip.key) {
        headers['x-vip-key'] = vip.key;
      }
      const res = await fetch(`${apiBase}/api/quota`, { headers });
      const data = await res.json();
      if (data.success) {
        if (data.quota) setQuota(data.quota);
        if (data.materialQuota) setMaterialQuota(data.materialQuota);
        if (data.vip && data.vip.isVip) {
          setVip(prev => ({ ...prev, ...data.vip }));
        }
      }
    } catch (err) {
      console.error('取得配額失敗:', err);
    }
  }, [clientId, vip?.key, apiBase]);

  useEffect(() => {
    fetchQuota();
    // 倒數計時器每秒扣減剩餘時間
    const timer = setInterval(() => {
      setQuota(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          resetInSeconds: Math.max(0, (prev.resetInSeconds || 0) - 1)
        };
      });
      setMaterialQuota(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          resetInSeconds: Math.max(0, (prev.resetInSeconds || 0) - 1)
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchQuota]);

  // 2. 解析多媒體 URL
  const handleParseUrl = async () => {
    if (!url.trim()) return;
    setIsParsing(true);
    setParseError('');
    setMediaInfo(null);
    setDownloadProgress(null);

    try {
      const res = await fetch(`${apiBase}/api/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId
        },
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await res.json();

      if (data.success) {
        setMediaInfo(data.data);
      } else {
        setParseError(data.message || '無法解析此影音網址，請確認連結正確');
      }
    } catch (err) {
      setParseError('與後端通訊失敗，請檢查伺服器狀態');
    } finally {
      setIsParsing(false);
    }
  };

  // 3. 發起下載轉碼
  const handleStartDownload = async ({ url, type, quality, title }) => {
    // 免費使用者檢查是否超額
    if (!vip.isVip && quota.remainingToday <= 0) {
      setIsQuotaExceeded(true);
      setIsPaywallOpen(true);
      return;
    }

    setDownloadProgress({
      status: 'pending',
      percent: 0,
      phase: '正在向 RPJG 核心伺服器申請下載轉碼佇列...',
      speed: '',
      eta: ''
    });

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-client-id': clientId
      };
      if (vip && vip.key) {
        headers['x-vip-key'] = vip.key;
      }

      const res = await fetch(`${apiBase}/api/download`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, type, quality, title, clientId })
      });

      const data = await res.json();

      // 配額耗盡攔截
      if (res.status === 403 || data.code === 'QUOTA_EXCEEDED') {
        setDownloadProgress(null);
        setIsQuotaExceeded(true);
        setIsPaywallOpen(true);
        fetchQuota();
        return;
      }

      if (!data.success || !data.taskId) {
        setDownloadProgress({
          status: 'error',
          error: data.message || '發起下載任務失敗'
        });
        return;
      }

      // 順利建立任務，透過 SSE 監聽即時進度
      const taskId = data.taskId;
      setActiveTask(taskId);
      listenProgressSSE(taskId, { url, type, quality, title });
    } catch (err) {
      setDownloadProgress({
        status: 'error',
        error: '連線請求失敗：' + err.message
      });
    }
  };

  // 4. SSE 串流監聽
  const listenProgressSSE = (taskId, mediaMeta) => {
    const eventSource = new EventSource(`${apiBase}/api/progress/${taskId}`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const resolvedDlUrl = isLocalMode && payload.downloadUrl && !payload.downloadUrl.startsWith('http')
          ? `http://localhost:3005${payload.downloadUrl}`
          : payload.downloadUrl;

        setDownloadProgress({
          ...payload,
          downloadUrl: resolvedDlUrl
        });

        if (payload.status === 'completed') {
          eventSource.close();
          fetchQuota();

          // 寫入本地歷史紀錄
          const newEntry = {
            id: taskId,
            title: mediaMeta.title,
            type: mediaMeta.type,
            quality: mediaMeta.quality,
            downloadUrl: resolvedDlUrl,
            fileSize: payload.fileSize,
            time: Date.now()
          };
          setHistory(prev => {
            const next = [newEntry, ...prev].slice(0, 10);
            localStorage.setItem('rpjg_media_history', JSON.stringify(next));
            return next;
          });
        } else if (payload.status === 'error') {
          eventSource.close();
        }
      } catch (e) {
        console.error('解析 SSE 訊息異常:', e);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('SSE 連線中斷或關閉:', err);
      eventSource.close();
    };
  };

  // 5. 兌換 VIP
  const handleRedeemVip = async (key) => {
    try {
      const res = await fetch(`${apiBase}/api/vip/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      if (data.success && data.vip) {
        const vipData = {
          isVip: true,
          key: data.vip.key,
          tier: data.vip.tier,
          role: data.vip.role,
          description: data.vip.description,
          expiresAt: data.vip.expiresAt,
          isMaster: data.vip.isMaster
        };
        setVip(vipData);
        localStorage.setItem('rpjg_media_vip', JSON.stringify(vipData));
        fetchQuota();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || '金鑰無效' };
      }
    } catch (err) {
      return { success: false, message: '連線伺服器失敗' };
    }
  };

  // 解除 VIP 綁定
  const handleLogoutVip = () => {
    localStorage.removeItem('rpjg_media_vip');
    setVip({ isVip: false });
    fetchQuota();
  };

  // 清空歷史紀錄
  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('rpjg_media_history');
  };

  const handleRemoveHistoryItem = (id) => {
    setHistory(prev => {
      const next = prev.filter(i => i.id !== id);
      localStorage.setItem('rpjg_media_history', JSON.stringify(next));
      return next;
    });
  };

  const canDownloadNow = vip.isVip || (quota && quota.remainingToday > 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#070b14] text-gray-100 relative selection:bg-cyan-500 selection:text-black">
      {/* 背景賽博光網 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-cyan-900/10 via-indigo-900/5 to-transparent blur-3xl pointer-events-none" />

      {/* 導航列 */}
      <Header
        quota={quota}
        vip={vip}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPaywall={() => {
          setIsQuotaExceeded(!vip.isVip && quota.remainingToday <= 0);
          setIsPaywallOpen(true);
        }}
        onOpenVipModal={() => setIsVipModalOpen(true)}
        onOpenLocalModal={() => setIsLocalModalOpen(true)}
        isLocalMode={isLocalMode}
        discordUrl={DISCORD_URL}
      />

      {/* 主要內容區 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
        {/* 本地端 / 桌面版狀態橫幅 */}
        {isDesktopApp ? (
          <div className="w-full max-w-4xl mx-auto mb-6 p-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-cyan-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-200 shadow-xl shadow-emerald-950/20">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-lg shadow-emerald-400/50" />
              <div>
                <div className="font-bold text-white flex items-center space-x-2">
                  <span className="text-emerald-300">⚡ RPJG 影音流體桌面旗艦版已連線</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                    EXE 原生獨立引擎
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  享有最高優先頻寬與無損轉碼，下載完成將自動存入「下載 / RPJG_Downloads」
                </div>
              </div>
            </div>
            <button
              onClick={handleOpenDownloadFolder}
              className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold flex items-center space-x-1.5 transition shadow-sm"
              title="在檔案總管中開啟儲存目錄"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>📂 開啟下載資料夾</span>
            </button>
          </div>
        ) : (
          <div className="w-full max-w-4xl mx-auto mb-6 p-3 px-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-300 shadow-sm">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>
                💡 提示：若雲端受到 YouTube 機房限制無法運作，請下載【獨立桌面 EXE】，免安裝雙擊即可在電腦享有秒速下載！
              </span>
            </div>
            <button
              onClick={() => setIsLocalModalOpen(true)}
              className="shrink-0 text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 flex items-center space-x-1"
            >
              <span>💻 下載桌面版 EXE</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* 依據 activeTab 決定呈現「素材防盜連助手」或「影音下載」 */}
        {activeTab === 'material' ? (
          <MaterialHelper
            apiBase={apiBase}
            isDesktopApp={isDesktopApp}
            clientId={clientId}
            vip={vip}
            materialQuota={materialQuota}
            fetchQuota={fetchQuota}
            onOpenPaywall={() => {
              setIsQuotaExceeded(true);
              setIsPaywallOpen(true);
            }}
          />
        ) : (
          <>
            {/* 標題與簡介 */}
            <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>R.P.J.G 影音實驗室 • 旗艦級多媒體下載引擎</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            高畫質 <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">MP3 / MP4</span> 一鍵極速下載
          </h1>

          <p className="mt-3 text-sm sm:text-base text-gray-400 leading-relaxed max-w-2xl mx-auto">
            全網主流平台無縫相容，自動分離無損 320k 頂級音訊與 1080p 高畫質視頻。免費版每日享有 1 次下載體驗，超過額度可加入 Discord 解鎖永久無限下載！
          </p>
        </div>

        {/* 網址輸入區 */}
        <UrlInput
          url={url}
          setUrl={setUrl}
          onParse={handleParseUrl}
          isLoading={isParsing}
        />

        {/* 解析錯誤提示 + 下載本地端引導 */}
        {parseError && (
          <div className="w-full max-w-4xl mx-auto mt-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/60 via-[#0c1222] to-emerald-950/40 border border-rose-800/60 text-xs sm:text-sm text-gray-200 shadow-2xl space-y-3.5">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-bold text-rose-300 text-sm">
                  解析失敗：{parseError}
                </div>
                <div className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                  ⚡ <strong className="text-amber-300 font-bold">如果雲端無法運作，請下載獨立 EXE 桌面版！</strong><br />
                  YouTube 會對雲端機房 IP 進行嚴格訪問限制（429 錯誤）；下載「RPJG 桌面獨立版 EXE」免安裝、免指令，在您自己電腦上雙擊啟動，<strong>0 限制、秒速解析、畫質最高達 4K！</strong>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-800">
              <button
                onClick={() => setIsLocalModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition shadow-lg shadow-emerald-950/50"
              >
                <Monitor className="w-4 h-4" />
                <span>📥 免費下載 RPJG 桌面版 EXE (雙擊即用)</span>
              </button>

              <button
                onClick={handleParseUrl}
                className="px-3.5 py-2.5 rounded-xl text-xs text-gray-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
              >
                🔄 重新嘗試雲端解析
              </button>
            </div>
          </div>
        )}

        {/* 影音卡片與格式選擇 */}
        <MediaPreview
          mediaInfo={mediaInfo}
          onStartDownload={handleStartDownload}
          isDownloading={downloadProgress && downloadProgress.status === 'downloading'}
          isVip={vip.isVip}
          canDownload={canDownloadNow}
          onShowPaywall={() => {
            setIsQuotaExceeded(true);
            setIsPaywallOpen(true);
          }}
        />

        {/* 即時下載與轉碼進度條 */}
        <DownloadProgress
          progress={downloadProgress}
          onReset={() => {
            setDownloadProgress(null);
            setMediaInfo(null);
            setUrl('');
          }}
        />

        {/* 下載歷史紀錄 */}
        <HistoryPanel
          history={history}
          onClear={handleClearHistory}
          onRemoveItem={handleRemoveHistoryItem}
        />

        {/* 特色亮點介紹 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mt-12 pt-8 border-t border-[#1e293b]/60 text-xs">
          <div className="p-4 rounded-2xl bg-[#0d1322] border border-[#1e293b] flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileAudio className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white mb-1">320kbps MP3 頂級無損</div>
              <p className="text-gray-400 leading-relaxed">
                自動提取高品質純音訊，完整封裝專輯封面、歌手與標籤 Metadata。
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0d1322] border border-[#1e293b] flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FileVideo className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white mb-1">1080p / 4K MP4 高清影像</div>
              <p className="text-gray-400 leading-relaxed">
                採用專業級 FFmpeg 引擎進行視訊音軌智慧合成，畫質純淨無浮水印。
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0d1322] border border-[#1e293b] flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white mb-1">限額每日 1 次 • VIP 尊榮</div>
              <p className="text-gray-400 leading-relaxed">
                每日提供免費配額；超過即引導至官方 Discord 購買金鑰解鎖永久無限。
              </p>
            </div>
          </div>
        </div>
      </>
    )}
  </main>

      {/* 頁尾 */}
      <footer className="border-t border-[#1e293b] bg-[#090d16] py-6 text-xs text-gray-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-cyan-400 font-bold">RPJG MediaDownloader</span>
            <span>•</span>
            <span>作者：R.P.J.G 開發部門</span>
          </div>

          <div className="flex items-center space-x-4">
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5865F2] hover:underline flex items-center space-x-1"
            >
              <span>Discord 官方社群</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => setIsLocalModalOpen(true)}
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition flex items-center space-x-1"
            >
              <span>💻 下載本地極速端</span>
            </button>
            <button
              onClick={() => setIsVipModalOpen(true)}
              className="hover:text-gray-300 transition"
            >
              VIP 授權金鑰兌換
            </button>
          </div>
        </div>
      </footer>

      {/* 付費導購彈窗 (超額或點擊升級時開啟) */}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        onRedeem={handleRedeemVip}
        discordUrl={DISCORD_URL}
        isQuotaExceeded={isQuotaExceeded}
      />

      {/* VIP 啟用碼與管理員面板 */}
      <VipRedeemModal
        isOpen={isVipModalOpen}
        onClose={() => setIsVipModalOpen(false)}
        vip={vip}
        onRedeem={handleRedeemVip}
        onLogoutVip={handleLogoutVip}
        discordUrl={DISCORD_URL}
      />

      {/* 本地端下載與連線教學彈窗 */}
      <LocalClientModal
        isOpen={isLocalModalOpen}
        onClose={() => setIsLocalModalOpen(false)}
        isLocalMode={isLocalMode}
        onToggleLocalMode={toggleLocalMode}
      />
    </div>
  );
}

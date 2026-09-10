import React, { useState } from 'react';
import {
  X,
  Monitor,
  Download,
  Terminal,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Globe,
  Sparkles,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export default function LocalClientModal({
  isOpen,
  onClose,
  isLocalMode,
  onToggleLocalMode
}) {
  const [isTestingLocal, setIsTestingLocal] = useState(false);
  const [localStatus, setLocalStatus] = useState(null); // 'online' | 'offline' | null

  if (!isOpen) return null;

  const handleTestLocalConnection = async () => {
    setIsTestingLocal(true);
    try {
      const res = await fetch('http://localhost:3005/api/telemetry', {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      const data = await res.json();
      if (data.status === 'ONLINE' || data.success) {
        setLocalStatus('online');
        if (onToggleLocalMode && !isLocalMode) {
          onToggleLocalMode(true);
        }
      } else {
        setLocalStatus('offline');
      }
    } catch {
      setLocalStatus('offline');
    } finally {
      setIsTestingLocal(false);
    }
  };

  const GITHUB_ZIP_URL = 'https://github.com/ryanryan3113112-coder/MediaDownloader/archive/refs/heads/main.zip';
  const GITHUB_REPO_URL = 'https://github.com/ryanryan3113112-coder/MediaDownloader';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0c1222] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-gray-200">
        
        {/* 頂部裝飾光效 */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* 彈窗標頭 */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>RPJG 本地極速版</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  強烈推薦
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                如果雲端無法運作或速度較慢，請下載本地端在自己電腦上運行
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 彈窗主體內容 */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* 雲端 vs 本地對比說明 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center space-x-1.5 text-rose-400 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>☁️ 雲端線上版</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                受限於機房公開 IP，YouTube 經常觸發防爬蟲頻率限制（429 錯誤），可能導致解析失敗或需要排隊。
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs space-y-1.5">
              <div className="flex items-center space-x-1.5 text-emerald-300 font-bold">
                <Zap className="w-4 h-4" />
                <span>💻 本地極速版 (推薦)</span>
              </div>
              <p className="text-gray-300 leading-relaxed">
                直接使用您個人家用乾淨 IP，<strong>完全不受機房封鎖</strong>，秒速解析、畫質最高達 4K、下載頻寬完全滿速！
              </p>
            </div>
          </div>

          {/* 快速使用 3 步驟 */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center space-x-1.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>超簡單 3 步驟（免複雜安裝）</span>
            </h4>

            <div className="space-y-2.5 text-xs text-gray-300">
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <div>
                  <strong className="text-white">下載專案壓縮包：</strong> 點擊下方綠色按鈕直接下載完整程式包 (ZIP)。
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <div>
                  <strong className="text-white">解壓縮並雙擊啟動：</strong> 解開壓縮包後，在資料夾內直接雙擊 <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">啟動RPJG本地端.bat</code>。
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    * 若電腦尚未安裝 Node.js，啟動檔會自動為您開啟官網，下載安裝後即可。
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <div>
                  <strong className="text-white">自動開啟瀏覽器：</strong> 啟動檔會自動開啟 <code className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">http://localhost:3005</code>，隨開即用！
                </div>
              </div>
            </div>
          </div>

          {/* 下載操作按鈕 */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <a
              href={GITHUB_ZIP_URL}
              download
              className="flex-1 flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition shadow-lg shadow-emerald-950/50"
            >
              <Download className="w-4 h-4" />
              <span>一鍵下載完整程式包 (ZIP)</span>
            </a>

            <a
              href="/啟動RPJG本地端.bat"
              download="啟動RPJG本地端.bat"
              className="flex items-center justify-center space-x-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold border border-slate-700 hover:border-emerald-500/40 transition"
              title="若您已有原始碼，可單獨下載啟動腳本"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>單獨下載啟動檔 (.bat)</span>
            </a>

            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-200 text-xs font-semibold border border-slate-700 transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              <span>GitHub</span>
            </a>
          </div>

          {/* 連線本地端檢測 (Hybrid 引擎切換) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${isLocalMode || localStatus === 'online' ? 'bg-emerald-400' : 'bg-gray-500'}`} />
              <div>
                <div className="font-semibold text-gray-200">
                  {isLocalMode ? '⚡ 目前正在使用：本機引擎 (localhost:3005)' : '☁️ 目前正在使用：雲端伺服器'}
                </div>
                <div className="text-[11px] text-gray-400">
                  若您已在個人電腦執行本地端，可直接在本網頁切換為本機直連
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleTestLocalConnection}
                disabled={isTestingLocal}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
              >
                <RefreshCw className={`w-3 h-3 ${isTestingLocal ? 'animate-spin' : ''}`} />
                <span>{isTestingLocal ? '檢測中...' : '測試本機連線'}</span>
              </button>

              {onToggleLocalMode && (
                <button
                  onClick={() => onToggleLocalMode(!isLocalMode)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                    isLocalMode
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  {isLocalMode ? '切回雲端模式' : '切換本機模式'}
                </button>
              )}
            </div>
          </div>

          {localStatus === 'online' && (
            <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>檢測成功！您的本機 RPJG 下載核心正在運行中，已切換為本地高速模式！</span>
            </div>
          )}

          {localStatus === 'offline' && (
            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>未檢測到本機服務，請確認已下載並雙擊執行「啟動RPJG本地端.bat」。</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

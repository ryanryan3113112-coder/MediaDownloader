import React from 'react';
import { Download, Crown, Sparkles, ExternalLink, ShieldCheck, Clock, CheckCircle2, Zap, KeyRound, Monitor } from 'lucide-react';

export default function Header({
  quota,
  vip,
  onOpenPaywall,
  onOpenVipModal,
  onOpenLocalModal,
  isLocalMode,
  discordUrl = 'https://discord.gg/MDrNBbCBXz'
}) {
  // 格式化剩餘秒數為 hh:mm:ss
  const formatCountdown = (seconds) => {
    if (!seconds || seconds <= 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isVip = vip && vip.isVip;
  const isMaster = vip && vip.isMaster;
  const remaining = quota ? quota.remainingToday : 1;
  const isUsedUp = !isVip && remaining === 0;

  return (
    <header className="border-b border-[#1e293b] bg-[#0c1222]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 左側 Logo 與標題 */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-base tracking-wide">
                  RPJG 影音流體下載終端
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  作者：R.P.J.G 開發部門
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                MP3 / MP4 高速轉碼 • 支援各大社群影音平台
              </p>
            </div>
          </div>

          {/* 右側操作群 */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* 今日額度指示器 */}
            {isVip ? (
              <div
                onClick={onOpenVipModal}
                className="cursor-pointer flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/15 transition"
                title="點擊查看 VIP 會員資訊"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">{isMaster ? '總控管理員' : 'VIP 尊爵版'}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300">
                  無限下載
                </span>
              </div>
            ) : (
              <div
                onClick={onOpenPaywall}
                className={`cursor-pointer flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs transition ${
                  isUsedUp
                    ? 'bg-rose-950/30 border-rose-800/40 text-rose-300 hover:bg-rose-900/40'
                    : 'bg-[#111827] border-slate-700 text-slate-200 hover:border-slate-500'
                }`}
                title="點擊查看每日額度規則與高級版方案"
              >
                <div className="flex items-center space-x-1.5">
                  <Zap className={`w-3.5 h-3.5 ${isUsedUp ? 'text-rose-400' : 'text-cyan-400'}`} />
                  <span>
                    今日額度：
                    <strong className={`font-mono ${isUsedUp ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {remaining} / 1
                    </strong>
                  </span>
                </div>
                {isUsedUp && (
                  <span className="hidden lg:flex items-center text-[10px] text-gray-400 border-l border-slate-700 pl-2">
                    <Clock className="w-3 h-3 mr-1 text-gray-400" />
                    重置：{formatCountdown(quota?.resetInSeconds)}
                  </span>
                )}
              </div>
            )}

            {/* 總控管理員專屬特殊按鈕：派發金鑰總控 */}
            {isMaster && (
              <button
                onClick={onOpenVipModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition shadow-sm"
                title="點擊開啟金鑰派發與管理面板"
              >
                <KeyRound className="w-3.5 h-3.5 text-black" />
                <span>⚡ 派發金鑰</span>
              </button>
            )}

            {/* 本地端下載按鈕 */}
            <button
              onClick={onOpenLocalModal}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
                isLocalMode
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-gray-200 border-slate-700 hover:border-slate-600'
              }`}
              title="若雲端受限，可下載並運行本地極速端，享受家用網路滿速秒載"
            >
              <Monitor className={`w-3.5 h-3.5 ${isLocalMode ? 'text-emerald-400' : 'text-cyan-400'}`} />
              <span className="hidden sm:inline">{isLocalMode ? '⚡ 本機模式' : '💻 下載本地端'}</span>
            </button>

            {/* VIP 升級 / 兌換按鈕 */}
            {!isVip && (
              <button
                onClick={onOpenPaywall}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition shadow-sm"
              >
                <Crown className="w-3.5 h-3.5 text-black" />
                <span className="hidden sm:inline">升級高級版</span>
              </button>
            )}

            {/* 官方 Discord 按鈕 */}
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#5865F2] hover:bg-[#4752c4] text-white transition shadow-sm"
              title="加入 RPJG 官方 Discord 社群購買高級版或獲取技術支援"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 127.14 96.36">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
              <span className="hidden md:inline">RPJG Discord</span>
              <ExternalLink className="w-3 h-3 text-indigo-200" />
            </a>

            {/* 啟用碼兌換小按鈕 */}
            <button
              onClick={onOpenVipModal}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white bg-[#1a233b] hover:bg-[#232f4e] border border-[#2b395a] transition"
              title="輸入 VIP 金鑰 / 啟用碼"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

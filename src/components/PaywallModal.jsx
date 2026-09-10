import React, { useState } from 'react';
import {
  X,
  Crown,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Check,
  Zap,
  Lock,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';

export default function PaywallModal({
  isOpen,
  onClose,
  onRedeem,
  discordUrl = 'https://discord.gg/MDrNBbCBXz',
  isQuotaExceeded = false
}) {
  const [redeemKey, setRedeemKey] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRedeemSubmit = async (e) => {
    e.preventDefault();
    if (!redeemKey.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setRedeemError('');
    try {
      const res = await onRedeem(redeemKey.trim());
      if (!res.success) {
        setRedeemError(res.message || '金鑰無效');
      } else {
        setRedeemKey('');
        onClose();
      }
    } catch (err) {
      setRedeemError('驗證連線失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#0f172a] border border-[#1e293b] rounded-3xl shadow-xl overflow-hidden">
        {/* 標頭關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* 頂部圖標與標題 */}
          <div className="text-center pb-4">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-3">
              <Crown className="w-7 h-7 text-amber-400" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              {isQuotaExceeded ? '今日免費下載額度已用盡' : '升級 RPJG VIP 高級尊爵版'}
            </h2>

            <p className="text-xs sm:text-sm text-gray-400 mt-1.5 max-w-md mx-auto">
              免費使用者每日限制下載 <span className="text-amber-400 font-semibold">1 次</span>。立即加入 RPJG Discord 解鎖永久無限下載與極致影音特權！
            </p>
          </div>

          {/* 權益對比表 */}
          <div className="mt-2 bg-[#090d16] rounded-2xl border border-[#1e293b] p-3.5 space-y-2 text-xs">
            <div className="grid grid-cols-12 text-gray-400 font-semibold pb-1.5 border-b border-gray-800 text-[11px]">
              <span className="col-span-6">功能項目</span>
              <span className="col-span-3 text-center">免費體驗</span>
              <span className="col-span-3 text-center text-amber-400">👑 RPJG VIP</span>
            </div>

            {[
              { name: '每日下載次數', free: '1 次 / 天', vip: '永久無限次' },
              { name: 'MP3 音訊品質', free: '128 kbps', vip: '320 kbps 頂級' },
              { name: 'MP4 影音畫質', free: '720p', vip: '1080p / 4K 原畫' },
              { name: '轉碼專屬線路', free: '一般佇列', vip: '平行極速線程' },
              { name: '技術支援群組', free: '無', vip: 'Discord 專屬諮詢' }
            ].map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 py-1 items-center text-gray-300">
                <span className="col-span-6 font-medium text-gray-200">{row.name}</span>
                <span className="col-span-3 text-center text-gray-400">{row.free}</span>
                <span className="col-span-3 text-center text-amber-300 font-semibold flex items-center justify-center space-x-1">
                  <Check className="w-3 h-3 text-amber-400" />
                  <span>{row.vip}</span>
                </span>
              </div>
            ))}
          </div>

          {/* 核心行動呼籲按鈕：前往 Discord 購買 */}
          <div className="mt-5 space-y-3">
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold text-sm sm:text-base transition shadow-sm"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 127.14 96.36">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
              <span>前往 RPJG 官方 Discord 購買高級版</span>
              <ExternalLink className="w-4 h-4 text-indigo-200" />
            </a>
          </div>

          {/* 啟用碼兌換區域 */}
          <div className="mt-5 pt-4 border-t border-[#1e293b]">
            <form onSubmit={handleRedeemSubmit} className="space-y-2">
              <label className="text-xs font-medium text-gray-400 block">
                已有購買序號？輸入 VIP 啟用碼立即解鎖：
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={redeemKey}
                  onChange={(e) => setRedeemKey(e.target.value)}
                  placeholder="例如：0815065 或 065R.P.J.G"
                  className="flex-1 bg-[#141d33] border border-[#223055] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!redeemKey.trim() || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-xs transition shadow-sm shrink-0"
                >
                  {isSubmitting ? '驗證中...' : '立即兌換'}
                </button>
              </div>

              {redeemError && (
                <div className="text-xs text-rose-400 mt-1.5 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{redeemError}</span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* 底部作者與資訊 */}
        <div className="px-6 py-3 bg-[#080c14] border-t border-[#1e293b] flex items-center justify-between text-[11px] text-gray-500">
          <span>R.P.J.G 開發部門 核心認證安全體系</span>
          <span>支援全球各大社群影音平台</span>
        </div>
      </div>
    </div>
  );
}

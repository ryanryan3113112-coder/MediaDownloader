import React from 'react';
import { Loader2, Download, CheckCircle, AlertCircle, HardDrive, Gauge, Clock } from 'lucide-react';

export default function DownloadProgress({ progress, onReset }) {
  if (!progress) return null;

  const isCompleted = progress.status === 'completed';
  const isError = progress.status === 'error';
  const percent = progress.percent || (isCompleted ? 100 : 0);

  // 格式化檔案大小
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 bg-[#0f172a]/95 border border-[#1e293b] rounded-2xl p-6 shadow-2xl animate-fadeIn">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {isCompleted ? (
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          ) : isError ? (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          ) : (
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          )}
          <span className="font-bold text-sm sm:text-base text-white">
            {isCompleted ? '🎉 轉碼完成！檔案已準備就緒' : isError ? '下載處理遭遇錯誤' : progress.phase || '處理中...'}
          </span>
        </div>

        <div className="text-sm font-mono font-bold text-cyan-400">
          {percent.toFixed(1)}%
        </div>
      </div>

      {/* 進度條 */}
      <div className="w-full h-3 bg-[#070b14] rounded-full overflow-hidden p-0.5 border border-[#1e293b]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isCompleted
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : isError
              ? 'bg-rose-500'
              : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>

      {/* 傳輸遙測 (速度、剩餘時間、大小) */}
      {!isCompleted && !isError && (
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#1e293b] text-xs text-gray-400">
          <div className="flex items-center space-x-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>速度：<strong className="text-gray-200 font-mono">{progress.speed || '--'}</strong></span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>剩餘：<strong className="text-gray-200 font-mono">{progress.eta || '--'}</strong></span>
          </div>
          <div className="flex items-center space-x-1.5">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            <span>大小：<strong className="text-gray-200 font-mono">{progress.size || '--'}</strong></span>
          </div>
        </div>
      )}

      {/* 完成時下載按鈕 */}
      {isCompleted && (
        <div className="mt-5 pt-4 border-t border-[#1e293b] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            檔案大小：<span className="font-mono text-emerald-400 font-bold">{formatBytes(progress.fileSize)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => fetch('/api/open-folder', { method: 'POST' }).catch(() => {})}
              className="flex items-center space-x-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold transition"
              title="直接在 Windows 檔案總管中開啟下載目錄"
            >
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>📂 開啟檔案資料夾</span>
            </button>
            <a
              href={progress.downloadUrl}
              download
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-sm shadow-lg shadow-emerald-500/25 transition transform active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>儲存至本機電腦</span>
            </a>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="px-4 py-3 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-gray-300 hover:text-white text-xs font-semibold transition"
              >
                下載其他影音
              </button>
            )}
          </div>
        </div>
      )}

      {/* 錯誤訊息 */}
      {isError && (
        <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-200 flex flex-col gap-2">
          <span>{progress.error || '無法完成下載轉碼，請檢查影片是否受到版權地區保護或為私人內容。'}</span>
          {onReset && (
            <button
              onClick={onReset}
              className="self-start px-3 py-1 rounded-md bg-rose-800/40 hover:bg-rose-800/60 text-white transition font-medium"
            >
              重新嘗試
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { History, Download, Trash2, Music, Video, Clock } from 'lucide-react';

export default function HistoryPanel({ history, onClear, onRemoveItem }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 bg-[#0f172a]/80 border border-[#1e293b] rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-cyan-400" />
          <h4 className="text-sm font-bold text-white">本機下載轉碼紀錄 ({history.length})</h4>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-rose-400 transition flex items-center space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空紀錄</span>
          </button>
        )}
      </div>

      <div className="divide-y divide-[#1e293b]">
        {history.map((item, idx) => (
          <div key={idx} className="py-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3 truncate">
              <div className="p-2 rounded-lg bg-[#141d33] border border-[#223055] text-cyan-400 shrink-0">
                {item.type === 'mp3' ? <Music className="w-4 h-4" /> : <Video className="w-4 h-4 text-blue-400" />}
              </div>
              <div className="truncate">
                <div className="font-semibold text-gray-200 truncate">{item.title}</div>
                <div className="text-[11px] text-gray-500 font-mono mt-0.5 flex items-center space-x-2">
                  <span>{item.type.toUpperCase()} • {item.quality}</span>
                  <span>•</span>
                  <span>{new Date(item.time).toLocaleTimeString('zh-TW')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <a
                href={item.downloadUrl}
                download
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下載</span>
              </a>
              {onRemoveItem && (
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1.5 text-gray-500 hover:text-rose-400 transition"
                  title="移除紀錄"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

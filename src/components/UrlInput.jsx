import React from 'react';
import { Search, Clipboard, X, Loader2, Sparkles } from 'lucide-react';

export default function UrlInput({
  url,
  setUrl,
  onParse,
  isLoading,
  onPaste
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim() && !isLoading) {
      onParse();
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch (err) {
      console.warn('無法直接讀取剪貼簿:', err);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center rounded-2xl bg-[#0f172a] border border-[#1e293b] focus-within:border-cyan-500/50 transition-all shadow-md p-1.5 sm:p-2">
          {/* 左側搜尋圖標 */}
          <div className="pl-3 pr-2 text-cyan-400">
            <Search className="w-5 h-5" />
          </div>

          {/* 輸入框 */}
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="貼上 YouTube、TikTok、FB、IG、Bilibili 或 X 影音連結..."
            className="w-full bg-transparent text-white placeholder-gray-500 text-sm sm:text-base focus:outline-none px-2 py-2"
            disabled={isLoading}
          />

          {/* 清除按鈕 */}
          {url && !isLoading && (
            <button
              type="button"
              onClick={() => setUrl('')}
              className="p-1.5 text-gray-400 hover:text-gray-200 transition"
              title="清除內容"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* 貼上剪貼簿按鈕 */}
          {!url && (
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="hidden sm:flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-gray-300 hover:text-white text-xs font-medium transition mr-1.5"
            >
              <Clipboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>貼上</span>
            </button>
          )}

          {/* 解析送出按鈕 */}
          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className="flex items-center space-x-2 px-5 py-2.5 sm:py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold text-sm transition shadow-sm shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-200" />
                <span>解析中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>解析影音</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 支援平台標籤 */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-3 text-xs text-gray-400">
        <span className="text-gray-500">支援來源：</span>
        <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#111827] border border-gray-800 text-red-400">
          <span>YouTube</span>
        </span>
        <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#111827] border border-gray-800 text-cyan-400">
          <span>TikTok</span>
        </span>
        <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#111827] border border-gray-800 text-blue-400">
          <span>Facebook</span>
        </span>
        <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#111827] border border-gray-800 text-pink-400">
          <span>Instagram</span>
        </span>
        <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#111827] border border-gray-800 text-sky-400">
          <span>Bilibili</span>
        </span>
        <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#111827] border border-gray-800 text-gray-300">
          <span>X (Twitter)</span>
        </span>
      </div>
    </div>
  );
}

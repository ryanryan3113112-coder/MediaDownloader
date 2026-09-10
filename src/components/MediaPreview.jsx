import React, { useState } from 'react';
import { Music, Video, Download, Crown, Sparkles, User, Clock, Check, Eye } from 'lucide-react';

export default function MediaPreview({
  mediaInfo,
  onStartDownload,
  isDownloading,
  isVip,
  canDownload,
  onShowPaywall
}) {
  const [downloadType, setDownloadType] = useState('mp3'); // 'mp3' | 'mp4'
  const [selectedQuality, setSelectedQuality] = useState('320'); // '320' for mp3, '1080' for mp4

  if (!mediaInfo) return null;

  const handleTypeSwitch = (type) => {
    setDownloadType(type);
    if (type === 'mp3') {
      setSelectedQuality('320');
    } else {
      setSelectedQuality('1080');
    }
  };

  const handleDownloadClick = () => {
    if (!canDownload) {
      onShowPaywall();
      return;
    }
    onStartDownload({
      url: mediaInfo.webpageUrl,
      type: downloadType,
      quality: selectedQuality,
      title: mediaInfo.title
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 bg-[#0f172a]/95 border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl transition-all animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
        {/* 左側：縮圖與影片資訊 */}
        <div className="md:col-span-5 flex flex-col justify-between">
          <div className="relative rounded-xl overflow-hidden border border-[#2b395a] group shadow-lg aspect-video bg-black/50">
            {mediaInfo.thumbnail ? (
              <img
                src={mediaInfo.thumbnail}
                alt={mediaInfo.title}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                無預覽圖
              </div>
            )}
            {/* 時長標籤 */}
            {mediaInfo.durationFormatted && (
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-xs font-mono text-cyan-300 flex items-center space-x-1 border border-cyan-500/30">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>{mediaInfo.durationFormatted}</span>
              </div>
            )}
            {/* 來源標籤 */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-indigo-900/80 backdrop-blur-sm text-[11px] font-semibold text-indigo-200 border border-indigo-500/40">
              {mediaInfo.extractor}
            </div>
          </div>

          {/* 創作者與觀看數 */}
          <div className="mt-4 space-y-1.5 text-xs text-gray-400">
            <div className="flex items-center space-x-2 truncate">
              <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-gray-200 font-medium truncate">{mediaInfo.uploader}</span>
            </div>
            {mediaInfo.viewCount && (
              <div className="flex items-center space-x-2 text-gray-400">
                <Eye className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>約 {Number(mediaInfo.viewCount).toLocaleString()} 次觀看</span>
              </div>
            )}
          </div>
        </div>

        {/* 右側：標題與格式選擇 */}
        <div className="md:col-span-7 flex flex-col justify-between">
          <div>
            {/* 標題 */}
            <h3 className="text-base sm:text-lg font-bold text-white line-clamp-2 leading-snug">
              {mediaInfo.title}
            </h3>

            {/* 格式切換 Tab (MP3 vs MP4) */}
            <div className="flex space-x-2 mt-4 p-1 bg-[#090d16] rounded-xl border border-[#1e293b]">
              <button
                type="button"
                onClick={() => handleTypeSwitch('mp3')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                  downloadType === 'mp3'
                    ? 'bg-slate-700 text-white border border-slate-600 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Music className="w-4 h-4 text-cyan-400" />
                <span>MP3 音訊提取</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeSwitch('mp4')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                  downloadType === 'mp4'
                    ? 'bg-slate-700 text-white border border-slate-600 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Video className="w-4 h-4 text-blue-400" />
                <span>MP4 影音下載</span>
              </button>
            </div>

            {/* 品質選項 */}
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-300 block mb-2">
                選擇輸出規格：
              </label>

              {downloadType === 'mp3' ? (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '320', label: '320 kbps', sub: '極致無損推薦', vipOnly: false },
                    { id: '192', label: '192 kbps', sub: '標準高音質', vipOnly: false },
                    { id: '128', label: '128 kbps', sub: '輕量小檔案', vipOnly: false }
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedQuality(item.id)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        selectedQuality === item.id
                          ? 'bg-slate-800 border-cyan-500/80 text-cyan-200 shadow-sm'
                          : 'bg-[#141d33] border-slate-800 text-gray-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">{item.label}</span>
                        {selectedQuality === item.id && <Check className="w-3 h-3 text-cyan-400" />}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1">{item.sub}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    { id: '1080', label: '1080p', sub: 'Full HD' },
                    { id: '720', label: '720p', sub: '高清品質' },
                    { id: '480', label: '480p', sub: '標準畫質' },
                    { id: 'best', label: '最佳原畫', sub: '最高可用' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedQuality(item.id)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        selectedQuality === item.id
                          ? 'bg-slate-800 border-blue-500/80 text-blue-200 shadow-sm'
                          : 'bg-[#141d33] border-slate-800 text-gray-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">{item.label}</span>
                        {selectedQuality === item.id && <Check className="w-3 h-3 text-blue-400" />}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1">{item.sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 下載操作按鈕 */}
          <div className="mt-6 pt-4 border-t border-[#1e293b] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-gray-400">
              {isVip ? (
                <span className="text-amber-400 flex items-center space-x-1">
                  <Crown className="w-3.5 h-3.5" />
                  <span>VIP 專屬多線程轉碼線路</span>
                </span>
              ) : (
                <span>免費版本：每日可下載 1 次</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={isDownloading}
              className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition ${
                canDownload
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-sm'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>
                {canDownload
                  ? `開始下載 (${downloadType.toUpperCase()})`
                  : '今日額度已滿 - 升級 VIP 高級版'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

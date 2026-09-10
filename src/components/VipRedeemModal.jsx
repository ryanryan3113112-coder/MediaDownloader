import React, { useState, useEffect } from 'react';
import {
  X,
  Crown,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  Plus,
  Copy,
  ExternalLink,
  Check,
  AlertCircle,
  Ban,
  Trash2,
  Zap,
  Clock,
  Calendar,
  Sparkles
} from 'lucide-react';

export default function VipRedeemModal({
  isOpen,
  onClose,
  vip,
  onRedeem,
  onLogoutVip,
  discordUrl = 'https://discord.gg/MDrNBbCBXz'
}) {
  const [keyInput, setKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 管理員專屬：金鑰清單與建立金鑰狀態
  const [adminKeys, setAdminKeys] = useState([]);
  const [quickNotice, setQuickNotice] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  
  const isMaster = vip && vip.isMaster;
  const [activeTab, setActiveTab] = useState(isMaster ? 'admin' : 'status');

  // 每次開啟如果已經是 Master，自動切換至管理面板
  useEffect(() => {
    if (isMaster) {
      setActiveTab('admin');
      fetchAdminKeys();
    } else {
      setActiveTab('status');
    }
  }, [isOpen, isMaster]);

  // 載入伺服端已存儲的金鑰清單
  const fetchAdminKeys = async () => {
    if (!isMaster) return;
    try {
      const res = await fetch('/api/admin/keys', {
        headers: { 'x-vip-key': vip.key }
      });
      const data = await res.json();
      if (data.success) {
        setAdminKeys(data.keys);
      }
    } catch (e) {
      console.error('載入金鑰庫失敗:', e);
    }
  };

  if (!isOpen) return null;

  // 兌換金鑰 (若輸入 0815065 或 065R.P.J.G 立即成為管理員)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!keyInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await onRedeem(keyInput.trim());
      if (res.success) {
        setSuccessMsg(res.message || 'VIP 啟用成功！');
        setKeyInput('');
        if (keyInput.trim() === '0815065' || keyInput.trim() === '065R.P.J.G') {
          setActiveTab('admin');
        }
      } else {
        setErrorMsg(res.message || '啟用碼無效');
      }
    } catch (err) {
      setErrorMsg('連線異常，請稍候再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 快速派發金鑰 (1天、1週、1個月、永久)
  const handleQuickDispatch = async (days, label) => {
    try {
      setQuickNotice('');
      const desc = customDesc.trim() || `Discord 客戶購買 - ${label}`;
      const res = await fetch('/api/admin/keys/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vip-key': vip.key
        },
        body: JSON.stringify({
          days,
          description: desc
        })
      });
      const data = await res.json();
      if (data.success && data.key) {
        // 自動複製到剪貼簿
        navigator.clipboard.writeText(data.key.key);
        setCopiedKey(data.key.key);
        setQuickNotice(`🎉 成功派發【${label}】序號：${data.key.key}（已自動複製到剪貼簿，可直接至 Discord 貼上發送！）`);
        setCustomDesc('');
        fetchAdminKeys();
      }
    } catch (err) {
      console.error(err);
      setQuickNotice('派發失敗，請確認伺服器連線');
    }
  };

  // 切換停用 / 啟用狀態 (即時持久化至伺服器)
  const handleToggleDisable = async (keyStr) => {
    try {
      const res = await fetch('/api/admin/keys/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vip-key': vip.key
        },
        body: JSON.stringify({ key: keyStr })
      });
      const data = await res.json();
      if (data.success) {
        fetchAdminKeys();
      } else {
        alert(data.message || '操作失敗');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 刪除金鑰
  const handleDeleteKey = async (keyStr) => {
    if (!confirm(`確定要從金鑰庫中永久刪除序號【${keyStr}】嗎？`)) return;
    try {
      const res = await fetch('/api/admin/keys/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vip-key': vip.key
        },
        body: JSON.stringify({ key: keyStr })
      });
      const data = await res.json();
      if (data.success) {
        fetchAdminKeys();
      } else {
        alert(data.message || '刪除失敗');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#0f172a] border border-[#1e293b] rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* 標頭關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 標頭資訊 */}
        <div className="p-6 border-b border-[#1e293b] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white">RPJG VIP 會員與金鑰管理系統</h3>
                {isMaster && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black">
                    總控管理員模式
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {isMaster ? '金鑰派發專用控制台 • 支援 1天、1週、1個月、永久與即時停用' : '啟用高級版特權或兌換 VIP 授權碼'}
              </p>
            </div>
          </div>

          {/* 導航 Tabs (僅 Master 可見切換) */}
          {isMaster && (
            <div className="flex space-x-2 mt-4 p-1 bg-[#090d16] rounded-xl border border-[#1e293b]">
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'admin' ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                ⚡ 派發金鑰控制台 (管理專用)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('status')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'status' ? 'bg-slate-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                個人會員身分
              </button>
            </div>
          )}
        </div>

        {/* 主要滾動內容區 */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'admin' ? (
            <div className="space-y-6">
              {/* 派發成功提示橫幅 */}
              {quickNotice && (
                <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-700/50 text-xs text-emerald-200 flex items-start space-x-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{quickNotice}</span>
                </div>
              )}

              {/* 核心派發按鈕組 (一天、一周、一個月、永久) */}
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>快速派發專用金鑰 (點擊自動生成並複製卡號)：</span>
                  </span>
                </div>

                {/* 備註輸入框 */}
                <div>
                  <input
                    type="text"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    placeholder="可選填備註（例如：Discord 買家 @使用者名稱）..."
                    className="w-full bg-[#0d1322] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* 4 個指定按鈕：一天、一周、一個月、永久 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickDispatch(1, '1 天體驗卡')}
                    className="p-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-left transition flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">⚡ 派發 1 天卡</span>
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1">24 小時有效</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDispatch(7, '1 週週卡')}
                    className="p-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-left transition flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">⚡ 派發 1 週卡</span>
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1">7 天有效</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDispatch(30, '1 個月月卡')}
                    className="p-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-left transition flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">⚡ 派發 1 個月</span>
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1">30 天有效</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDispatch(0, '永久尊爵卡')}
                    className="p-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-left transition flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">👑 派發永久卡</span>
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1">永久無期限</span>
                  </button>
                </div>
              </div>

              {/* 已存儲金鑰總表 (金鑰庫，支援即時停用與刪除) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    已持久化儲存之金鑰總表 ({adminKeys.length})：
                  </span>
                  <button
                    onClick={fetchAdminKeys}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    刷新清單
                  </button>
                </div>

                <div className="divide-y divide-slate-800 border border-slate-800 rounded-2xl bg-[#090d16] overflow-hidden">
                  {adminKeys.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">暫無派發的金鑰</div>
                  ) : (
                    adminKeys.map((k) => {
                      const isMasterKey = ['065R.P.J.G', '0815065'].includes(k.key);
                      const isExpired = k.isExpired;
                      const isDisabled = k.disabled;

                      return (
                        <div key={k.key} className="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs">
                          {/* 左側資訊 */}
                          <div className="truncate">
                            <div className="flex items-center space-x-2 truncate">
                              <span className="font-mono font-bold text-white text-sm truncate">
                                {k.key}
                              </span>
                              {/* 狀態標籤 */}
                              {isMasterKey ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  總控核心
                                </span>
                              ) : isDisabled ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                  已停用
                                </span>
                              ) : isExpired ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-300 border border-orange-800">
                                  已過期
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  正常生效中
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-gray-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                              <span>備註：{k.description || '無'}</span>
                              <span>•</span>
                              <span>
                                到期：{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString('zh-TW') : '永久'}
                              </span>
                              {k.usedCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-gray-500">已使用 {k.usedCount} 次</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 右側操作按鈕 (複製、停用、刪除) */}
                          <div className="flex items-center space-x-1.5 shrink-0">
                            {/* 複製按鈕 */}
                            <button
                              onClick={() => handleCopy(k.key)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white transition"
                              title="複製序號"
                            >
                              {copiedKey === k.key ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* 停用 / 啟用按鈕 (Master 核心金鑰不可停用) */}
                            {!isMasterKey && (
                              <button
                                onClick={() => handleToggleDisable(k.key)}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold transition ${
                                  isDisabled
                                    ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30'
                                    : 'bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30'
                                }`}
                                title={isDisabled ? '重新啟用此金鑰' : '停用此金鑰（買家將無法使用）'}
                              >
                                {isDisabled ? '重新啟用' : '停用'}
                              </button>
                            )}

                            {/* 刪除按鈕 */}
                            {!isMasterKey && (
                              <button
                                onClick={() => handleDeleteKey(k.key)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-gray-400 hover:text-rose-300 transition"
                                title="刪除此金鑰"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 一般身分檢視與金鑰兌換頁面 */
            <div className="space-y-5">
              {vip && vip.isVip ? (
                <div className="bg-[#141d33] border border-amber-500/30 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">當前身分：</span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {vip.role || 'RPJG VIP 尊爵會員'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">有效期限：</span>
                    <span className="font-mono text-emerald-300 font-semibold">
                      {vip.expiresAt ? new Date(vip.expiresAt).toLocaleDateString('zh-TW') : '永久尊榮授權'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">每日下載配額：</span>
                    <span className="font-mono text-cyan-300 font-bold">永久無上限 (無限次)</span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={onLogoutVip}
                      className="text-xs text-rose-400 hover:text-rose-300 underline"
                    >
                      解除此裝置 VIP 綁定
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#141d33] border border-[#223055] rounded-2xl p-4 text-xs text-gray-300 space-y-2">
                  <div className="flex items-center space-x-2 text-cyan-300 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>當前為：免費體驗版</span>
                  </div>
                  <p className="text-gray-400 leading-relaxed">
                    每日享有 1 次下載配額。若需無限制極速下載或 4K/320k 格式，請前往 RPJG 官方 Discord 購買 VIP 啟用序號。
                  </p>
                </div>
              )}

              {/* 輸入金鑰兌換 */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="text-xs font-semibold text-gray-300 block">
                  輸入 VIP 啟用金鑰 / 序號：
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="輸入金鑰，例如 0815065 或 065R.P.J.G"
                    className="flex-1 bg-[#141d33] border border-[#223055] rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={!keyInput.trim() || isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-xs transition shadow-sm shrink-0"
                  >
                    {isSubmitting ? '驗證中...' : '啟用'}
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{successMsg}</span>
                  </div>
                )}
              </form>

              {/* Discord 購買連結 */}
              <div className="pt-2 text-center">
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  <span>還沒有金鑰？點此前往 Discord 商城購買</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="px-6 py-3.5 bg-[#090d16] border-t border-[#1e293b] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-200 transition"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
}

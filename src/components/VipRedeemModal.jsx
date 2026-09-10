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
  AlertCircle
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
  const [genTier, setGenTier] = useState('VIP_MONTHLY');
  const [genDays, setGenDays] = useState(30);
  const [genDesc, setGenDesc] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeTab, setActiveTab] = useState('status'); // 'status' | 'admin'

  const isMaster = vip && vip.isMaster;

  // 若為 Master 載入已生成的金鑰清單
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
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen && isMaster) {
      fetchAdminKeys();
    }
  }, [isOpen, isMaster]);

  if (!isOpen) return null;

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
      } else {
        setErrorMsg(res.message || '啟用碼無效');
      }
    } catch (err) {
      setErrorMsg('連線異常，請稍候再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateKey = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/keys/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vip-key': vip.key
        },
        body: JSON.stringify({
          tier: genTier,
          days: parseInt(genDays, 10),
          description: genDesc || 'Discord 客戶購買序號'
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchAdminKeys();
        setGenDesc('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#0f172a] border border-[#2b395a] rounded-3xl shadow-2xl overflow-hidden">
        {/* 標頭關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/20 border border-amber-500/40">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">RPJG VIP 會員與金鑰管理</h3>
              <p className="text-xs text-gray-400">啟用高級特權或管理授權金鑰</p>
            </div>
          </div>

          {/* 導航 Tabs (僅 Master 可見切換) */}
          {isMaster && (
            <div className="flex space-x-2 mb-5 p-1 bg-[#090d16] rounded-xl border border-[#1e293b]">
              <button
                type="button"
                onClick={() => setActiveTab('status')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'status' ? 'bg-[#1e293b] text-white shadow' : 'text-gray-400'
                }`}
              >
                會員狀態
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'admin' ? 'bg-amber-500 text-black font-bold shadow' : 'text-gray-400'
                }`}
              >
                👑 總控管理（生成序號）
              </button>
            </div>
          )}

          {activeTab === 'status' ? (
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
                    placeholder="輸入金鑰，例如 065R.P.J.G"
                    className="flex-1 bg-[#141d33] border border-[#223055] rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={!keyInput.trim() || isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-black font-bold text-xs transition shadow shrink-0"
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
          ) : (
            /* 管理員專屬面版：建立與生成金鑰供 Discord 銷售 */
            <div className="space-y-4">
              <form onSubmit={handleGenerateKey} className="bg-[#141d33] p-4 rounded-2xl border border-[#223055] space-y-3">
                <div className="font-bold text-xs text-amber-300 flex items-center space-x-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>發行新 VIP 授權序號 (供 Discord 客戶使用)</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-gray-400 block mb-1">方案類型</label>
                    <select
                      value={genTier}
                      onChange={(e) => setGenTier(e.target.value)}
                      className="w-full bg-[#0d1322] border border-gray-700 rounded-lg p-1.5 text-white"
                    >
                      <option value="VIP_MONTHLY">月費卡 (30 天)</option>
                      <option value="VIP_YEARLY">年費卡 (365 天)</option>
                      <option value="VIP_LIFETIME">永久尊爵卡</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">天數</label>
                    <input
                      type="number"
                      value={genDays}
                      onChange={(e) => setGenDays(e.target.value)}
                      className="w-full bg-[#0d1322] border border-gray-700 rounded-lg p-1.5 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 block mb-1 text-xs">備註說明</label>
                  <input
                    type="text"
                    value={genDesc}
                    onChange={(e) => setGenDesc(e.target.value)}
                    placeholder="例如：Discord 用戶 @ABC 購買"
                    className="w-full bg-[#0d1322] border border-gray-700 rounded-lg p-1.5 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition"
                >
                  立即生成金鑰
                </button>
              </form>

              {/* 已生成序號列表 */}
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                <label className="text-xs text-gray-400 font-semibold block">序號庫清單：</label>
                {adminKeys.map((k) => (
                  <div key={k.key} className="p-2.5 rounded-xl bg-[#090d16] border border-[#1e293b] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-white flex items-center space-x-2">
                        <span>{k.key}</span>
                        {k.usedCount > 0 && (
                          <span className="text-[10px] px-1.5 rounded bg-emerald-900/40 text-emerald-300">
                            已兌換
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500">{k.description}</div>
                    </div>
                    <button
                      onClick={() => handleCopy(k.key)}
                      className="p-1.5 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-gray-300 transition"
                      title="複製序號"
                    >
                      {copiedKey === k.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-[#080c14] border-t border-[#1e293b] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

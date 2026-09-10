// test_api.js
const BASE_URL = 'http://localhost:3005';
const TEST_USER = 'user_limit_test_' + Date.now();

async function runTests() {
  console.log('=== RPJG 影音流體極速下載終端 整合驗證 ===\n');

  console.log('--- 測試 1: 取得系統 Telemetry 與狀態 ---');
  const telRes = await fetch(`${BASE_URL}/api/telemetry`, {
    headers: { 'x-client-id': TEST_USER }
  });
  const telData = await telRes.json();
  console.log('Telemetry 服務狀態:', telData.status, 'yt-dlp:', telData.engine.ytDlp, 'ffmpeg:', telData.engine.ffmpeg);
  console.log('Discord 引導連結:', telData.discordUrl);

  console.log('\n--- 測試 2: 查詢新使用者初始每日配額 ---');
  const qRes = await fetch(`${BASE_URL}/api/quota`, {
    headers: { 'x-client-id': TEST_USER }
  });
  const qData = await qRes.json();
  console.log('配額資料: 今日剩餘 =', qData.quota.remainingToday, '/', qData.quota.maxDaily, ', canDownload =', qData.quota.canDownload);

  if (qData.quota.remainingToday !== 1 || !qData.quota.canDownload) {
    throw new Error('❌ 初始配額異常，應為 1/1');
  }
  console.log('✅ PASS: 新使用者初始配額為 1 次');

  console.log('\n--- 測試 3: 免費使用者發起第 1 次下載 (預期成功扣除額度) ---');
  const dl1Res = await fetch(`${BASE_URL}/api/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': TEST_USER
    },
    body: JSON.stringify({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      type: 'mp3',
      quality: '128',
      title: '測試第1次音訊'
    })
  });
  const dl1Data = await dl1Res.json();
  console.log('第 1 次下載回應狀態:', dl1Res.status, 'TaskId:', dl1Data.taskId);

  if (dl1Res.status !== 200 || !dl1Data.success) {
    throw new Error('❌ 第 1 次下載發起失敗');
  }
  console.log('✅ PASS: 第 1 次下載順利通過！');

  console.log('\n--- 測試 4: 免費使用者立即發起第 2 次下載 (預期 403 攔截並導向 Discord) ---');
  const dl2Res = await fetch(`${BASE_URL}/api/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': TEST_USER
    },
    body: JSON.stringify({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      type: 'mp4',
      quality: '720',
      title: '測試第2次影片'
    })
  });
  const dl2Data = await dl2Res.json();
  console.log('第 2 次下載回應狀態:', dl2Res.status);
  console.log('攔截訊息:', dl2Data.message);
  console.log('導向 Discord 網址:', dl2Data.discordUrl);

  if (dl2Res.status === 403 && dl2Data.code === 'QUOTA_EXCEEDED' && dl2Data.discordUrl === 'https://discord.gg/MDrNBbCBXz') {
    console.log('✅ PASS: 每日限制 1 次生效！成功回傳 403 QUOTA_EXCEEDED 並提供 Discord 導購購買連結！');
  } else {
    throw new Error('❌ FAIL: 未能正確攔截第 2 次下載！');
  }

  console.log('\n--- 測試 5: 兌換 RPJG 總控核心金鑰 065R.P.J.G ---');
  const redeemRes = await fetch(`${BASE_URL}/api/vip/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: '065R.P.J.G' })
  });
  const redeemData = await redeemRes.json();
  console.log('VIP 兌換結果:', redeemData.message, '身分:', redeemData.vip?.role);

  if (!redeemData.success || !redeemData.vip?.isMaster) {
    throw new Error('❌ 總控金鑰兌換失敗');
  }
  console.log('✅ PASS: 成功啟用最高級總控管理員權限！');

  console.log('\n--- 測試 6: 升級 VIP 後再次下載 (預期不受每日限制，無上限通過) ---');
  const vipDlRes = await fetch(`${BASE_URL}/api/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': TEST_USER,
      'x-vip-key': '065R.P.J.G'
    },
    body: JSON.stringify({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      type: 'mp4',
      quality: '1080',
      title: 'VIP 專屬 1080p 影片'
    })
  });
  const vipDlData = await vipDlRes.json();
  console.log('VIP 下載回應狀態:', vipDlRes.status, 'TaskId:', vipDlData.taskId);

  if (vipDlRes.status === 200 && vipDlData.success) {
    console.log('✅ PASS: VIP 權限完全不受每日 1 次限制影響，成功建立無限制下載任務！');
  } else {
    throw new Error('❌ VIP 下載失敗');
  }

  console.log('\n=============================================');
  console.log('🎉 所有測試項目全數通過！功能與限制完全符合需求！');
  console.log('=============================================\n');
  process.exit(0);
}

runTests().catch(e => {
  console.error('\n測試失敗:', e.message);
  process.exit(1);
});

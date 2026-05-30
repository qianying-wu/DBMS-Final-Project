const LoginDialog = require('./login');

// 測試登入流程：直接建立 LoginDialog 並用測試帳密呼叫驗證。
(async () => {
  const dlg = new LoginDialog('user');
  // 若資料庫沒有這組測試帳密，authenticate 預期會回傳 false。
  const ok = await dlg.authenticate('testuser', 'testpass');
  console.log('authenticate returned', ok);
  console.log('isAuthenticated', dlg.isAuthenticated());
  console.log('userId', dlg.getUserId());
})();

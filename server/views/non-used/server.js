const express = require('express');
const bodyParser = require('body-parser');
const LoginDialog = require('./login');

// 建立 Express app，提供 StartPage 靜態頁面與登入/註冊 API。
const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname)); // 提供此資料夾內的靜態檔案。

// 開發用假登入資料：當 MOCK_AUTH=true 時啟用。
const useMock = (process.env.MOCK_AUTH === 'true');
const mockUsers = {
  // 帳號格式：username: { password, role, id }
  'testuser': { password: 'testpass', role: 'user', id: 1001 },
  'maint': { password: 'maintpass', role: 'maintenance', id: 2001 }
};
let nextMockId = 3000;

// 登入 API：先檢查必要欄位，再依環境使用 mock 或資料庫登入。
app.post('/login', async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password || !role) {
    return res.status(400).json({ ok: false, error: 'username, password and role are required' });
  }
  if (useMock) {
    const u = mockUsers[username];
    if (u && u.password === password && u.role === role) return res.json({ ok:true, userId: u.id });
    return res.status(401).json({ ok:false, error:'invalid credentials (mock)'});
  }

  const dlg = new LoginDialog(role);
  const ok = await dlg.authenticate(username, password);
  if (ok) {
    return res.json({ ok: true, userId: dlg.getUserId() });
  }
  return res.status(401).json({ ok: false, error: 'invalid credentials' });
});

// 註冊 API：目前是展示用 stub，mock 模式會把帳號暫存在記憶體。
app.post('/register', async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password || !role) return res.status(400).json({ ok:false, error: 'missing fields' });
  if (useMock) {
    if (mockUsers[username]) return res.status(409).json({ ok:false, error:'user exists' });
    const id = nextMockId++;
    mockUsers[username] = { password, role, id };
    return res.json({ ok:true, message:'registered (mock)', username, role, userId: id });
  }

  // 正式環境應在這裡寫入資料庫並雜湊密碼；目前先回傳成功 stub。
  return res.json({ ok:true, message: 'registered (stub)', username, role });
});

// 啟動本機伺服器。
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));

const express = require('express');
const bodyParser = require('body-parser');
const LoginDialog = require('./login');

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname)); // serve static files

// Mock auth store for development: enabled when MOCK_AUTH=true
const useMock = (process.env.MOCK_AUTH === 'true');
const mockUsers = {
  // username: { password, role, id }
  'testuser': { password: 'testpass', role: 'user', id: 1001 },
  'maint': { password: 'maintpass', role: 'maintenance', id: 2001 }
};
let nextMockId = 3000;

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

// Simple register stub for demo purposes
app.post('/register', async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password || !role) return res.status(400).json({ ok:false, error: 'missing fields' });
  if (useMock) {
    if (mockUsers[username]) return res.status(409).json({ ok:false, error:'user exists' });
    const id = nextMockId++;
    mockUsers[username] = { password, role, id };
    return res.json({ ok:true, message:'registered (mock)', username, role, userId: id });
  }

  // In production, insert into DB with hashed password. Here we return success stub.
  return res.json({ ok:true, message: 'registered (stub)', username, role });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));

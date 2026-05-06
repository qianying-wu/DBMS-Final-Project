import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const startPageDir = path.join(__dirname, 'views', 'StartPage');

const mockUsers = {
    testuser: { password: 'testpass', role: 'user', id: 1001 },
    maint: { password: 'maintpass', role: 'maintenance', id: 2001 }
};
let nextMockId = 3000;

// 1. 解析前端傳來的 JSON 資料 (這行一定要加，否則 API 抓不到資料)
app.use(express.json());

// 2. 設定靜態檔案路徑 (指向你存放 HTML/CSS/前端JS 的地方)
// 假設你之後把前端檔案移到名為 public 的資料夾
app.use(express.static(path.join(__dirname, 'views/StartPage')));

// 3. 測試用 API：檢查後端有沒有跑起來
app.get('/api/test', (req, res) => {
    res.json({ message: "後端伺服器已連線！" });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(startPageDir, 'startPage.html')); // 之前是前端指到/public
});

app.post('/login', (req, res) => {
    const { username, password, role } = req.body || {};
    if (!username || !password || !role) {
        return res.status(400).json({ ok: false, error: 'username, password and role are required' });
    }

    const user = mockUsers[username];
    if (!user || user.password !== password || user.role !== role) {
        return res.status(401).json({ ok: false, error: 'invalid credentials' });
    }

    res.json({ ok: true, userId: user.id });
});

app.post('/register', (req, res) => {
    const { username, password, role } = req.body || {};
    if (!username || !password || !role) {
        return res.status(400).json({ ok: false, error: 'username, password and role are required' });
    }
    if (mockUsers[username]) {
        return res.status(409).json({ ok: false, error: 'user exists' });
    }

    const id = nextMockId++;
    mockUsers[username] = { password, role, id };
    res.json({ ok: true, userId: id });
});

// 4. 啟動伺服器
app.listen(port, () => {
    console.log(`伺服器啟動成功：http://localhost:${port}`);
});

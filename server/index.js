import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
let authController;
import * as reviewController from './controllers/reviewController.js';

// 手動定義 __filename 和 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const startPageDir = path.join(__dirname, 'views', 'StartPage');

// 1. 解析前端傳來的 JSON 資料 (這行一定要加，否則 API 抓不到資料)
app.use(express.json());

// 2. 設定靜態檔案路徑 (指向你存放 HTML/CSS/前端JS 的地方)
app.use(express.static(path.join(__dirname, 'views/StartPage')));

// 3. 測試用 API：檢查後端有沒有跑起來
app.get('/test', (req, res) => {
    res.json({ message: "後端伺服器已連線！" });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(startPageDir, 'startPage.html')); 
});

// app.post('/login', (req, res) => {
//     const { username, password, role } = req.body || {};
//     if (!username || !password || !role) {
//         return res.status(400).json({ ok: false, error: 'username, password and role are required' });
//     }

//     const user = mockUsers[username];
//     if (!user || user.password !== password || user.role !== role) {
//         return res.status(401).json({ ok: false, error: 'invalid credentials' });
//     }

//     res.json({ ok: true, userId: user.id });
// });

// app.post('/register', (req, res) => {
//     const { username, password, role } = req.body || {};
//     if (!username || !password || !role) {
//         return res.status(400).json({ ok: false, error: 'username, password and role are required' });
//     }
//     if (mockUsers[username]) {
//         return res.status(409).json({ ok: false, error: 'user exists' });
//     }

//     const id = nextMockId++;
//     mockUsers[username] = { password, role, id };
//     res.json({ ok: true, userId: id });
// });
// conditional auth handlers: mock when USE_MOCK=1 to avoid requiring DB env
if (process.env.USE_MOCK === '1') {
    console.log('Starting in MOCK mode (USE_MOCK=1) - using in-memory auth handlers');
    const mockUsers = new Map();
    let nextId = 1;

    app.post('/register', (req, res) => {
        const { account, password } = req.body || {};
        if (!account || !password) return res.status(400).json({ ok: false, error: 'account and password required' });
        if (mockUsers.has(account)) return res.status(409).json({ ok: false, error: 'user exists' });
        const id = nextId++;
        mockUsers.set(account, { id, account, password });
        return res.json({ ok: true, userId: id, message: 'mock register success' });
    });

    app.post('/login', (req, res) => {
        const { account, password } = req.body || {};
        if (!account || !password) return res.status(400).json({ ok: false, error: 'account and password required' });
        const u = mockUsers.get(account);
        if (!u || u.password !== password) return res.status(401).json({ ok: false, error: 'invalid credentials' });
        return res.json({ ok: true, userId: u.id, message: 'mock login success' });
    });

    app.post('/submit-review', reviewController.submitReview);
} else {
    // load real auth controller (may throw if env missing)
    (async () => {
        authController = await import('./controllers/authController.js');
        app.post('/register', authController.register);
        app.post('/login', authController.login);
        app.post('/submit-review', reviewController.submitReview);
    })();
}

// 4. 啟動伺服器
app.listen(port, () => {
    console.log(`伺服器啟動成功：http://localhost:${port}`);
});
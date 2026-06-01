import express from 'express';
import path from 'path';

import dotenv from 'dotenv';
dotenv.config();

import passport from "passport";
import passportConfig from "./config/passport.js";

import { fileURLToPath } from 'url';
import authRouter from './routes/auth-route.js';
import reviewRouter from './routes/review-route.js';
import teamRouter from './routes/team-route.js';
import comRouter from './routes/com-route.js';
import pvRouter from './routes/pv-route.js';
import prefRouter from './routes/pref-route.js';

import { requireLogin } from './middleware/auth-middleware.js';

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


app.use(passport.initialize());
passportConfig(passport);

// --- HTML 頁面 routes  --- 看網址後面加什麼就帶去哪
app.get('/', (req, res) => {
    res.sendFile(path.join(startPageDir, 'contests.html'));
});
app.get('/profile', (req, res) => {
    res.sendFile(path.join(startPageDir, 'profile.html'));
});
app.get('/team', (req, res) => {
    res.sendFile(path.join(startPageDir, 'team.html'));
});
app.get('/contest', (req, res) => {
    res.sendFile(path.join(startPageDir, 'contest.html'));
});
app.get('/create-team', (req, res) => {
    res.sendFile(path.join(startPageDir, 'create-team.html'));
});

app.get('/contests/search', (req, res) => {
    res.sendFile(path.join(startPageDir, 'create-team.html'));
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.status(204).end();
});

// --- API routes ---
app.use('/api/auth', authRouter);
app.use('/api/review', reviewRouter);
app.use('/api/teams', teamRouter);
app.use('/api/contests', comRouter);
app.use('/api/pv', pvRouter); // 這條路由需要登入驗證
app.use('/api/pref', prefRouter); // 這條路由需要登入驗證

// 4. 啟動伺服器
app.listen(port, () => {
    console.log(`伺服器啟動成功：http://localhost:${port}`);
})



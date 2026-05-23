import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as authController from './controllers/authController.js';
import * as reviewController from './controllers/reviewController.js';
import authRouter from './routes/auth-route.js';
import reviewRouter from './routes/review-route.js';
import pool from './models/db.js';

import dotenv from 'dotenv';
dotenv.config();

import passport from "passport";
import passportConfig from "./config/passport.js";

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

// --- HTML 頁面 routes  ---
app.get('/', (req, res) => {
    res.sendFile(path.join(startPageDir, 'team.html')); 
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

app.get('/competitions', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                com_id AS id,
                com_name AS name,
                DATE_FORMAT(com_date, '%Y-%m-%d') AS date,
                com_intro AS info,
                com_link AS officialUrl
            FROM Competition
            ORDER BY com_date IS NULL, com_date ASC, com_id ASC
        `);
        res.json({ ok: true, competitions: rows });
    } catch (err) {
        console.error('Database Error (Competitions):', err.message);
        res.status(500).json({ ok: false, error: '無法取得比賽資料' });
    }
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.status(204).end();
});


// app.post('/submit-review', reviewController.submitReview);

// app.post('/register', authController.register);

// app.post('/login', authController.login);

// // 個人化推薦標籤 API：提供前端讀取標籤、讀取使用者偏好與更新偏好。
// app.get('/preference-tags', authController.getPreferenceTags);
// app.get('/users/:userId/preferences', authController.getUserPreferences);
// app.put('/users/:userId/preferences', authController.updateUserPreferences);

// --- API routes ---
app.use('/api/auth', authRouter);
app.use('/api/review', reviewRouter);

// 4. 啟動伺服器
app.listen(port, () => {
    console.log(`伺服器啟動成功：http://localhost:${port}`);
});

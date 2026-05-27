import express from 'express';
import path from 'path';
import pool from './models/db.js';

import dotenv from 'dotenv';
dotenv.config();

console.log('[SERVER STARTUP] Environment Variables Loaded:');
console.log('[SERVER STARTUP] PASSPORT_SECRET:', !!process.env.PASSPORT_SECRET ? '✓ Loaded' : '✗ NOT FOUND');
console.log('[SERVER STARTUP] DB_HOST:', process.env.DB_HOST || 'NOT LOADED');

import passport from "passport";
import passportConfig from "./config/passport.js";

import { fileURLToPath } from 'url';
import authRouter from './routes/auth-route.js';
import reviewRouter from './routes/review-route.js';
import teamRouter from './routes/team-route.js';
import comRouter from './routes/com-route.js';
import pvRouter from './routes/pv-route.js';

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

app.get('/contests/search', (req, res) => {
    res.sendFile(path.join(startPageDir, 'create-team.html'));
});
// app.get('/competitions', async (req, res) => {
//     try {
//         // 已讀通知保留五天，超過後自動刪除，避免通知列表越堆越長。
//         await pool.execute(
//             `DELETE FROM Notification
//              WHERE user_id = ? AND read_at IS NOT NULL AND read_at < DATE_SUB(NOW(), INTERVAL 5 DAY)`,
//             [userId]
//         );

//         // 將 Competition 表裡的比賽同步成通知；同一使用者同一比賽只會建立一次。
//         await pool.execute(`
//             INSERT IGNORE INTO Notification (user_id, type, message, source_id, source_key, action_json, created_at)
//             SELECT
//                 ?,
//                 'contest',
//                 CONCAT('新比賽：', com_name, '，比賽日期 ', COALESCE(DATE_FORMAT(com_date, '%Y-%m-%d'), '未定')),
//                 CAST(com_id AS CHAR),
//                 CONCAT('contest:', com_id),
//                 JSON_OBJECT('type', 'contest-detail', 'contestId', com_id),
//                 NOW()
//             FROM Competition
//         `, [userId]);

//         const [rows] = await pool.execute(`
//             SELECT
//                 notification_id AS id,
//                 type,
//                 user_id AS userId,
//                 message,
//                 source_id AS sourceId,
//                 source_key AS sourceKey,
//                 action_json AS action,
//                 DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt,
//                 read_at IS NOT NULL AS \`read\`
//             FROM Notification
//             WHERE user_id = ?
//             ORDER BY created_at DESC, notification_id DESC
//         `, [userId]);

//         const notifications = rows.map(row => ({
//             ...row,
//             read: Boolean(row.read),
//             action: typeof row.action === 'string' ? JSON.parse(row.action) : row.action
//         }));
//         res.json({ ok: true, notifications });
//     } catch (err) {
//         console.error('Database Error (Notifications):', err.message);
//         res.status(500).json({ ok: false, error: '無法取得通知資料' });
//     }
// });


// 通知 API：所有有通知鈴鐺的頁面都會透過這組 API 和資料庫同步通知。
app.get('/notifications', async (req, res) => {
    const userId = Number(req.query.userId);
    if (!Number.isFinite(userId)) {
        return res.status(400).json({ ok: false, error: '缺少有效的 userId' });
    }
});
//     if (!Number.isFinite(userId) || !message) {
//         return res.status(400).json({ ok: false, error: '缺少通知接收者或通知內容' });
//     }

//     try {
//         await pool.execute(`
//             INSERT INTO Notification (user_id, type, message, source_id, source_key, action_json)
//             VALUES (?, ?, ?, ?, ?, ?)
//             ON DUPLICATE KEY UPDATE
//                 message = VALUES(message),
//                 action_json = VALUES(action_json),
//                 created_at = CURRENT_TIMESTAMP,
//                 read_at = NULL
//         `, [userId, type, message, sourceId, sourceKey, JSON.stringify(action)]);
//         res.json({ ok: true });
//     } catch (err) {
//         console.error('Database Error (Create Notification):', err.message);
//         res.status(500).json({ ok: false, error: '無法新增通知' });
//     }
// });

// app.patch('/notifications/read', async (req, res) => {
//     const userId = Number(req.body.userId);
//     const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
//     if (!Number.isFinite(userId)) {
//         return res.status(400).json({ ok: false, error: '缺少有效的 userId' });
//     }

//     try {
//         if (ids.length) {
//             await pool.execute(
//                 `UPDATE Notification SET read_at = COALESCE(read_at, NOW())
//                  WHERE user_id = ? AND notification_id IN (${ids.map(() => '?').join(',')})`,
//                 [userId, ...ids]
//             );
//         } else {
//             await pool.execute(
//                 'UPDATE Notification SET read_at = COALESCE(read_at, NOW()) WHERE user_id = ?',
//                 [userId]
//             );
//         }
//         res.json({ ok: true });
//     } catch (err) {
//         console.error('Database Error (Read Notifications):', err.message);
//         res.status(500).json({ ok: false, error: '無法更新通知已讀狀態' });
//     }
// });

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.status(204).end();
});

// --- API routes ---
app.use('/api/auth', authRouter);
app.use('/api/review', reviewRouter);
app.use('/api/teams', teamRouter);
app.use('/api/contests', comRouter);
app.use('/api/pv', pvRouter); // 這條路由需要登入驗證

// 4. 啟動伺服器
app.listen(port, () => {
    console.log(`伺服器啟動成功：http://localhost:${port}`);
})



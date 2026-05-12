// server/controllers/authController.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// 建立資料庫連線池
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT, 
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false } // Aiven 雲端連線建議加上此行
});

// --- 註冊邏輯 ---
export const register = async (req, res) => {
    const { username, password} = req.body || {};
    
    if (!username || !password) {
        return res.status(400).json({ ok: false, error: '資料填寫不完整' });
    }

    try {
        // 1. 檢查使用者是否已存在 (SQL: SELECT)
        const [existing] = await pool.execute(
            'SELECT account FROM user WHERE account = ?',
            [username]
        );

        if (existing.length > 0) {
            return res.status(409).json({ ok: false, error: '該使用者帳號已存在' });
        }

        // 2. 執行註冊 (SQL: INSERT)
        // 我們不需要手動處理 id，因為資料庫設定了 AUTO_INCREMENT
        const [result] = await pool.execute(
            'INSERT INTO user (account, userPsw) VALUES (?, ?)',
            [username, password]
        );

        // 3. 回傳結果 (insertId 是資料庫自動產生的新 ID)
        res.json({ ok: true, userId: result.insertId, message: '註冊成功' });

    } catch (err) {
        console.error('Database Error (Register):', err.message);
        res.status(500).json({ ok: false, error: '伺服器錯誤，無法完成註冊' });
    }
};

// --- 登入邏輯 ---
export const login = async (req, res) => {
    const { username, password} = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ 
            ok: false, 
            error: '請完整輸入帳號、密碼並選擇身分' 
        });
    }

    try {
        // 1. 尋找使用者 (SQL: SELECT)
        // 同時比對帳號、密碼與身分
        const [rows] = await pool.execute(
            'SELECT user_id, account FROM user WHERE account = ? AND userPsw = ?',
            [username, password]
        );

        // 2. 比對結果
        if (rows.length === 0) {
            return res.status(401).json({ 
                ok: false, 
                error: '帳號、密碼或身分錯誤' 
            });
        }

        const user = rows[0];
        console.log(`使用者 ${user.username} (ID: ${user.id}) 登入成功`);

        res.json({ 
            ok: true, 
            message: '登入成功',
            userId: user.id,
        });

    } catch (err) {
        console.error('Database Error (Login):', err.message);
        res.status(500).json({ ok: false, error: '伺服器內部錯誤' });
    }
};
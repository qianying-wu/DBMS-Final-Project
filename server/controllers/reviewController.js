import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// 建立資料庫連線池（建議之後把這段抽出來放 db.js，大家共用）
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT, 
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

const forbiddenWords = ['混蛋', '垃圾', '廢物', '懶惰'];

export const submitReview = async (req, res) => {
    // 1. 從 req.body 拿資料 (這就是 postman 傳來的東西)
    const { team_id, reviewer_id, target_user_id, score, comment } = req.body;

    // 2. 驗證邏輯
    if (!team_id || !reviewer_id || !target_user_id || !score) {
        return res.status(400).json({ ok: false, error: '缺少必要欄位' });
    }

    if (score < 1 || score > 5) {
        return res.status(400).json({ ok: false, error: '評分須介於 1-5 之間' });
    }

    // 3. 髒話過濾
    if (comment) {
        const foundBadWord = forbiddenWords.find(word => comment.includes(word));
        if (foundBadWord) {
            return res.status(400).json({ ok: false, error: `評論包含不當用語: ${foundBadWord}` });
        }
    }

    try {
        // 4. 寫入資料庫
        const sql = `
            INSERT INTO reviews (team_id, reviewer_id, target_user_id, score, comment)
            VALUES (?, ?, ?, ?, ?)
        `;
        await pool.execute(sql, [team_id, reviewer_id, target_user_id, score, comment || null]);

        res.json({ ok: true, message: '評價成功送出' });
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ ok: false, error: '伺服器資料庫錯誤' });
    }
};
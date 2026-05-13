import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { checkContent } from '../util/wordfilter.js'; // 匯入工具

dotenv.config();

// 建立資料庫連線池（建議之後把這段抽出來放 db.js，大家共用）
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT, 
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

export const submitReview = async (req, res) => {
    // 1. 從 req.body 拿資料 (這就是 postman 傳來的東西)
    const {com_id, userWrite_id, userRec_id, star, rev_content } = req.body;

    // 2. 驗證邏輯
    if (!com_id || !userWrite_id || !userRec_id || !star) {
        return res.status(400).json({ ok: false, error: '缺少必要欄位' });
    }

    if (star < 1 || star > 5) {
        return res.status(400).json({ ok: false, error: '評分須介於 1-5 之間' });
    }

    // 3. 髒話過濾
    if (rev_content) {
        const isBad = checkContent(rev_content);

        if (isBad) {
            return res.status(400).json({ 
                ok: false, 
                error: '評論包含不當用語，請修正後再提交！',
                // (選填) 也可以給他看過濾後的樣子： suggestion: cleanText 
            });
        }
    }

    try {
        // 4. 寫入資料庫
        const sql = `
            INSERT INTO Review (com_id, userWrite_id, userRec_id, star, rev_content)
            VALUES (?, ?, ?, ?, ?)
        `;
        await pool.execute(sql, [com_id, userWrite_id, userRec_id, star, rev_content || null]);

        res.json({ ok: true, message: '評價成功送出' });
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ ok: false, error: '伺服器資料庫錯誤' });
    }
};
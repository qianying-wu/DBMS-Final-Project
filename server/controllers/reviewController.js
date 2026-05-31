import pool from '../models/db.js';
import { checkContent } from '../util/wordfilter.js'; // 匯入工具

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
        // 🌟 修正：把物件裡面的 isBad 跟 cleanText 拿出來
        const { isBad, cleanText } = checkContent(rev_content);

        if (isBad) {
            return res.status(400).json({ 
                ok: false, 
                error: '評論包含不當用語，請修正後再提交！'
            });
        }
        
        // 如果你想自動幫他把髒話變成 *** 存進資料庫，可以加這行：
        // rev_content = cleanText; 
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

// 獲取特定使用者的歷史評價
export const getReviews = async (req, res) => {
    // 從網址列抓取被評價者的 ID
    const { userId } = req.params; 

    try {
        // 去 Review 表格撈出該用戶的所有評價，順便去 user 表格關聯出「留言者」的名字
        const sql = `
            SELECT 
                r.star, 
                r.rev_content, 
                u.userName AS reviewer_name 
            FROM Review r
            LEFT JOIN user u ON r.userWrite_id = u.user_id
            WHERE r.userRec_id = ?
        `;
        const [rows] = await pool.execute(sql, [userId]);

        res.json({ ok: true, data: rows });
    } catch (error) {
        console.error('讀取歷史評價失敗:', error);
        res.status(500).json({ ok: false, error: '伺服器資料庫錯誤' });
    }
};
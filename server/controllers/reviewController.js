import pool from '../models/db.js';
import { checkContent } from '../util/wordfilter.js';

const COMPLETED_STATUS = 'completed';
const MEMBER_ACCEPTED = '通過';
const ROLE_OWNER = '建立人';

export const submitReview = async (req, res) => {
    // 1. 從 req.body 拿資料
    const { com_id, team_id, userWrite_id, userRec_id, star, rev_content } = req.body;
    const currentUserId = req.user?.user_id;

    // 2. 驗證邏輯
    if (!com_id || !team_id || !userWrite_id || !userRec_id || !star) {
        return res.status(400).json({ ok: false, error: '缺少必要欄位，請從已完賽隊伍進入評價。' });
    }

    if (String(currentUserId) !== String(userWrite_id)) {
        return res.status(403).json({ ok: false, error: '登入身分與評價者不一致，請重新登入後再試。' });
    }

    if (star < 1 || star > 5) {
        return res.status(400).json({ ok: false, error: '評分須介於 1-5 之間' });
    }

    if (String(userWrite_id) === String(userRec_id)) {
        return res.status(400).json({ ok: false, error: '不能評價自己，請選擇曾合作過的隊友。' });
    }

    // 3. 髒話過濾
    if (rev_content) {
        const { isBad, cleanText } = checkContent(rev_content);

        if (isBad) {
            return res.status(400).json({ 
                ok: false, 
                error: '評論包含不當用語，請修正後再提交！'
            });
        }
    }

    try {
        const [teamRows] = await pool.execute(
            `SELECT teamStatus FROM Team WHERE team_id = ? AND com_id = ?`,
            [team_id, com_id]
        );

        if (teamRows.length === 0) {
            return res.status(404).json({ ok: false, error: '找不到這支隊伍對應的比賽。' });
        }

        if ((teamRows[0].teamStatus || '') !== COMPLETED_STATUS) {
            return res.status(403).json({
                ok: false,
                error: '隊伍尚未標記為完賽，完賽後才能評價隊友。'
            });
        }

        const [memberRows] = await pool.execute(
            `
                SELECT m.user_id
                FROM Membership m
                WHERE m.team_id = ?
                  AND m.user_id IN (?, ?)
                  AND (m.mem_status = ? OR m.role = ?)
            `,
            [team_id, userWrite_id, userRec_id, MEMBER_ACCEPTED, ROLE_OWNER]
        );

        const memberIds = new Set(memberRows.map(row => String(row.user_id)));
        if (!memberIds.has(String(userWrite_id)) || !memberIds.has(String(userRec_id))) {
            return res.status(403).json({
                ok: false,
                error: '只能評價同一個歷史隊伍中曾合作過的隊友。'
            });
        }

        // ==========================================
        // 🌟 新的防護網：檢查「這場比賽」是否已經評價過
        // ==========================================
        const checkSql = `
            SELECT rev_id 
            FROM Review 
            WHERE userWrite_id = ? AND userRec_id = ? AND com_id = ?
        `;
        // 這裡把 com_id 也加進去當作查詢條件
        const [existingReviews] = await pool.execute(checkSql, [userWrite_id, userRec_id, com_id]);

        // 如果找到紀錄，代表在這場比賽已經留過言了
        if (existingReviews.length > 0) {
            return res.status(400).json({ 
                ok: false, 
                error: '您已經在這場比賽中評價過這位隊友囉！若要修改，請先刪除舊評價。' 
            });
        }
        // ==========================================

        // 4. 寫入資料庫
        const insertSql = `
            INSERT INTO Review (com_id, userWrite_id, userRec_id, star, rev_content)
            VALUES (?, ?, ?, ?, ?)
        `;
        await pool.execute(insertSql, [com_id, userWrite_id, userRec_id, star, rev_content || null]);

        res.json({ ok: true, message: '評價成功送出' });
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ ok: false, error: '伺服器資料庫錯誤' });
    }
};

// 獲取特定使用者的歷史評價
export const getReviews = async (req, res) => {
    const { userId } = req.params; 

    try {
        const sql = `
            SELECT 
                r.rev_id,
                r.userWrite_id,
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

export const deleteReview = async (req, res) => {
    const { revId } = req.params; 
    const currentUserId = req.user.user_id; 

    try {
        const sql = 'DELETE FROM Review WHERE rev_id = ? AND userWrite_id = ?';
        const [result] = await pool.execute(sql, [revId, currentUserId]);

        if (result.affectedRows === 0) {
            return res.status(403).json({ ok: false, error: '無權限刪除此評價，或評價不存在' });
        }

        res.json({ ok: true, message: '評價已成功刪除' });
    } catch (error) {
        console.error('刪除評價失敗:', error);
        res.status(500).json({ ok: false, error: '伺服器資料庫錯誤' });
    }
};

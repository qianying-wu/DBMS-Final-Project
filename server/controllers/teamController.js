// server/controllers/teamController.js
import pool from '../models/db.js';

// 取得單一隊伍詳細資訊（包含比賽資訊）
export const getTeamDetail = async (req, res) => {
    const { teamId } = req.params;
    try {
        // 使用 JOIN 一次抓出隊伍和比賽資料
        const [rows] = await pool.query(`
            SELECT 
                t.*,                                 -- 取得隊伍所有欄位 (id, name, desc, members, slots 等)
                c.com_name AS contestName,           -- 資料庫 com_name -> 前端 contestName
                c.com_date AS contestDate,           -- 資料庫 com_date -> 前端 contestDate
                c.com_intro AS contestInfo,          -- 資料庫 com_intro -> 前端 contestInfo (對應 displayContestInfo)
                c.com_link AS officialUrl,           -- 資料庫 com_link -> 前端 officialUrl
                c.com_location AS location,          -- 若詳情頁有地點需求
                c.com_reward AS reward               -- 若詳情頁有獎勵需求
            FROM Team t 
            LEFT JOIN Competition c ON t.com_id = c.com_id 
            WHERE t.team_id = ?`, [teamId]);

        if (rows.length === 0) return res.status(404).json({ message: "找不到該隊伍" });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// 取得所有比賽與隊伍 (用於 team.html 總覽)
export const getAllData = async (req, res) => {
    try {
       // 1. 取得比賽列表 (用於左側選單或 Grid)
        const [contests] = await pool.query(`
            SELECT 
                com_id AS id, 
                com_name AS name, 
                com_date AS date, 
                com_intro AS info 
            FROM Competition
        `);

        // 2. 取得隊伍列表 (用於中間卡片)
        const [teams] = await pool.query(`
            SELECT 
                t.*, 
                c.com_name AS contestName 
            FROM Team t 
            LEFT JOIN Competition c ON t.com_id = c.com_id
        `);
        res.json({ contests, teams });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 處理加入申請 (取代原本存進 localStorage 的邏輯)
export const applyToTeam = async (req, res) => {
    const { teamId, userId, applicationData } = req.body;
    try {
        await pool.query(
            'INSERT INTO join_requests (team_id, user_id, application_json, status) VALUES (?, ?, ?, "pending")',
            [teamId, userId, JSON.stringify(applicationData)]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
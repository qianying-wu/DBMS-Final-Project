// server/controllers/teamController.js
import pool from '../models/db.js';

// 建立隊伍
export const createTeam = async (req, res) => {

    // 從前端傳過來的 body 裡面解構出資料
    const {com_id, teamStatus, num_limit, demand, team_name, current_member_count} = req.body;

    try {
        // 2. 修正為 MySQL 語法：移除雙引號、移除 RETURNING
        const sql = `
        INSERT INTO Team (com_id, teamStatus, num_limit, demand, team_name, current_member_count)
        VALUES (?, ?, ?, ?, ?, ?);
        `;
        const values = [com_id, teamStatus, num_limit, demand, team_name, current_member_count];

        // 3. 執行 MySQL 查詢
        const [result] = await pool.query(sql, values);
        // 4. 🚀 關鍵：MySQL 取得自動遞增的 ID 是透過 result.insertId
        const newTeamId = result.insertId; 
        // 5. 回傳成功訊息給前端
        return res.status(201).json({
        success: true,
        message: '隊伍建立成功',
        teamId: newTeamId
        });

    } catch (error) {
        console.error('❌ Controller 建立隊伍失敗:', error);
        return res.status(500).json({ message: '伺服器錯誤，無法寫入資料庫' });
    }
};

// 取得單一隊伍詳細資訊（包含比賽資訊）
export const getTeamDetail = async (req, res) => {
    const { teamId } = req.params;
    try {
        // 使用 JOIN 一次抓出隊伍和比賽資料
        const [rows] = await pool.query(`
            SELECT 
                t.*,                                 -- 取得隊伍所有欄位 (id, name, desc, members, slots 等) 啊這邊為什麼不改成跟前端對應的欄位名稱？因為前端的 teamDetail 只會用到 team_name、demand、current_member_count、num_limit，其他欄位都不會用到，所以就不特別改了。
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

//查詢比賽結果
export const contestsResult = async (req, res) => {
    // 1. 從網址後方的 Query String 取得關鍵字，例如 /api/contests/search?q=黑客松
    const keyword = req.query.q || ''; 
    
    try {
        // 2. 撰寫 MySQL 模糊搜尋語法
        const sql = `
            SELECT com_id, com_name, com_date, com_intro 
            FROM Competition 
            WHERE com_name LIKE ? OR com_intro LIKE ?;
        `;
        
        // 3. 把關鍵字前後加上 % 符號
        const searchTerm = `%${keyword}%`;
        const [rows] = await pool.query(sql, [searchTerm, searchTerm]);
        
        // 4. 回傳搜尋結果陣列
        res.json(rows);
    } catch (error) {
        console.error('❌ 資料庫搜尋比賽失敗:', error);
        res.status(500).json({ message: '伺服器搜尋錯誤' });
    }
}

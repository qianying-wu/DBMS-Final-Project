// server/controllers/teamController.js
import pool from '../models/db.js';

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

export const applyToTeam = async (req, res) => {
  const { user_id, team_id } = req.body;

  if (!user_id || !team_id) {
    return res.status(400).json({ success: false, message: '缺少必要參數' });
  }

  try {
    // 1. 防呆：檢查是否已經申請過或已經是團員
    const [existing] = await pool.execute(
      'SELECT mem_status FROM Membership WHERE user_id = ? AND team_id = ?',
      [user_id, team_id]
    );

    if (existing.length > 0) {
      const status = existing[0].mem_status;
      return res.status(400).json({ 
        success: false, 
        message: status === '申請中' ? '你已送出申請，請勿重複點擊' : '你已經是此隊伍成員' 
      });
    }

    // 2. 防呆：檢查隊伍人數是否已滿 (比對當前人數與上限)
    const [teamCheck] = await pool.execute(
      'SELECT current_member_count, num_limit FROM Team WHERE team_id = ?',
      [team_id]
    );
    if (teamCheck.length === 0) return res.status(404).json({ success: false, message: '找不到該隊伍' });
    
    if (teamCheck[0].current_member_count >= teamCheck[0].num_limit) {
      return res.status(400).json({ success: false, message: '該隊伍人數已滿，無法申請' });
    }

    // 3. 核心：寫入 Membership 表，設定為 組員 / 申請中
    await pool.execute(
      `INSERT INTO Membership (user_id, team_id, role, mem_status) 
       VALUES (?, ?, '組員', '申請中')`,
      [user_id, team_id]
    );

    res.status(200).json({ success: true, message: '申請已成功送出' });

  } catch (error) {
    console.error('後端申請出錯:', error);
    res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  }
};

// 建立隊伍與membership
export const createTeam = async (req, res) => {
    // 🚀 終極相容：不管是底線 com_id 還是小駝峰 contestId，通通都接收！
    const com_id = req.body.com_id || req.body.comId || req.body.contestId || req.body.contest_id;
    const { team_name, demand, num_limit, user_id } = req.body;
  
    // 檢查到底是哪一個欄位沒傳過來
    if (!team_name || !com_id || !user_id) {
      return res.status(400).json({ 
        success: false, 
        message: `缺少必要欄位！收到的 team_name: ${team_name}, com_id: ${com_id}, user_id: ${user_id}` 
      });
    }
  
    const connection = await pool.getConnection();
  
    try {
      await connection.beginTransaction();
  
      // 1. 插入新隊伍
      const [teamResult] = await connection.execute(
        `INSERT INTO Team (team_name, com_id, demand, num_limit, current_member_count, teamStatus) 
         VALUES (?, ?, ?, ?, 1, 'active')`, 
        [team_name, com_id, demand || '尚未填寫說明', num_limit || 4]
      );
  
      const newTeamId = teamResult.insertId;
  
      // 2. 同步寫入 Membership
      await connection.execute(
        `INSERT INTO Membership (user_id, team_id, role, mem_status) 
         VALUES (?, ?, '建立人', '通過')`,
        [Number(user_id), newTeamId]
      );
  
      await connection.commit();
  
      res.status(201).json({
        success: true,
        message: '隊伍建立成功！',
        team_id: newTeamId
      });
  
    } catch (error) {
      await connection.rollback();
      console.error('建立隊伍與 Membership 失敗:', error);
      res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    } finally {
      connection.release();
    }
  };
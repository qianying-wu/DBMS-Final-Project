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
                c.com_id AS id, 
                c.com_name AS name, 
                c.com_date AS date, 
                c.com_intro AS info,
                IFNULL(GROUP_CONCAT(ct.comType), '') AS comType            
                FROM Competition c
            LEFT JOIN ComCat cc ON c.com_id = cc.com_id
            LEFT JOIN Com_type ct ON cc.comType_id = ct.comType_id
            GROUP BY c.com_id, c.com_name, c.com_date, c.com_intro        
            `);

    // 2. 取得隊伍列表 (用於中間卡片)
    const [teams] = await pool.query(`
            SELECT 
                t.*, 
                t.teamStatus AS team_status,
                c.com_name AS contestName 
            FROM Team t 
            LEFT JOIN Competition c ON t.com_id = c.com_id
            WHERE COALESCE(t.teamStatus, 'active') = 'active'
        `);
    res.json({ contests, teams });
  } catch (error) {
    console.error('❌ 後端 getAllData 其實有錯：', error.message);
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
  const { user_id, team_id, resume_id } = req.body;

  // 1. 基本參數防呆（加入 resume_id 檢查）
  if (!user_id || !team_id || !resume_id) {
    return res.status(400).json({ success: false, message: '缺少必要參數（使用者、隊伍或履歷識別碼）' });
  }

  // 取得資料庫連線，準備使用交易 (Transaction) 確保競爭條件安全
  const connection = await pool.getConnection();

  try {
    // 開啟交易
    await connection.beginTransaction();

    // 2. 檢查是否已經申請過或已經是團員
    const [existing] = await connection.execute(
      'SELECT mem_status FROM Membership WHERE user_id = ? AND team_id = ?',
      [user_id, team_id]
    );

    if (existing.length > 0) {
      await connection.rollback(); // 記得要回滾交易
      const status = existing[0].mem_status;
      return res.status(400).json({
        success: false,
        message: status === '申請中' ? '你已送出申請，請勿重複點擊' : '你已經是此隊伍成員'
      });
    }

    // 3. 安全檢查：確認這份履歷真的是這個使用者的（選填，但對後端安全很有幫助）
    const [resumeCheck] = await connection.execute(
      'SELECT resume_id FROM Resumes WHERE resume_id = ? AND user_id = ?',
      [resume_id, user_id]
    );
    if (resumeCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '無效的履歷資料' });
    }

    // 4. 檢查隊伍人數是否已滿 (加上 FOR UPDATE 鎖定這列資料，防止其他人同時讀取修改)
    const [teamCheck] = await connection.execute(
      'SELECT current_member_count, num_limit FROM Team WHERE team_id = ? FOR UPDATE',
      [team_id]
    );
    if (teamCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '找不到該隊伍' });
    }

    if (teamCheck[0].current_member_count >= teamCheck[0].num_limit) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '該隊伍人數已滿，無法申請' });
    }

    // 5. 核心：寫入 Membership 表
    await connection.execute(
      `INSERT INTO Membership (user_id, team_id, role, mem_status, resume_id) 
       VALUES (?, ?, '組員', '申請中', ?)`,
      [user_id, team_id, resume_id]
    );

    // 提交交易
    await connection.commit();
    res.status(200).json({ success: true, message: '申請已成功送出' });

  } catch (error) {
    // 遇到任何錯誤，必須將資料庫狀態回滾
    await connection.rollback();
    console.error('❌ 後端申請出錯:', error);
    res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  } finally {
    // 👑 萬分重要：不論成功或失敗，一定要釋放連線回連線池
    connection.release();
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

// 取得「已加入的隊伍」---------邏輯：在 Membership 中狀態為 '通過'，且不論他是組員還是建立人（或者你想排除建立人，可改為 role = '組員'）
export const getMyJoinedTeams = async (req, res) => {
  const { userId } = req.query;

  if (!userId) return res.status(400).json({ success: false, message: '缺少使用者 ID' });

  try {
    const [teams] = await pool.execute(
<<<<<<< Updated upstream
      `SELECT 
        t.team_id, 
        t.team_name, 
        t.current_member_count, 
        t.num_limit, 
        t.teamStatus,
        c.com_name AS com_name -- 👑 關鍵：把競賽名稱撈出來
       FROM Membership m
       JOIN Team t ON m.team_id = t.team_id
       LEFT JOIN Competition c ON t.com_id = c.com_id -- 👑 關鍵：關聯到你的競賽表 (請依實際欄位修改)
=======
      `SELECT t.team_id, t.team_name, t.com_id, c.com_name, t.current_member_count, t.num_limit, t.teamStatus, t.teamStatus AS team_status
       FROM Membership m
       JOIN Team t ON m.team_id = t.team_id
       LEFT JOIN Competition c ON t.com_id = c.com_id
>>>>>>> Stashed changes
       WHERE m.user_id = ? AND m.mem_status = '通過'`,
      [userId]
    );

    res.status(200).json({ success: true, data: teams });
  } catch (error) {
    console.error('SQL 撈取已加入隊伍出錯:', error);
    res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  }
};

// 取得「我收藏的隊伍」
export const getMyFavoriteTeams = async (req, res) => {
    const { userId } = req.query;
  
    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少使用者 ID' });
    }
  
    try {
      // 🚀 雙表聯查：直接拿收藏的 team_id 串接 team 資料表
      const [favTeams] = await pool.execute(
        `SELECT t.team_id, t.team_name
         FROM user_favorites_team f
         JOIN Team t ON f.team_id = t.team_id
         WHERE f.user_id = ? AND t.teamStatus = 'active'`,
        [userId]
      );
  
      res.status(200).json({ 
        success: true, 
        data: favTeams 
      });
    } catch (error) {
      console.error('❌ SQL 撈取收藏隊伍出錯:', error);
      res.status(500).json({ success: false, message: '伺服器資料庫錯誤' });
    }
};

// 取得「我建立的隊伍」-------邏輯：在 Membership 中 role = '建立人' 的所有隊伍
export const getMyOwnedTeams = async (req, res) => {
  const { userId } = req.query;

  if (!userId) return res.status(400).json({ success: false, message: '缺少使用者 ID' });

  try {
    const [teams] = await pool.execute(
<<<<<<< Updated upstream
      `SELECT 
        t.team_id, 
        t.team_name, 
        t.current_member_count, 
        t.num_limit, 
        t.teamStatus,
        c.com_name AS com_name -- 👑 關鍵：把競賽名稱撈出來
       FROM Membership m
       JOIN Team t ON m.team_id = t.team_id
       LEFT JOIN Competition c ON t.com_id = c.com_id -- 👑 關鍵：關聯到你的競賽表 (請依實際欄位修改)
=======
      `SELECT t.team_id, t.team_name, t.com_id, c.com_name, t.current_member_count, t.num_limit, t.teamStatus, t.teamStatus AS team_status
       FROM Membership m
       JOIN Team t ON m.team_id = t.team_id
       LEFT JOIN Competition c ON t.com_id = c.com_id
>>>>>>> Stashed changes
       WHERE m.user_id = ? AND m.role = '建立人'`,
      [userId]
    );

    res.status(200).json({ success: true, data: teams });
  } catch (error) {
    console.error('SQL 撈取建立隊伍出錯:', error);
    res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  }
};

// 收藏 / 取消收藏
export const updateTeamStatus = async (req, res) => {
  const { team_id, status, user_id } = req.body;
  const allowedStatuses = new Set(['active', 'completed', 'disbanded']);

  if (!team_id || !status || !user_id) {
    return res.status(400).json({ success: false, message: '缺少必要欄位' });
  }

  if (!allowedStatuses.has(status)) {
    return res.status(400).json({ success: false, message: '不支援的隊伍狀態' });
  }

  try {
    const [ownerRows] = await pool.execute(
      `SELECT user_id
       FROM Membership
       WHERE team_id = ? AND user_id = ? AND role = '建立人'`,
      [team_id, user_id]
    );

    if (ownerRows.length === 0) {
      return res.status(403).json({ success: false, message: '只有隊伍建立人可以變更隊伍狀態' });
    }

    await pool.execute(
      `UPDATE Team SET teamStatus = ? WHERE team_id = ?`,
      [status, team_id]
    );

    const [teamRows] = await pool.execute(
      `SELECT t.team_id, t.team_name, t.com_id, c.com_name, t.current_member_count, t.num_limit, t.teamStatus, t.teamStatus AS team_status
       FROM Team t
       LEFT JOIN Competition c ON t.com_id = c.com_id
       WHERE t.team_id = ?`,
      [team_id]
    );

    return res.status(200).json({
      success: true,
      message: status === 'completed' ? '隊伍已標記為完賽' : '隊伍狀態已更新',
      data: teamRows[0] || null
    });
  } catch (error) {
    console.error('更新隊伍狀態失敗:', error);
    return res.status(500).json({ success: false, message: '伺服器資料庫錯誤' });
  }
};

export const toggleFavorite = async (req, res) => {
    const { userId, teamId } = req.body;
  
    // 1. 基本安全檢查：確保前端有把這兩個重要的 ID 傳過來
    if (!userId || !teamId) {
      return res.status(400).json({ success: false, message: '缺少必要參數 userId 或 teamId' });
    }
  
    try {
      // 2. 🚀 精準查詢：[favRows] 加括號解構，確保拿到的是資料陣列
      const [favRows] = await pool.execute(
        'SELECT * FROM user_favorites_team WHERE user_id = ? AND team_id = ?',
        [Number(userId), Number(teamId)]
      );
  
      console.log(`[收藏除錯] 查詢 user_id: ${userId}, team_id: ${teamId} 找到的資料筆數: ${favRows.length}`);
  
      // 3. 核心偵測機制
      if (favRows && favRows.length > 0) {
        // 🎯 後端明確偵測到：這筆收藏「已經存在」了 -> 代表使用者現在點擊是要「取消收藏」
        console.log('👉 狀態：已存在，執行 [取消收藏] DELETE 動作');
        
        await pool.execute(
          'DELETE FROM user_favorites_team WHERE user_id = ? AND team_id = ?',
          [Number(userId), Number(teamId)]
        );
        
        return res.status(200).json({ 
          success: true, 
          action: 'unfavorite', 
          message: '已成功從資料庫取消收藏！' 
        });
  
      } else {
        // 🎯 後端明確偵測到：這筆收藏「不存在」 -> 代表使用者現在點擊是要「新增收藏」
        console.log('👉 狀態：不存在，執行 [新增收藏] INSERT 動作');
        
        await pool.execute(
          'INSERT INTO user_favorites_team (user_id, team_id) VALUES (?, ?)',
          [Number(userId), Number(teamId)]
        );
        
        return res.status(201).json({ 
          success: true, 
          action: 'favorite', 
          message: '已成功寫入資料庫收藏！' 
        });
      }
  
    } catch (error) {
      console.error('❌ 後端偵測/切換收藏時發生 SQL 錯誤:', error);
      res.status(500).json({ success: false, message: '伺服器內部錯誤，請檢查資料庫欄位' });
    }
  };

export const getTeamMember = async (req, res) => {
  try {
    const { teamId } = req.query;
    if (!teamId) return res.status(400).json({ message: '缺少 teamId' });

    // 1. 撈取隊伍基本資料
    const [teamRows] = await pool.execute(
      `SELECT * FROM Team WHERE team_id = ?`, 
      [teamId]
    );
    if (teamRows.length === 0) return res.status(404).json({ message: '找不到該隊伍' });

    // 2. 👑 關鍵：撈取該隊伍的所有 Membership 成員，並 JOIN 填入使用者與履歷名稱
    // 這樣前端過濾 mem_status === '申請中' 才有資料可用！
    const [memberRows] = await pool.execute(`
      SELECT 
        m.user_id,
        m.role,
        m.mem_status,
        m.resume_id,
        u.userName,
        p.resume_name
      FROM Membership m
      LEFT JOIN user u ON m.user_id = u.user_id
      LEFT JOIN Resumes p ON m.resume_id = p.resume_id
      WHERE m.team_id = ?
    `, [teamId]);

    // 回傳給前端
    return res.status(200).json({
      team: teamRows[0],
      members: memberRows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '伺服器內部錯誤' });
  }
};

export const reviewApplication = async (req, res) => {
  try {
    const { team_id, user_id, action } = req.body;
    // 安全檢查：實務上這裡還要額外驗證「發出請求的人是不是該隊伍的隊長」

    if (!team_id || !user_id || !action) {
      return res.status(400).json({ message: '參數不完整' });
    }

    // 🌟 動作一：審核通過
    if (action === 'pass') {
      // 先把使用者的狀態改成通過
      await pool.execute(
        `UPDATE Membership SET mem_status = '通過' WHERE team_id = ? AND user_id = ?`,
        [team_id, user_id]
      );
      
      // 修正為正確的資料表 (Team) 與資料庫呼叫 (pool)
      await pool.execute(
        `UPDATE Team SET current_member_count = current_member_count + 1 WHERE team_id = ?`, 
        [team_id]
      );

      return res.status(200).json({ message: '已成功核准加入隊伍' });
    }

    // 🌟 動作二：拒絕申請（從資料庫直接拔掉）
    if (action === 'reject') {
      await pool.execute(
        `DELETE FROM Membership WHERE team_id = ? AND user_id = ? AND mem_status = '申請中'`,
        [team_id, user_id]
      );
      return res.status(200).json({ message: '已成功拒絕並刪除申請紀錄' });
    }

    return res.status(400).json({ message: '未知的審核動作' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '伺服器審核失敗' });
  }
};

// 檢查使用者對於特定隊伍的加入狀態
export const checkApplyStatus = async (req, res) => {
  const { userId, teamId } = req.query;

  if (!userId || !teamId) {
    return res.status(400).json({ success: false, message: '缺少參數' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT mem_status 
       FROM Membership 
       WHERE user_id = ? AND team_id = ?`,
      [userId, teamId]
    );

    // 如果有紀錄，就回傳目前的狀態（例如：'申請中'、'通過'）
    if (rows.length > 0) {
      return res.status(200).json({ success: true, status: rows[0].mem_status });
    }

    // 沒有紀錄代表從未申請過
    res.status(200).json({ success: true, status: 'none' });
  } catch (error) {
    console.error('❌ SQL 檢查申請狀態出錯:', error);
    res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  }
};
<<<<<<< Updated upstream

export const updateStatus = async (req, res) => {
  const { team_id, status } = req.body;
  const userId = req.user.id; // 💡 從 verifyToken 解析出來的目前登入用戶 ID

  // 1. 基本安全驗證：防呆與檢查參數
  if (!team_id || !status) {
    return res.status(400).json({ success: false, message: '缺少必要參數 team_id 或 status' });
  }

  // 只允許變更為 completed 或 disbanded，防止前端惡意傳入非法字串
  if (status !== 'completed' && status !== 'disbanded') {
    return res.status(400).json({ success: false, message: '不合法的隊伍狀態變更行為' });
  }

  try {

    if (teamRows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到該隊伍資料' });
    }


    // 3. 核心操作：直接更新資料庫中 Teams 表的 team_status 欄位
    await pool.query(
      'UPDATE Team SET team_status = ? WHERE team_id = ?', 
      [status, team_id]
    );

    // 4. (選填/優化) 如果隊伍解散或完賽，你可能也會想把 Membership 裡面還在「申請中」的人自動改成「拒絕」
    if (status === 'disbanded' || status === 'completed') {
      await pool.query(
        "UPDATE Membership SET mem_status = '已結束' WHERE team_id = ? AND mem_status = '申請中'",
        [team_id]
      );
    }

    // 5. 成功回應前端
    return res.status(200).json({ 
      success: true, 
      message: `隊伍狀態已成功變更為 ${status}` 
    });

  } catch (error) {
    console.error('❌ 後端變更隊伍狀態失敗:', error);
    return res.status(500).json({ success: false, message: '伺服器內部錯誤，請稍後再試' });
  }


}
=======
>>>>>>> Stashed changes

// server/controllers/teamController.js
import pool from '../models/db.js';

const ACTIVE_STATUS = 'active';
const COMPLETED_STATUS = 'completed';
const DISBANDED_STATUS = 'disbanded';
const MEMBER_ACCEPTED = '通過';
const MEMBER_PENDING = '申請中';
const ROLE_OWNER = '建立人';
const ROLE_MEMBER = '組員';

export const getTeamDetail = async (req, res) => {
  const teamId = req.params.teamId || req.query.teamId;

  if (!teamId) return res.status(400).json({ message: '缺少 teamId' });

  try {
    const [rows] = await pool.query(`
      SELECT
        t.*,
        t.teamStatus AS team_status,
        c.com_name AS contestName,
        c.com_date AS contestDate,
        c.com_intro AS contestInfo,
        c.com_link AS officialUrl,
        c.com_location AS location,
        c.com_reward AS reward
      FROM Team t
      LEFT JOIN Competition c ON t.com_id = c.com_id
      WHERE t.team_id = ?
    `, [teamId]);

    if (rows.length === 0) return res.status(404).json({ message: '找不到該隊伍' });
    return res.json(rows[0]);
  } catch (error) {
    console.error('讀取隊伍詳細資料失敗:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getAllData = async (req, res) => {
  try {
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

    const [teams] = await pool.query(`
      SELECT
        t.*,
        t.teamStatus AS team_status,
        c.com_name AS contestName
      FROM Team t
      LEFT JOIN Competition c ON t.com_id = c.com_id
      WHERE COALESCE(t.teamStatus, ?) = ?
    `, [ACTIVE_STATUS, ACTIVE_STATUS]);

    return res.json({ contests, teams });
  } catch (error) {
    console.error('getAllData failed:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const contestsResult = async (req, res) => {
  const keyword = req.query.q || '';

  try {
    const searchTerm = `%${keyword}%`;
    const [rows] = await pool.query(
      `SELECT com_id, com_name, com_date, com_intro
       FROM Competition
       WHERE com_name LIKE ? OR com_intro LIKE ?`,
      [searchTerm, searchTerm]
    );

    return res.json(rows);
  } catch (error) {
    console.error('搜尋競賽失敗:', error);
    return res.status(500).json({ message: '伺服器搜尋錯誤' });
  }
};

export const applyToTeam = async (req, res) => {
  const { user_id, team_id, resume_id } = req.body;

  if (!user_id || !team_id || !resume_id) {
    return res.status(400).json({ success: false, message: '缺少必要參數（使用者、隊伍或履歷識別碼）' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      'SELECT mem_status FROM Membership WHERE user_id = ? AND team_id = ?',
      [user_id, team_id]
    );

    if (existing.length > 0) {
      await connection.rollback();
      const status = existing[0].mem_status;
      return res.status(400).json({
        success: false,
        message: status === MEMBER_PENDING ? '你已送出申請，請勿重複點擊' : '你已經是此隊伍成員'
      });
    }

    const [resumeCheck] = await connection.execute(
      'SELECT resume_id FROM Resumes WHERE resume_id = ? AND user_id = ?',
      [resume_id, user_id]
    );

    if (resumeCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '無效的履歷資料' });
    }

    const [teamCheck] = await connection.execute(
      'SELECT current_member_count, num_limit, teamStatus FROM Team WHERE team_id = ? FOR UPDATE',
      [team_id]
    );

    if (teamCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '找不到該隊伍' });
    }

    if ((teamCheck[0].teamStatus || ACTIVE_STATUS) !== ACTIVE_STATUS) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '此隊伍目前不開放申請' });
    }

    if (teamCheck[0].current_member_count >= teamCheck[0].num_limit) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '該隊伍人數已滿，無法申請' });
    }

    await connection.execute(
      `INSERT INTO Membership (user_id, team_id, role, mem_status, resume_id)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, team_id, ROLE_MEMBER, MEMBER_PENDING, resume_id]
    );

    await connection.commit();
    return res.status(200).json({ success: true, message: '申請已成功送出' });
  } catch (error) {
    await connection.rollback();
    console.error('申請加入隊伍失敗:', error);
    return res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  } finally {
    connection.release();
  }
};

export const createTeam = async (req, res) => {
  const com_id = req.body.com_id || req.body.comId || req.body.contestId || req.body.contest_id;
  const { team_name, demand, num_limit, user_id } = req.body;

  if (!team_name || !com_id || !user_id) {
    return res.status(400).json({
      success: false,
      message: `缺少必要欄位：team_name=${team_name}, com_id=${com_id}, user_id=${user_id}`
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [teamResult] = await connection.execute(
      `INSERT INTO Team (team_name, com_id, demand, num_limit, current_member_count, teamStatus)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [team_name, com_id, demand || '尚未填寫需求', num_limit || 4, ACTIVE_STATUS]
    );

    const newTeamId = teamResult.insertId;

    await connection.execute(
      `INSERT INTO Membership (user_id, team_id, role, mem_status)
       VALUES (?, ?, ?, ?)`,
      [Number(user_id), newTeamId, ROLE_OWNER, MEMBER_ACCEPTED]
    );

    await connection.commit();
    return res.status(201).json({ success: true, message: '隊伍建立成功', team_id: newTeamId });
  } catch (error) {
    await connection.rollback();
    console.error('建立隊伍與 Membership 失敗:', error);
    return res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  } finally {
    connection.release();
  }
};

export const getMyJoinedTeams = async (req, res) => {
  const { userId } = req.query;

  if (!userId) return res.status(400).json({ success: false, message: '缺少使用者 ID' });

  try {
    const [teams] = await pool.execute(
      `SELECT t.team_id, t.team_name, t.com_id, c.com_name, t.current_member_count, t.num_limit, t.teamStatus, t.teamStatus AS team_status
       FROM Membership m
       JOIN Team t ON m.team_id = t.team_id
       LEFT JOIN Competition c ON t.com_id = c.com_id
       WHERE m.user_id = ? AND m.mem_status = ?`,
      [userId, MEMBER_ACCEPTED]
    );

    return res.status(200).json({ success: true, data: teams });
  } catch (error) {
    console.error('取得已加入隊伍失敗:', error);
    return res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  }
};

export const getMyFavoriteTeams = async (req, res) => {
  const { userId } = req.query;

  if (!userId) return res.status(400).json({ success: false, message: '缺少使用者 ID' });

  try {
    const [favTeams] = await pool.execute(
      `SELECT t.team_id, t.team_name
       FROM user_favorites_team f
       JOIN Team t ON f.team_id = t.team_id
       WHERE f.user_id = ? AND t.teamStatus = ?`,
      [userId, ACTIVE_STATUS]
    );

    return res.status(200).json({ success: true, data: favTeams });
  } catch (error) {
    console.error('取得收藏隊伍失敗:', error);
    return res.status(500).json({ success: false, message: '伺服器資料庫錯誤' });
  }
};

export const getMyOwnedTeams = async (req, res) => {
  const { userId } = req.query;

  if (!userId) return res.status(400).json({ success: false, message: '缺少使用者 ID' });

  try {
    const [teams] = await pool.execute(
      `SELECT t.team_id, t.team_name, t.com_id, c.com_name, t.current_member_count, t.num_limit, t.teamStatus, t.teamStatus AS team_status
       FROM Membership m
       JOIN Team t ON m.team_id = t.team_id
       LEFT JOIN Competition c ON t.com_id = c.com_id
       WHERE m.user_id = ? AND m.role = ?`,
      [userId, ROLE_OWNER]
    );

    return res.status(200).json({ success: true, data: teams });
  } catch (error) {
    console.error('取得建立的隊伍失敗:', error);
    return res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  }
};

export const updateTeamStatus = async (req, res) => {
  const { team_id, status, user_id } = req.body;
  const allowedStatuses = new Set([ACTIVE_STATUS, COMPLETED_STATUS, DISBANDED_STATUS]);

  if (!team_id || !status || !user_id) {
    return res.status(400).json({ success: false, message: '缺少必要欄位' });
  }

  if (!allowedStatuses.has(status)) {
    return res.status(400).json({ success: false, message: '不支援的隊伍狀態' });
  }

  try {
    const [ownerRows] = await pool.execute(
      `SELECT user_id FROM Membership WHERE team_id = ? AND user_id = ? AND role = ?`,
      [team_id, user_id, ROLE_OWNER]
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
      message: status === COMPLETED_STATUS ? '隊伍已標記為完賽' : '隊伍狀態已更新',
      data: teamRows[0] || null
    });
  } catch (error) {
    console.error('更新隊伍狀態失敗:', error);
    return res.status(500).json({ success: false, message: '伺服器資料庫錯誤' });
  }
};

export const toggleFavorite = async (req, res) => {
  const { userId, teamId } = req.body;

  if (!userId || !teamId) {
    return res.status(400).json({ success: false, message: '缺少必要參數 userId 或 teamId' });
  }

  try {
    const [favRows] = await pool.execute(
      'SELECT * FROM user_favorites_team WHERE user_id = ? AND team_id = ?',
      [Number(userId), Number(teamId)]
    );

    if (favRows.length > 0) {
      await pool.execute(
        'DELETE FROM user_favorites_team WHERE user_id = ? AND team_id = ?',
        [Number(userId), Number(teamId)]
      );
      return res.status(200).json({ success: true, action: 'unfavorite', message: '已取消收藏' });
    }

    await pool.execute(
      'INSERT INTO user_favorites_team (user_id, team_id) VALUES (?, ?)',
      [Number(userId), Number(teamId)]
    );

    return res.status(201).json({ success: true, action: 'favorite', message: '已加入收藏' });
  } catch (error) {
    console.error('收藏/取消收藏失敗:', error);
    return res.status(500).json({ success: false, message: '伺服器內部錯誤，請檢查資料庫欄位' });
  }
};

export const getTeamMember = async (req, res) => {
  const { teamId } = req.query;

  if (!teamId) return res.status(400).json({ message: '缺少 teamId' });

  try {
    const [teamRows] = await pool.execute(
      `SELECT *, teamStatus AS team_status FROM Team WHERE team_id = ?`,
      [teamId]
    );

    if (teamRows.length === 0) return res.status(404).json({ message: '找不到該隊伍' });

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

    return res.status(200).json({ team: teamRows[0], members: memberRows });
  } catch (error) {
    console.error('取得隊伍成員失敗:', error);
    return res.status(500).json({ message: '伺服器內部錯誤' });
  }
};

export const reviewApplication = async (req, res) => {
  const { team_id, user_id, action } = req.body;

  if (!team_id || !user_id || !action) {
    return res.status(400).json({ message: '參數不完整' });
  }

  try {
    if (action === 'pass') {
      await pool.execute(
        `UPDATE Membership SET mem_status = ? WHERE team_id = ? AND user_id = ?`,
        [MEMBER_ACCEPTED, team_id, user_id]
      );

      await pool.execute(
        `UPDATE Team SET current_member_count = current_member_count + 1 WHERE team_id = ?`,
        [team_id]
      );

      return res.status(200).json({ message: '已成功核准加入隊伍' });
    }

    if (action === 'reject') {
      await pool.execute(
        `DELETE FROM Membership WHERE team_id = ? AND user_id = ? AND mem_status = ?`,
        [team_id, user_id, MEMBER_PENDING]
      );

      return res.status(200).json({ message: '已成功拒絕並刪除申請紀錄' });
    }

    return res.status(400).json({ message: '未知的審核動作' });
  } catch (error) {
    console.error('審核申請失敗:', error);
    return res.status(500).json({ message: '伺服器審核失敗' });
  }
};

export const checkApplyStatus = async (req, res) => {
  const { userId, teamId } = req.query;

  if (!userId || !teamId) {
    return res.status(400).json({ success: false, message: '缺少參數' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT mem_status FROM Membership WHERE user_id = ? AND team_id = ?`,
      [userId, teamId]
    );

    if (rows.length > 0) {
      return res.status(200).json({ success: true, status: rows[0].mem_status });
    }

    return res.status(200).json({ success: true, status: 'none' });
  } catch (error) {
    console.error('檢查申請狀態失敗:', error);
    return res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  }
};

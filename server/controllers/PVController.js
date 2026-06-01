// controllers/PVController.js
import pool from '../models/db.js';

export const saveResume = async (req, res) => {
    // 還記得之前的 Token 嗎？後端驗證完 Token 後，會把 user_id 塞在 req.user 裡面
    const userId = req.user.user_id; // 從 JWT Token 辨識是誰在要資料

    // 從前端的 body 裡面拿到這些對齊好的欄位
    const {
        resume_id,
        resume_name,
        user_pv_name,
        user_school,
        department_grade,
        user_intro,
        tags              // 前端傳過來的陣列，例如: ["Python", "SQL", "Express"]
    } = req.body;

    // 因為涉及多張表的連續操作，建議用資料庫交易 (Transaction) 防止寫入到一半壞掉
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        let currentResumeId = resume_id;

        // --- 步驟 1：寫入或更新 resumes 主表 ---
        if (currentResumeId) {
            // 情況 A：如果是修改舊履歷
            // 🎯 使用 COALESCE(?, 欄位名)，如果第一個參數傳進來是 NULL，MySQL 就會自動採用原本欄位裡的值！
            const updateSql = `
                UPDATE Resumes
                SET 
                    resume_name      = COALESCE(?, resume_name),
                    user_pv_name     = COALESCE(?, user_pv_name),
                    user_school      = COALESCE(?, user_school),
                    department_grade = COALESCE(?, department_grade),
                    user_intro       = COALESCE(?, user_intro)
                WHERE resume_id = ? AND user_id = ?
            `;

            // ⚠️ 這裡要特別小心：如果前端沒傳某些欄位，變數會是 undefined。
            // 必須用「變數 || null」把它轉成 MySQL 看得懂的 NULL，COALESCE 機制才會啟動！
            await connection.query(updateSql, [
                resume_name || null,
                user_pv_name || null,
                user_school || null,
                department_grade || null,
                user_intro || null,
                currentResumeId,
                userId
            ]);
        } else {
            // 情況 B：如果是建立全新履歷
            const insertSql = `
                INSERT INTO Resumes (user_id, resume_name, user_pv_name, user_school, department_grade, user_intro) 
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const [result] = await connection.query(insertSql, [userId, resume_name, user_pv_name, user_school, department_grade, user_intro]);
            currentResumeId = result.insertId; // 🌟 撈出這份新履歷在資料庫裡自動生成的 ID！
        }
        // --- 步驟 2：清除舊的標籤連線 ---
        // 不管是新是舊，先把這份履歷在 Resume_tags 裡的舊資料清空，等一下重新建立，最乾淨！

        console.log('=== 準備寫入標籤關聯 ===');
        console.log('當前履歷 ID (currentResumeId):', currentResumeId);
        console.log('前端傳來的標籤陣列 (tags):', tags);
        await connection.query('DELETE FROM Resume_tags WHERE resume_id = ?', [currentResumeId]);

        // --- 步驟 3 & 4：處理專長標籤 (多對多處理) ---
        if (tags && tags.length > 0) {
            for (let tagName of tags) {
                tagName = tagName.trim();
                if (!tagName) continue;

                // 3.1 檢查標籤在 tags 總表裡存在了沒
                const [existingTag] = await connection.query('SELECT tag_id FROM Person_tags WHERE tag_name = ?', [tagName]);
                let currentTagId;
                if (existingTag.length > 0) {
                    currentTagId = existingTag[0].tag_id;
                } else {
                    // 如果是世界上第一次出現的新標籤（例如：'Express'），就新增進總表
                    const [newTagResult] = await connection.query('INSERT INTO Person_tags (tag_name) VALUES (?)', [tagName]);
                    currentTagId = newTagResult.insertId;
                }// 4.1 把這份履歷的 ID 跟標籤的 ID 綁定，寫入中介表
                await connection.query('INSERT INTO Resume_tags (resume_id, tag_id) VALUES (?, ?)', [currentResumeId, currentTagId]);
            }
        }
        // 提交本次的所有變更
        await connection.commit();
        res.json({
            ok: true,
            message: '履歷與專長標籤已成功存入資料庫！',
            resumeId: currentResumeId
        });
    } catch (error) {
        // 萬一中間有任何一步出錯，全部撤回，確保資料庫不會留下一半的髒資料
        await connection.rollback();
        console.error('儲存履歷失敗：', error);
        res.status(500).json({ ok: false, message: '後端資料庫寫入失敗' });
    } finally {
        connection.release();
    }
};
// ======================================================================
// 拿資料
export const loadResumes = async (req, res) => {
    const userId = req.user.user_id; // 從 JWT Token 辨識是誰在要資料
    try {
        // 使用正確的 table/column 名稱（與 saveResume 中使用的一致）
        // 回傳格式調整為前端期待的 shape：{ id, name, createdAt, updatedAt, data: {...}, tags: [...] }
        const sql = `
            SELECT 
                r.resume_id,
                r.resume_name,
                r.user_pv_name,
                r.user_school,
                r.department_grade,
                r.user_intro,
                r.created_at,
                r.updated_at,
                GROUP_CONCAT(t.tag_name) AS tag_list
            FROM Resumes r
            LEFT JOIN Resume_tags rt ON r.resume_id = rt.resume_id
            LEFT JOIN Person_tags t ON rt.tag_id = t.tag_id
            WHERE r.user_id = ?
            GROUP BY r.resume_id
            ORDER BY r.resume_id DESC
        `;

        const [rows] = await pool.query(sql, [userId]);

        const formattedResumes = rows.map(row => ({
            id: row.resume_id,
            name: row.resume_name,
            user_pv_name: row.user_pv_name,
            createdAt: row.created_at || null,
            updatedAt: row.updated_at || null,
            data: {
                resume_name: row.resume_name || '未命名履歷',
                user_pv_name: row.user_pv_name || '匿名',
                school: row.user_school,
                grade: row.department_grade,
                intro: row.user_intro
            },
            tags: row.tag_list ? row.tag_list.split(',') : []
        }));

        res.json(formattedResumes);
    } catch (error) {
        console.error('撈取履歷列表失敗：', error);
        res.status(500).json({ ok: false, message: '伺服器內部錯誤' });
    }
};

// ======================================================================
//刪 PV
export const deleteResume = async (req, res) => {
    const userId = req.user.user_id;
    const { id } = req.params; // 從網址 /api/resumes/:id 拿到要刪除的 ID
    try {
        // 由於資料庫通常有外鍵約束（Foreign Key），保險起見我們先手動把中介表的標籤連結斷開
        await pool.query('DELETE FROM Resume_tags WHERE resume_id = ?', [id]);
        // 接著刪除履歷主表，且必須加上 user_id 確保不能刪到別人的履歷
        const [result] = await pool.query('DELETE FROM Resumes WHERE resume_id = ? AND user_id = ?', [id, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ ok: false, message: '找不到該履歷或無權限刪除' });
        }
        res.json({ ok: true, message: '履歷已成功從資料庫刪除！' });
    } catch (error) {
        console.error('刪除履歷失敗：', error);
        res.status(500).json({ ok: false, message: '刪除失敗' });
    }
};

// ======================================================================
// 獲取特定使用者的最新履歷 (給評價頁面或別人看的)
export const getTargetResume = async (req, res) => {
    // 這個 API 是要看別人的，所以從網址列抓取要查詢的 userId，而不是從 token 抓
    const targetUserId = req.query.userId;

    if (!targetUserId) {
        return res.status(400).json({ ok: false, message: '必須提供 userId' });
    }

    try {
        const sql = `
            SELECT 
                r.resume_id,
                r.resume_name,
                r.user_pv_name,
                r.user_school,
                r.department_grade,
                r.user_intro,
                r.created_at,
                r.updated_at,
                GROUP_CONCAT(t.tag_name) AS tag_list
            FROM Resumes r
            LEFT JOIN Resume_tags rt ON r.resume_id = rt.resume_id
            LEFT JOIN Person_tags t ON rt.tag_id = t.tag_id
            WHERE r.user_id = ?
            GROUP BY r.resume_id
            ORDER BY r.resume_id DESC
            LIMIT 1 
        `;
        // LIMIT 1 的意思是：如果他有很多份履歷，我們預設只抓最新建立的那一份給評價頁面看。

        const [rows] = await pool.query(sql, [targetUserId]);

        if (rows.length === 0) {
            return res.status(404).json({ ok: false, message: '找不到該用戶的履歷' });
        }

        const row = rows[0];

        // 把格式整理得跟之前前端 extractResume 期待的形狀一樣
        const formattedResume = {
            id: row.resume_id,
            name: row.resume_name,
            applicantName: row.user_pv_name || '匿名', // review.js 的 extractResume 吃這個
            school: row.user_school,
            grade: row.department_grade,
            experience: '目前沒有經驗欄位', // 你的 db 沒有這欄位，先給預設
            intro: row.user_intro,
            tags: row.tag_list ? row.tag_list.split(',') : []
        };

        res.json(formattedResume);
    } catch (error) {
        console.error('撈取他人履歷失敗：', error);
        res.status(500).json({ ok: false, message: '伺服器內部錯誤' });
    }
};

// 👑 新增 API：取得特定使用者所有的履歷簡要列表（僅名稱與ID）
export const getMyResumeList = async (req, res) => {
    const { userId } = req.query;
  
    if (!userId) {
      return res.status(400).json({ success: false, message: '必須提供 userId' });
    }
  
    try {
      // 撈取該用戶的所有履歷，依時間由新到舊排序
      const [rows] = await pool.query(
        `SELECT resume_id, resume_name 
         FROM Resumes 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [userId]
      );
  
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: '找不到任何履歷' });
      }
  
      // 轉換成前端好讀的欄位名稱
      const list = rows.map(row => ({
        id: row.resume_id,
        name: row.resume_name || '未命名履歷'
      }));
  
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      console.error('❌ 撈取用戶履歷列表失敗：', error);
      res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
  };
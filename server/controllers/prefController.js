import pool from '../models/db.js';


// 1. 【讀取偏好】GET /api/auth/preferences
export const getUserPreferences = async (req, res) => {
    const userId = req.user?.id || req.user?.user_id || req.user?.userId;
    if (!userId) return res.status(400).json({ success: false, message: '缺少使用者驗證 ID' });

    try {
        // 🚀 雙表聯查：從使用者偏好表出發，串回總表拿 comType_key
        const sql = `
            SELECT t.comType
            FROM UserPreference up
            JOIN Com_type t ON up.comType_id = t.comType_id
            WHERE up.user_id = ?
        `;
        const [rows] = await pool.execute(sql, [userId]);

        // 把 [{comType: "hackathon"}, {comType: "uiux"}] 
        // 轉成前端要的純字串陣列 ["hackathon", "uiux"]
        const keys = rows.map(row => row.comType);

        return res.status(200).json({ success: true, data: keys });
    } catch (error) {
        console.error('❌ 撈取使用者偏好失敗:', error);
        return res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
};

// 2. 【儲存與更新偏好】POST /api/auth/preferences
export const saveUserPreferences = async (req, res) => {
    const userId = req.user?.id || req.user?.user_id || req.user?.userId;
    const { preferences } = req.body; // 前端傳過來的陣列，例如：["hackathon", "uiux"]

    if (!userId) return res.status(400).json({ success: false, message: '缺少使用者驗證 ID' });

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // 🚀 步驟 A：先刪除該使用者在 UserPreference 裡的所有舊紀錄
        await connection.query('DELETE FROM UserPreference WHERE user_id = ?', [userId]);

        // 🚀 步驟 B：如果前端有勾選新標籤，逐一查出 comType_id 並塞入中介表
        if (preferences && preferences.length > 0) {
            for (let key of preferences) {
                // 根據前端傳來的 key (如 'hackathon') 查出資料庫真正的自增 id
                const [typeRow] = await connection.query('SELECT comType_id FROM Com_type WHERE comType_key = ?', [key]);

                if (typeRow.length > 0) {
                    const comTypeId = typeRow[0].comType_id;
                    // 寫入使用者偏好表
                    await connection.query(
                        'INSERT INTO UserPreference (user_id, comType_id) VALUES (?, ?)',
                        [userId, comTypeId]
                    );
                }
            }
        }

        await connection.commit();
        return res.status(200).json({ success: true, message: '個人化偏好設定同步成功！' });

    } catch (error) {
        await connection.rollback();
        console.error('❌ 儲存使用者偏好失敗:', error);
        return res.status(500).json({ success: false, message: '資料庫寫入失敗' });
    } finally {
        connection.release();
    }
};

// 3. 【取得所有可用的偏好標籤】GET /api/pref/allPrefTags
export const getAvailableTags = async (req, res) => {
    try {
        // 💡 對齊你的表格欄位：comType_id, comType_key, comType
        const sql = `SELECT comType_id, comType_key, comType FROM Com_type`;
        const [rows] = await pool.execute(sql);

        return res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('❌ 撈取 Com_type 總表失敗:', error);
        return res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
};
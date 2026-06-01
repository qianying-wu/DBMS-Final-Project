// server/controllers/contestController.js
import pool from '../models/db.js';

//撈比賽
// 🚀 升級版：支援動態聯查標籤的 getAllContests
export const getAllContests = async (req, res) => {
    try {
        // 📝 升級 SQL：使用 LEFT JOIN 串接中介表 ComCat 與總表 Com_type
        // 並用 GROUP_CONCAT 把該比賽的所有標籤名稱用逗號 ',' 實時串接成 com_tags
        const sql = `
            SELECT 
                c.com_id, 
                c.com_name, 
                c.com_date, 
                c.com_enroll_ddl, 
                c.com_intro, 
                c.com_link, 
                c.com_location, 
                c.com_reward, 
                c.com_fee,
                GROUP_CONCAT(ct.comType SEPARATOR ',') AS tags
            FROM Competition c
            LEFT JOIN ComCat cc ON c.com_id = cc.com_id
            LEFT JOIN Com_type ct ON cc.comType_id = ct.comType_id
            GROUP BY c.com_id
            ORDER BY c.com_id DESC
        `;

        const [rows] = await pool.query(sql);

        // 把撈出來、內含 com_tags 欄位的陣列用 JSON 格式回傳給前端
        return res.json(rows);
    } catch (error) {
        console.error('❌ 撈取比賽資料失敗:', error);
        return res.status(500).json({ message: '伺服器錯誤，無法讀取比賽' });
    }
};
// export const getAllContests = async (req, res) => {
//     try {
//         // 📝 執行 SQL：從資料庫撈取比賽
//         const [rows] = await pool.query('SELECT com_id, com_name, com_date, com_enroll_ddl, com_intro, com_link, com_location, com_reward, com_fee FROM Competition');

//         // 把撈出來的陣列用 JSON 格式回傳給前端
//         return res.json(rows);
//     } catch (error) {
//         console.error('❌ 撈取比賽資料失敗:', error);
//         return res.status(500).json({ message: '伺服器錯誤，無法讀取比賽' });
//     }
// };

// 收藏 / 取消收藏
export const toggleFavorite = async (req, res) => {
    // 💡 調整：將 teamId 改為 comId
    const { userId, comId } = req.body;

    // 1. 基本安全檢查：確保前端有把這兩個重要的 ID 傳過來
    if (!userId || !comId) {
        return res.status(400).json({ success: false, message: '缺少必要參數 userId 或 comId' });
    }

    try {
        // 2. 🚀 精準查詢：對準新表 user_favorites_com 與 com_id
        const [favRows] = await pool.execute(
            'SELECT * FROM user_favorites_com WHERE user_id = ? AND com_id = ?',
            [Number(userId), Number(comId)]
        );

        console.log(`[比賽收藏除錯] 查詢 user_id: ${userId}, com_id: ${comId} 找到的資料筆數: ${favRows.length}`);

        // 3. 核心偵測機制
        if (favRows && favRows.length > 0) {
            // 🎯 後端明確偵測到：這筆收藏「已經存在」了 -> 代表使用者現在點擊是要「取消收藏」
            console.log('👉 狀態：已存在，執行 [取消比賽收藏] DELETE 動作');

            await pool.execute(
                'DELETE FROM user_favorites_com WHERE user_id = ? AND com_id = ?',
                [Number(userId), Number(comId)]
            );

            return res.status(200).json({
                success: true,
                action: 'unfavorite',
                message: '已成功從資料庫取消收藏該比賽！'
            });

        } else {
            // 🎯 後端明確偵測到：這筆收藏「不存在」 -> 代表使用者現在點擊是要「新增收藏」
            console.log('👉 狀態：不存在，執行 [新增比賽收藏] INSERT 動作');

            await pool.execute(
                'INSERT INTO user_favorites_com (user_id, com_id) VALUES (?, ?)',
                [Number(userId), Number(comId)]
            );

            return res.status(201).json({
                success: true,
                action: 'favorite',
                message: '已成功將比賽寫入資料庫收藏！'
            });
        }

    } catch (error) {
        console.error('❌ 後端偵測/切換比賽收藏時發生 SQL 錯誤:', error);
        res.status(500).json({ success: false, message: '伺服器內部錯誤，請檢查資料庫欄位' });
    }
};

// 撈我收藏的比賽
export const getMyFavoriteContests = async (req, res) => {
    console.log("=== 控制器開始執行 ===");
    const userId = req.user.id || req.user.user_id || req.user.userId;
    if (!userId) {
        return res.status(400).json({ success: false, message: '缺少使用者 ID' });
    }

    try {
        // 🚀 雙表聯查：直接拿收藏的 com_id 串接 Competition 資料表
        const [favConstests] = await pool.execute(
            `SELECT c.com_id, c.com_name, c.com_intro
         FROM user_favorites_com f
         JOIN Competition c ON f.com_id = c.com_id
         WHERE f.user_id = ? AND c.com_id IS NOT NULL`, // 確保比賽資料存在，避免撈到已被刪除的比賽
            [userId]
        );

        res.status(200).json({
            success: true,
            data: favConstests
        });
    } catch (error) {
        console.error('❌ SQL 撈取收藏比賽出錯:', error);
        res.status(500).json({ success: false, message: '伺服器資料庫錯誤' });
    }
};
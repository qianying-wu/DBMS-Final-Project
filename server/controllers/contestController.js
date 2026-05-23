// // server/controllers/contestController.js
// import pool from '../models/db.js';

// export const getAllContests = async (req, res) => {
//     try {
//         // 📝 執行 SQL：從資料庫撈取比賽
//         const [rows] = await pool.query('SELECT com_id, com_name, com_date, com_intro FROM Competition');
        
//         // 把撈出來的陣列用 JSON 格式回傳給前端
//         return res.json(rows);
//     } catch (error) {
//         console.error('❌ 撈取比賽資料失敗:', error);
//         return res.status(500).json({ message: '伺服器錯誤，無法讀取比賽' });
//     }
// };
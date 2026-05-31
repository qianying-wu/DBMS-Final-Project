// import pool from '../models/db.js';

// export const getComData = async (req, res) => {
//     try {
//        // 1. 取得比賽列表
//         const [contests] = await pool.query(`
//             SELECT 
//                 com_id AS id, 
//                 com_name AS name, 
//                 com_date AS date, 
//                 com_intro AS info 
//             FROM Competition
//         `);

//         res.json({ contests: contests });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };
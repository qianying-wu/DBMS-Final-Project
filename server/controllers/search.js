/*搜尋競賽：從 Competition 表中比對 com_name，讓參賽者快速找到想參加的比賽。
搜尋隊伍 ：從 Team 表中比對 teamStatus 或 demand（需求簡述），
幫使用者過濾出「招募中」或符合特定需求的隊伍 。  
搜尋人才（技能搜尋） ：這最關鍵。它會去 User 表找姓名，同時去 Skill 表找標籤。
例如搜尋「Java」，它會找出所有在 UserSk 中關聯了 Java 標籤的用戶 。
*/

const express = require('express');
const router = express.Router();
const db = require('./db'); 

// 全域搜尋 API: 支援搜尋 1.競賽 2.隊伍 3.人才(技能)
router.get('/global-search', async (req, res) => {
    const { q } = req.query; 
    const keyword = `%${q}%`;

    try {
        // 1. 搜尋競賽資訊 (根據 com_name) 
        const compQuery = `
            SELECT com_id as id, com_name as name, 'competition' as type 
            FROM Competition 
            WHERE com_name LIKE ?`;

        // 2. 搜尋隊伍 (根據 teamStatus 或 demand 描述) 
        const teamQuery = `
            SELECT team_id as id, teamStatus as name, 'team' as type, demand
            FROM Team 
            WHERE teamStatus LIKE ? OR demand LIKE ?`;

        // 3. 搜尋具有特定技能的人 (根據 userName 或技能名稱 skName) 
        // 注意：這裡將 UserSkill 修改為 UserSk 以符合你們的規格 
        const userQuery = `
            SELECT DISTINCT u.user_id as id, u.userName as name, 'user' as type
            FROM User u
            LEFT JOIN UserSk us ON u.user_id = us.user_id
            LEFT JOIN Skill s ON us.sk_id = s.sk_id
            WHERE u.userName LIKE ? OR s.skName LIKE ?`;

        // 同時執行三個查詢
        const [compResults, teamResults, userResults] = await Promise.all([
            db.query(compQuery, [keyword]),
            db.query(teamQuery, [keyword, keyword]),
            db.query(userQuery, [keyword, keyword])
        ]);

        // 回傳整合後的結果
        res.json({
            success: true,
            data: {
                competitions: compResults[0],
                teams: teamResults[0],
                users: userResults[0]
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "搜尋引擎發生錯誤" });
    }
});

module.exports = router;
/*查看隊友評價：降低遇到雷隊友的機率，也了解自身的優缺點
在整個網站中，用戶能夠點擊到其他用戶頁面的地方，都能查看其他用戶的評價。
例如搜尋引擎搜尋到A用戶，點擊後則可以查看A用戶的公開履歷。
學生在瀏覽隊伍列表的時候，點擊隊伍除了可以查看隊伍資訊，也可以查看該隊伍內現有隊員的公開履歷
學生提出加入隊伍申請時，該隊伍成員也可點開此學生的公開履歷做查看
*/

const express = require('express');
const router = express.Router();
const db = require('./db'); // 確保資料庫連線正確 

// 功能 7：查看用戶公開履歷與評價
router.get('/user-profile/:userId', async (req, res) => {
    const targetId = req.params.userId;

    try {
        // 1. 取得基本資訊 (User)
        const userSql = `
            SELECT userName, user_intro, user_school, user_department 
            FROM User WHERE user_id = ?`;
        
        // 2. 取得經驗履歷 (Experience)
        const expSql = `
            SELECT title, exp_type, exp_date, exp_desc 
            FROM Experience WHERE user_id = ? 
            ORDER BY exp_date DESC`;

        // 3. 取得隊友評價 (Review)，並 JOIN 競賽名稱顯示這筆評價是在哪場比賽得到的
        const revSql = `
            SELECT r.star, r.rev_content, r.rev_date, c.com_name
            FROM Review r
            LEFT JOIN Competition c ON r.com_id = c.com_id
            WHERE r.receiver_id = ? 
            ORDER BY r.rev_date DESC`;

        // 同時執行三個查詢
        const [userResults, expResults, revResults] = await Promise.all([
            db.query(userSql, [targetId]),
            db.query(expSql, [targetId]),
            db.query(revSql, [targetId])
        ]);

        if (userResults[0].length === 0) {
            return res.status(404).json({ success: false, message: "找不到該使用者" });
        }

        // 回傳整合後的完整履歷資料
        res.json({
            success: true,
            data: {
                profile: userResults[0][0],
                experiences: expResults[0],
                reviews: revResults[0]
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "讀取履歷失敗" });
    }
});

module.exports = router;
import pool from '../models/db.js';

//dotenv.config();

// --- 註冊邏輯 ---
export const register = async (req, res) => {
    console.log('後端收到的內容:', req.body); 
    const { account,userName,userPsw,userEmail} = req.body || {};
    
    if (!account || !userPsw || !userName || !userEmail) {  
        return res.status(400).json({ ok: false, error: '資料填寫不完整' });
    }

    try {
        // 1. 檢查使用者是否已存在 (SQL: SELECT)
        const [existing] = await pool.execute(
            'SELECT account, userEmail FROM user WHERE account = ? OR userEmail = ?',
            [account, userEmail]
        );
        if (existing.length > 0) {
            // 精確判斷是哪一個重複
            const conflict = existing[0];
            if (conflict.account === account) {
                return res.status(409).json({ ok: false, error: '使用者帳號已存在，請更換帳號' });
            }
            if (conflict.userEmail === userEmail) {
                return res.status(409).json({ ok: false, error: '此 Email 已被註冊 哈哈' });
            }
        }

        // 2. 執行註冊 (SQL: INSERT)
        // user_id 是 AUTO_INCREMENT
        const [result] = await pool.execute(
            'INSERT INTO user (account,userName,userPsw,userEmail) VALUES (?, ?, ?, ?)',
            [account, userName, userPsw, userEmail]
           
        );

        // 3. 成功的話
        res.json({ ok: true, userId: result.insertId, message: '註冊成功' });


    } catch (err) {

        // // console.log('捕獲到的錯誤代碼:', err.code);
        // // console.log('捕獲到的完整訊息:', err.sqlMessage || err.message);

        if (err.code === 'ER_DUP_ENTRY') {
            // 根據錯誤訊息判斷是帳號重複還是 Email 重複
            if (err.sqlMessage.includes('userEmail')) {
                return res.status(409).json({ ok: false, error: '此 Email 已被註冊 哈' });
            } else if (err.sqlMessage.includes('account')) {
                return res.status(409).json({ ok: false, error: '此帳號已存在' });
            }
            // 如果分不出來，就給個通用的提示
            return res.status(409).json({ ok: false, error: '帳號或 Email 已被使用' });
        }
        console.error('Database Error (Register):', err.message);
        res.status(500).json({ ok: false, error: '伺服器錯誤，無法完成註冊' });
    }
};

// --- 登入邏輯 ---
export const login = async (req, res) => {
    const {account, userPsw} = req.body || {};

    if (!account || !userPsw) {
        return res.status(400).json({ 
            ok: false, 
            error: '請完整輸入帳號、密碼' 
        });
    }

    try {
        // 1. 尋找使用者 (SQL: SELECT)
        // 同時比對帳號、密碼
        const [rows] = await pool.execute(
            'SELECT user_id, account FROM user WHERE account = ? AND userPsw = ?',
            [account, userPsw]
        );

        // 2. 比對結果
        if (rows.length === 0) {
            return res.status(401).json({ 
                ok: false, 
                error: '帳號、密碼錯誤' 
            });
        }

        const user = rows[0];
        console.log(`使用者 ${user.account} (ID: ${user.id}) 登入成功`);

        res.json({ 
            ok: true, 
            message: '登入成功',
            userId: user.id,
        });

    } catch (err) {
        console.error('Database Error (Login):', err.message);
        res.status(500).json({ ok: false, error: '伺服器內部錯誤' });
    }
};
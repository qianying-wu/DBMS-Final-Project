import pool from '../models/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

//dotenv.config();
const saltRounds = 10;

// 系統提供的個人化標籤清單，前後端會用同一組 key 來比對推薦。
const preferenceTags = [
    { key: 'ai', label: 'AI / 機器學習' },
    { key: 'data', label: '資料分析' },
    { key: 'web', label: '網頁開發' },
    { key: 'app', label: 'App 開發' },
    { key: 'robotics', label: '機器人' },
    { key: 'security', label: '資安' },
    { key: 'medical', label: '醫療科技' },
    { key: 'fintech', label: '金融科技' },
    { key: 'sustainability', label: '永續議題' },
    { key: 'startup', label: '創業提案' },
    { key: 'design', label: 'UI/UX' },
    { key: 'presentation', label: '簡報企劃' }
];

const allowedPreferenceKeys = new Set(preferenceTags.map(tag => tag.key));

// 過濾前端傳來的標籤，只保留系統允許的 key，避免寫入奇怪資料。
const normalizePreferenceKeys = (preferences = []) => {
    if (!Array.isArray(preferences)) return [];
    return [...new Set(preferences.map(String).filter(key => allowedPreferenceKeys.has(key)))];
};

// 將使用者偏好寫入雲端資料庫；先清掉舊資料，再寫入目前選擇。
const saveUserPreferences = async (userId, preferences = []) => {
    const normalized = normalizePreferenceKeys(preferences);
    await pool.execute('DELETE FROM UserPreference WHERE user_id = ?', [userId]);

    for (const key of normalized) {
        await pool.execute(
            `INSERT INTO UserPreference (user_id, preference_id)
             SELECT ?, preference_id FROM PreferenceTag WHERE preference_key = ?`,
            [userId, key]
        );
    }

    return normalized;
};

// 從雲端資料庫讀取使用者目前的偏好 key。
const loadUserPreferences = async (userId) => {
    const [rows] = await pool.execute(
        `SELECT pt.preference_key
         FROM UserPreference up
         JOIN PreferenceTag pt ON pt.preference_id = up.preference_id
         WHERE up.user_id = ?
         ORDER BY pt.preference_id`,
        [userId]
    );
    return rows.map(row => row.preference_key);
};

// --- 註冊邏輯 ---
export const register = async (req, res) => {
    const { account, userName, userPsw, userEmail, preferences = [] } = req.body || {};

    if (!account || !userPsw || !userName || !userEmail) {
        return res.status(400).json({ ok: false, error: '資料填寫不完整' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
        return res.status(400).json({ ok: false, error: 'Email 格式錯誤' });
    }

    try {
        // 1. 檢查使用者是否已存在 (SQL: SELECT)
        const [existing] = await pool.execute(
            'SELECT account, userEmail FROM user WHERE account = ? OR userEmail = ?',
            [account, userEmail]
        );

        if (existing.length > 0) {
            // 判斷是哪一個重複
            const conflict = existing[0];
            if (conflict.account === account) {
                return res.status(409).json({ ok: false, error: '使用者帳號已存在，請更換帳號' });
            }
            if (conflict.userEmail === userEmail) {
                return res.status(409).json({ ok: false, error: '此 Email 已被註冊，請使用其他 Email' });
            }
        }
        // 2. 密碼加密
        const hashedPassword = await bcrypt.hash(userPsw, saltRounds);

        // 3. 執行註冊 (SQL: INSERT)
        const [result] = await pool.execute(
            'INSERT INTO user (account,userName,userPsw,userEmail) VALUES (?, ?, ?, ?)',
            [account, userName, hashedPassword, userEmail]
        );
        const savedPreferences = await saveUserPreferences(result.insertId, preferences);

        // 成功的話
        res.json({ ok: true, userId: result.insertId, preferences: savedPreferences, message: '註冊成功' });


    } catch (err) {

        // // console.log('捕獲到的錯誤代碼:', err.code);
        // // console.log('捕獲到的完整訊息:', err.sqlMessage || err.message);

        if (err.code === 'ER_DUP_ENTRY') {
            // 根據錯誤訊息判斷是帳號重複還是 Email 重複
            if (err.sqlMessage.includes('userEmail')) {
                return res.status(409).json({ ok: false, error: '此 Email 已被註冊' });
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
    const { account, userPsw } = req.body || {};

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
            'SELECT user_id, account, userPsw FROM user WHERE account = ?',
            [account]
        );

        // 2. 比對結果
        if (rows.length === 0) {
            return res.status(401).json({
                ok: false,
                error: '帳號或密碼錯誤'
            });
        }
        const user = rows[0];
        // 3. 密碼比對 (使用 bcrypt)
        const isMatch = await bcrypt.compare(userPsw, user.userPsw);
        if (!isMatch) {
            return res.status(401).json({
                ok: false,
                error: '帳號或密碼錯誤'
            });
        }
        console.log(`使用者 ${user.account} (ID: ${user.user_id}) 登入成功`);
        const payload = {
            user_id: user.user_id
        };
        // 簽發 Token，暗號記得是用你們的 PASSPORT_SECRET 喔
        const token = jwt.sign(payload, process.env.PASSPORT_SECRET, { expiresIn: '1d' });
        res.json({
            ok: true,
            message: '登入成功',
            userId: user.user_id,
            token: "JWT " + token, // 前端登入成功後會拿到這個 token，之後每次 API 請求都要帶在 Header 裡面
        });

    } catch (err) {
        console.error('Database Error (Login):', err.message);
        res.status(500).json({ ok: false, error: '伺服器內部錯誤' });
    }
};
// --- 取得使用者帳號資訊 ---
export const getUserAccount = async (req, res) => {
    try {
        // 1. 從請求中取得 userId
        const userId = req.user.id || req.user.user_id || req.user.userId;

        if (!userId) {
            console.log('【後端警告】查詢帳號失敗：缺少有效的 userId');
            return res.status(400).json({ ok: false, error: '缺少使用者 ID' });
        }

        console.log(`[帳號查詢] 正在撈取 user_id: ${userId} 的帳號資料...`);

        // 2. 執行 SQL 查詢 
        // 💡 請根據你資料庫真正的欄位名稱調整，這裡假設表名為 user，欄位為 account 與 user_id
        const [rows] = await pool.execute(
            'SELECT account FROM user WHERE user_id = ?',
            [Number(userId)]
        );

        // 3. 檢查資料庫有沒有這個人
        if (!rows || rows.length === 0) {
            console.log(`【後端警告】找不到 user_id: ${userId} 的使用者`);
            return res.status(404).json({ ok: false, error: '找不到該使用者' });
        }

        // 4. 成功查到，回傳給前端
        // rows[0].account 就是對應到的 Email 帳號
        return res.status(200).json({
            ok: true,
            account: rows[0].account
        });

    } catch (error) {
        console.error('❌ getUserAccount 發生 SQL 錯誤:', error);
        return res.status(500).json({ ok: false, error: '伺服器內部錯誤' });
    }
};
// --- 更新使用者密碼 ---
export const updatePsw = async (req, res) => {
    try {
        // 1. 安全防禦：優先從 Passport JWT 解密出來的 req.user 拿 id，防止前端惡意竄改別人的 userId
        const userId = req.user?.id || req.user?.user_id || req.body.userId;
        const { userPsw } = req.body; // 這就是前端傳過來的 newPassword
        if (!userId) {
            return res.status(400).json({ success: false, message: '缺少使用者 ID' });
        }
        // 2. 彈性判斷：如果前端根本沒傳密碼過來（代表使用者沒填就按儲存）
        if (!userPsw) {
            console.log(`[密碼變更] 使用者 ${userId} 未輸入新密碼，不做任何變更`);
            return res.status(200).json({
                success: true,
                message: '未偵測到密碼變更需求'
            });
        }
        console.log(`[密碼變更] 正在為 user_id: ${userId} 進行密碼加密與同步...`);
        // 3. 🔐 使用 bcrypt 進行密碼雜湊加密
        const saltRounds = 10; // 建議的加鹽複雜度
        const hashedPassword = await bcrypt.hash(userPsw, saltRounds);
        // 4. 執行 SQL 更新密碼
        // 💡 根據你的資訊：table 叫做 user，欄位分別是 userPsw 與 user_id
        const [result] = await pool.execute(
            'UPDATE user SET userPsw = ? WHERE user_id = ?',
            [hashedPassword, Number(userId)]
        );
        // 5. 檢查是否有成功更新到資料
        if (result.affectedRows === 0) {
            console.log(`【後端警告】更新密碼失敗，找不到 user_id: ${userId} 的使用者`);
            return res.status(404).json({ success: false, message: '找不到該使用者，無法更新密碼' });
        }
        console.log(`✅ [密碼變更] user_id: ${userId} 密碼已成功變更並寫入 DB！`);
        // 6. 回傳成功給前端
        return res.status(200).json({
            success: true,
            message: '密碼已成功更新！'
        });
    } catch (error) {
        console.error('❌ updateProfile 發生錯誤:', error);
        return res.status(500).json({ success: false, message: '伺服器內部錯誤' });
    }
};

// --- 取得系統可選的偏好標籤 ---
export const getPreferenceTags = async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT preference_key AS `key`, preference_name AS label FROM PreferenceTag ORDER BY preference_id'
        );
        res.json({ ok: true, tags: rows.length ? rows : preferenceTags });
    } catch (err) {
        console.error('Database Error (Preference Tags):', err.message);
        res.status(500).json({ ok: false, error: '無法取得偏好標籤' });
    }
};

// --- 取得使用者偏好 ---
export const getUserPreferences = async (req, res) => {
    const userId = Number(req.params.userId || req.query.userId);
    if (!Number.isFinite(userId)) {
        return res.status(400).json({ ok: false, error: '缺少有效的 userId' });
    }

    try {
        const preferences = await loadUserPreferences(userId);
        res.json({ ok: true, userId, preferences });
    } catch (err) {
        console.error('Database Error (Get Preferences):', err.message);
        res.status(500).json({ ok: false, error: '無法取得使用者偏好' });
    }
};

// --- 更新使用者偏好 ---
export const updateUserPreferences = async (req, res) => {
    const userId = Number(req.params.userId || req.body?.userId);
    if (!Number.isFinite(userId)) {
        return res.status(400).json({ ok: false, error: '缺少有效的 userId' });
    }

    try {
        const preferences = await saveUserPreferences(userId, req.body?.preferences || []);
        res.json({ ok: true, userId, preferences, message: '偏好已更新' });
    } catch (err) {
        console.error('Database Error (Update Preferences):', err.message);
        res.status(500).json({ ok: false, error: '無法更新使用者偏好' });
    }
};

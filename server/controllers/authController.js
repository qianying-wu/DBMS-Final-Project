// server/controllers/authController.js

// 暫時把 mockUsers 放在這裡 (或是從別處匯入)
let mockUsers = {
    testuser: { password: 'testpass', role: 'user', id: 1001 },
    maint: { password: 'maintpass', role: 'maintenance', id: 2001 }
};
let nextMockId = 3000;


export const register = (req, res) => {
    const { username, password, role } = req.body || {};
    
    // 1. 驗證格式
    if (!username || !password || !role) {
        return res.status(400).json({ ok: false, error: '資料填寫不完整' });
    }
    
    // 2. 檢查重複
    if (mockUsers[username]) {
        return res.status(409).json({ ok: false, error: '使用者已存在' });
    }

    // 3. 執行註冊 (未來這裡會換成資料庫 INSERT)
    const id = nextMockId++;
    mockUsers[username] = { password, role, id };
    
    // 4. 回傳結果
    res.json({ ok: true, userId: id });
};


export const login = (req, res) => {
    // 1. 從請求主體 (req.body) 取得前端傳來的資料
    const { username, password, role } = req.body || {};

    // 2. 基本驗證：確保欄位都沒有漏填
    if (!username || !password || !role) {
        return res.status(400).json({ 
            ok: false, 
            error: '請輸入帳號、密碼並選擇身分' 
        });
    }

    // 3. 尋找使用者：檢查帳號是否存在
    const user = mockUsers[username];

    // 4. 比對邏輯：帳號不存在、密碼不對、或身分(role)不符
    if (!user || user.password !== password || user.role !== role) {
        // 為了安全性，通常不細分是密碼錯還是帳號錯，統一回傳 401 (未授權)
        return res.status(401).json({ 
            ok: false, 
            error: '帳號、密碼或身分錯誤' 
        });
    }

    // 5. 登入成功：回傳成功訊號與該使用者的 ID (或權限)
    console.log(`使用者 ${username} 登入成功`);
    res.json({ 
        ok: true, 
        message: '登入成功',
        userId: user.id,
        role: user.role
    });
};
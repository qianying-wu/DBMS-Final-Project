// config/passport.js
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import db from "../models/db.js"; 

export default (passport) => {
  const opts = {
    // 從請求的 Header 中取出 Token（格式：JWT <token>）
    jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("jwt"),
    // 用來解密 Token 的金鑰，放在 .env 裡面
    secretOrKey: process.env.PASSPORT_SECRET,
  };

  console.log('[PASSPORT DEBUG] secretOrKey loaded:', !!process.env.PASSPORT_SECRET);
  console.log('[PASSPORT DEBUG] PASSPORT_SECRET value:', process.env.PASSPORT_SECRET);

  passport.use(
    new JwtStrategy(opts, async (jwt_payload, done) => {
      console.log('[PASSPORT DEBUG] JWT 被調用');
      console.log('[PASSPORT DEBUG] jwt_payload:', jwt_payload);
      
      try {
        // 從 Token 的內容（payload）取出使用者 ID，去資料庫查詢
        console.log('[PASSPORT DEBUG] 尋找 user_id:', jwt_payload.user_id);
        
        const [rows] = await db.query(
          "SELECT * FROM user WHERE user_id = ?",
          [jwt_payload.user_id]
        );

        console.log('[PASSPORT DEBUG] 資料庫查詢結果:', rows.length, '筆');
        
        if (rows.length > 0) {
          // 找到使用者 → 存進 req.user，後面的 middleware / controller 都能用
          console.log('[PASSPORT DEBUG] ✅ 使用者找到:', rows[0].user_id);
          return done(null, rows[0]);
        } else {
          // 找不到 → 驗證失敗
          console.log('[PASSPORT DEBUG] ❌ 使用者未找到');
          return done(null, false);
        }
      } catch (error) {
        console.error('[PASSPORT DEBUG] ❌ 錯誤:', error.message);
        return done(error, false);
      }
    })
  );
};

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

  passport.use(
    new JwtStrategy(opts, async (jwt_payload, done) => {
      try {
        // 從 Token 的內容（payload）取出使用者 ID，去資料庫查詢
        const [rows] = await db.query(
          "SELECT * FROM user WHERE user_id = ?",
          [jwt_payload._id]
        );

        if (rows.length > 0) {
          // 找到使用者 → 存進 req.user，後面的 middleware / controller 都能用
          return done(null, rows[0]);
        } else {
          // 找不到 → 驗證失敗
          return done(null, false);
        }
      } catch (error) {
        return done(error, false);
      }
    })
  );
};

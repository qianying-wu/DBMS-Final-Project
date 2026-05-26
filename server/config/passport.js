// config/passport.js
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import db from "../models/db.js"; 

export default (passport) => {
  const opts = {
    // 從請求的 Header 中取出 Token（格式：JWT <token>）
    jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("JWT"),
    // 用來解密 Token 的金鑰，放在 .env 裡面
    secretOrKey: process.env.PASSPORT_SECRET,
  };

  // passport.use(
  //   new JwtStrategy(opts, async (jwt_payload, done) => {
  //     console.log("=== 【後端測試】Passport 成功解密 Token！內容如下 ===");
  //     console.log(jwt_payload);
  //     try {
  //       // 從 Token 的內容（payload）取出使用者 ID，去資料庫查詢
  //       const [rows] = await db.query(
  //         "SELECT * FROM user WHERE user_id = ?",
  //         [jwt_payload.user_id]
  //       );

  //       if (rows.length > 0) {
  //         // 找到使用者 → 存進 req.user，後面的 middleware / controller 都能用
  //         return done(null, rows[0]);
  //       } else {
  //         // 找不到 → 驗證失敗
  //         return done(null, false);
  //       }
  //     } catch (error) {
  //       return done(error, false);
  //     }
  //   })
  // );
passport.use(
    new JwtStrategy(opts, async (jwt_payload, done) => {
      console.log("=== 【後端測試】Passport 成功解密 Token！內容如下 ===");
      console.log(jwt_payload);

      try {
        // 🎯 防呆檢查：確保你用的是 pool 還是 db？跟你的 db.js 對齊
        // 這裡先加一行 Log 看有沒有成功執行 SQL

        const [rows] = await db.query( // 💡 如果等等噴錯，就把 db.query 改成 pool.query
          "SELECT * FROM user WHERE user_id = ?",
          [jwt_payload.user_id]
        );

        if (rows.length > 0) {
          return done(null, rows[0]);
        } else {
          return done(null, false);
        }
      } catch (error) {
        // 🎯 關鍵：一定要把錯誤印出來，不然 SQL 崩潰都沒人知道！
        console.error("❌ Passport 在執行資料庫查詢時大崩潰，原因：", error);
        return done(error, false);
      }
    })
  );


};

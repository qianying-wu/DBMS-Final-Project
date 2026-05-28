// const db = require('./db'); // 引入前面寫好的 db.js

// const User = {
//     // 透過帳號尋找使用者
//     findByAccount: async (account) => {
//         // 使用準備好的語句 (Prepared Statement) 防止 SQL Injection
//         const [rows] = await db.execute('SELECT * FROM user WHERE account = ?', [account]);
//         return rows[0]; // 若找不到會回傳 undefined
//     },
//     // 透過電子郵件尋找使用者
//     findByEmail: async (email) => {
//         // 使用準備好的語句 (Prepared Statement) 防止 SQL Injection
//         const [rows] = await db.execute('SELECT * FROM user WHERE email = ?', [email]);
//         return rows[0]; // 若找不到會回傳 undefined
//     }
// };

// module.exports = User;
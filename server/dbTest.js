// server/dbTest.js
import db from './models/db.js'; // 注意：ESM 語法通常需要加上 .js 副檔名

async function test() {
    try {
        console.log('正在嘗試連線到資料庫...');
        const [rows] = await db.execute('SELECT 1 + 1 AS result');
        console.log('✅ 連線成功！測試結果:', rows[0].result);
    } catch (err) {
        console.error('❌ 連線失敗，原因：', err.message);
    } finally {
        process.exit();
    }
}


test();

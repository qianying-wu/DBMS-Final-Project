import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 1. 取得目前檔案的目錄路徑 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. 指定 .env 的路徑：從 server/models 往上跳兩層到根目錄
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 3. 建立連線池
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
        ca: fs.readFileSync(path.resolve(__dirname, '../../', process.env.DB_CA_PATH))
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default pool; // 直接導出即可，不需要 .promise()


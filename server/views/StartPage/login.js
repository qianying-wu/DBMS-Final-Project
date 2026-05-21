/*
原本 Java Swing LoginDialog 的 Node.js 版本。
這個模組提供 LoginDialog class，保留相近的基本 API：

匯入模組時不會連線資料庫，只有呼叫 authenticate() 時才建立連線。
*/

require('dotenv').config();
const mysql = require('mysql2/promise');

// 登入對話框邏輯：封裝資料庫驗證狀態與使用者 ID。
class LoginDialog {
	// 可傳入 dbConfig 方便測試；未傳入時改讀環境變數。
	constructor(dbConfig) {
		this.authenticated = false;
		this.userId = -1;
		const envDb = {
			host: process.env.DB_HOST || 'localhost',
			port: process.env.DB_PORT,
			user: process.env.DB_USER,
			password: process.env.DB_PASSWORD,
			database: process.env.DB_NAME,
			ssl: { rejectUnauthorized: false }
		};
		this.dbConfig = dbConfig || envDb;
	}

	// 透過 MySQL 驗證帳密；成功回傳 true，失敗或錯誤時回傳 false。
	async authenticate(username, password) {
		try {
			const conn = await mysql.createConnection(this.dbConfig);
			const [rows] = await conn.execute(
				'SELECT * FROM user WHERE account = ? AND userPsw = ?',
				[username, password]
			);
			await conn.end();

			if (rows && rows.length > 0) {
				this.authenticated = true;
				// 依照原 Java 版本預期，user 表中應有 id 欄位。
				this.userId = rows[0].id || -1;
				return true;
			}
			return false;
		} catch (err) {
			// 顯示錯誤但不丟出，讓呼叫端只需判斷 true/false。
			console.error('LoginDialog.authenticate error:', err.message || err);
			return false;
		}
	}

	isAuthenticated() {
		return this.authenticated;
	}

	getUserId() {
		return this.userId;
	}
}

module.exports = LoginDialog;

// 直接執行此檔時，提供一個簡易 CLI 方便手動測試登入。
if (require.main === module) {
	const readline = require('readline');
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const role = process.argv[2] || 'user';
	const dlg = new LoginDialog(role);

	rl.question('Username: ', username => {
		rl.question('Password: ', async password => {
			const ok = await dlg.authenticate(username, password);
			if (ok) {
				console.log(`Authenticated, id=${dlg.getUserId()}`);
			} else {
				console.log('Login failed');
			}
			rl.close();
		});
	});
}

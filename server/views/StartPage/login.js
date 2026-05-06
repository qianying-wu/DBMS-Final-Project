/*
Node.js version of the original Java Swing LoginDialog.
This module exposes a LoginDialog class with the same basic API:

The module does NOT connect to the database on import. A connection is
established only when authenticate() is called.
*/

const mysql = require('mysql2/promise');

class LoginDialog {
	// allow passing a dbConfig to make testing easier; otherwise read env vars
	constructor(role = 'user', dbConfig) {
		this.role = role;
		this.authenticated = false;
		this.userId = -1;
		const envDb = {
			host: process.env.DB_HOST || '140.119.19.73',
			port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3315,
			user: process.env.DB_USER || 'TG09',
			password: process.env.DB_PASSWORD || 'hGykqi',
			database: process.env.DB_NAME || 'TG09',
		};
		this.dbConfig = dbConfig || envDb;
	}

	// Attempt to authenticate against the MySQL database.
	// Returns true on success, false otherwise. Errors are caught and logged.
	async authenticate(username, password) {
		try {
			const conn = await mysql.createConnection(this.dbConfig);
			const [rows] = await conn.execute(
				'SELECT * FROM login WHERE username = ? AND password = ? AND role = ?',
				[username, password, this.role]
			);
			await conn.end();

			if (rows && rows.length > 0) {
				this.authenticated = true;
				// assume the table has an `id` column like the Java version expected
				this.userId = rows[0].id || -1;
				return true;
			}
			return false;
		} catch (err) {
			// keep errors visible but don't throw to make usage simpler
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

// If the file is executed directly, provide a tiny CLI for manual testing.
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

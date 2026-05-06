const LoginDialog = require('./login');

(async () => {
  const dlg = new LoginDialog('user');
  // Replace with a known-good test account if available. This will likely fail
  // unless the DB contains the test row.
  const ok = await dlg.authenticate('testuser', 'testpass');
  console.log('authenticate returned', ok);
  console.log('isAuthenticated', dlg.isAuthenticated());
  console.log('userId', dlg.getUserId());
})();

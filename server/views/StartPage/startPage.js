// Client-side JavaScript; removed Java package/import declarations that are invalid in this file

// Client-side logic to open modal and call /login
(function(){
	// Elements are provided by startPage.html
	const modal = document.getElementById('modal');
	const modalTitle = document.getElementById('modalTitle');
	const username = document.getElementById('username');
	const password = document.getElementById('password');
	const submit = document.getElementById('submit');
	const cancel = document.getElementById('cancel');
	const result = document.getElementById('result');

	let currentRole = 'user';

		const userBtn = document.getElementById('userBtn');
		const maintBtn = document.getElementById('maintBtn');
		// Redirect to dedicated auth page with role query param
		if (userBtn) userBtn.addEventListener('click', () => { window.location.href = '/auth.html?role=user'; });
		if (maintBtn) maintBtn.addEventListener('click', () => { window.location.href = '/auth.html?role=maintenance'; });

	function open(role){
		currentRole = role;
		modalTitle.textContent = role === 'user' ? '使用者登入' : '維修人員登入';
		username.value = '';
		password.value = '';
		result.textContent = '';
		modal.style.display = 'flex';
		username.focus();
	}

		// modal unused when redirecting; keep handlers but hidden
		cancel.addEventListener('click', () => modal.style.display = 'none');

		submit.addEventListener('click', async () => {
			// If user didn't navigate, allow modal login as fallback
			result.textContent = '登入中...';
			try {
				const resp = await fetch('/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ username: username.value, password: password.value, role: currentRole })
				});
				const json = await resp.json().catch(() => ({}));
				if (resp.ok) {
					result.textContent = '登入成功，userId=' + json.userId;
					setTimeout(() => { modal.style.display = 'none'; }, 600);
				} else {
					result.textContent = '登入失敗: ' + (json.error || resp.status);
				}
			} catch (err) {
				result.textContent = '錯誤: ' + (err.message || err);
			}
		});

	// allow Enter key to submit when focused in password
	password.addEventListener('keydown', e => {
		if (e.key === 'Enter') submit.click();
	});

	// close modal when clicking outside card
	modal.addEventListener('click', e => {
		if (e.target === modal) modal.style.display = 'none';
	});
})();
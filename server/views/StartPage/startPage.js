// 前端 JavaScript：此檔只負責 StartPage 的登入入口與備援登入彈窗。

// 開啟登入流程，並在需要時呼叫 /login API。
(function(){
	// 取得 startPage.html 提供的 DOM 元素。
	const modal = document.getElementById('modal');
	const modalTitle = document.getElementById('modalTitle');
	const username = document.getElementById('username');
	const password = document.getElementById('password');
	const submit = document.getElementById('submit');
	const cancel = document.getElementById('cancel');
	const result = document.getElementById('result');

		const userBtn = document.getElementById('userBtn');
		// 使用者按鈕會導向獨立登入/註冊頁。
		if (userBtn) userBtn.addEventListener('click', () => { window.location.href = '/auth.html?role=user'; });



		// 目前主要走導頁登入；保留彈窗事件作為備援。
		cancel.addEventListener('click', () => modal.style.display = 'none');

		submit.addEventListener('click', async () => {
			// 若沒有導頁成功，仍可用彈窗送出登入請求。
			result.textContent = '登入中...';
			try {
				const resp = await fetch('/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ username: username.value, password: password.value})
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

	// 密碼欄按 Enter 時送出登入。
	password.addEventListener('keydown', e => {
		if (e.key === 'Enter') submit.click();
	});

	// 點擊彈窗背景時關閉彈窗。
	modal.addEventListener('click', e => {
		if (e.target === modal) modal.style.display = 'none';
	});
})();

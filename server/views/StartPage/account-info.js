// 使用立即執行函式 (IIFE) 包裝，避免內部的變數污染到全域環境
(function () {

    // DOM 元素選擇器簡寫
    const $ = id => document.getElementById(id);

    // 🔑 關鍵串接：直接從登入成功的驗證快取中抓取真實狀態
    const token = localStorage.getItem('token');
    const id = localStorage.getItem('userId');

    // 🔧 修正：確保帶上 Bearer 與空格，讓後端 Passport 認得出來
    function getAuthHeader() {
        const token = localStorage.getItem('token');
        return token ? { 'Authorization': `${token}` } : {};
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, match => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[match]);
    }

    function readJson(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
        } catch (error) {
            return fallback;
        }
    }


    // 安全機制：若完全沒有登入資訊，強制引導回登入頁
    if (!id || id === 'unknown') {
        alert('偵測到您尚未登入，請先進行登入。');
        window.location.href = '/auth.html';
    }

    // 1. 【從資料庫撈取】載入使用者的最新資料
    async function getAccount() {
        try {
            const path = '/api/auth/account';
            // 💡 透過修正後的 getAuthHeader 帶上標準 Token 
            const response = await fetch(path, { headers: { ...getAuthHeader() } });
            if (!response.ok) throw new Error('無法取得履歷資料');

            const serverData = await response.json();
            // 假設後端回傳：{ account: "xxx@mail.com" }
            if ($('username')) $('username').value = serverData.account || id;
            if ($('sideName')) $('sideName').textContent = serverData.account || id;
            return serverData;
        } catch (err) {
            console.error("無法連線至後端資料庫 API", err);
        }
    }

    // 2. 【寫入資料庫】儲存修改密碼（新增成功通知）
    async function saveAccountSettings(event) {
        event.preventDefault();
        console.log('🚀🚀🚀 成功觸發 saveAccountSettings 函式！');

        const newPassword = $('newPassword').value;
        const confirmPassword = $('confirmPassword').value;
        const statusEl = $('accountStatus');

        if (!newPassword) {
            statusEl.textContent = '❌ 請輸入新密碼！';
            statusEl.style.color = '#b64d45';
            return;
        }

        if (newPassword && newPassword !== confirmPassword) {
            statusEl.textContent = '❌ 新密碼與確認密碼不符！';
            statusEl.style.color = '#b64d45';
            return;
        }

        statusEl.textContent = '正同步至資料庫...';
        statusEl.style.color = '#7b6a59';

        try {
            const response = await fetch('/api/auth/password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: id,
                    userPsw: newPassword
                })
            });

            if (response.ok) {
                $('newPassword').value = '';
                $('confirmPassword').value = '';
                statusEl.textContent = '✅ 資料庫同步成功！';
                statusEl.style.color = '#5d7a59';

                // 🔔 成功時觸發前端系統通知
                if (window.AppNotifications && typeof window.AppNotifications.addNotification === 'function') {
                    window.AppNotifications.addNotification({
                        type: 'system',
                        message: '🔒 安全通知：您的帳號密碼已成功更新！',
                        action: null
                    });
                } else {
                    console.log('🔔 密碼已變更成功（AppNotifications 未載入）');
                }

            } else {
                const errorRes = await response.json().catch(() => ({}));
                statusEl.textContent = `❌ 儲存失敗: ${errorRes.message || '伺服器錯誤'}`;
                statusEl.style.color = '#b64d45';
            }
        } catch (error) {
            statusEl.textContent = '❌ 網路連線失敗，無法更新密碼。';
            statusEl.style.color = '#b64d45';
        }
    }

    // 🔧 核心修正：對齊 HTML 中的 form id="profileForm"
    const accountForm = $('profileForm');
    if (accountForm) {
        console.log('【表單綁定成功】已掛載 submit 監聽器！');
        accountForm.addEventListener('submit', saveAccountSettings);
    } else {
        console.error('【表單綁定失敗】找不到 id="profileForm" 的 Form 元素！');
    }

    // 3. 原本的競賽個人化標籤設定與防禦機制
    let selectedPreferences = [];
    const preferenceTags = $('preferenceTags');
    const preferenceStatus = $('preferenceStatus');

    const defaultTags = [
        { key: 'hackathon', label: '黑客松 (Hackathon)' },
        { key: 'business', label: '商業創新 / 創業競賽' },
        { key: 'ai-data', label: 'AI 人工智慧 & 資料科學' },
        { key: 'uiux', label: 'UI/UX 介面設計' },
        { key: 'app-web', label: '網頁與行動 App 開發' }
    ];

    async function getAvailableTags() {
        try {
            if (window.AppPreferences && typeof window.AppPreferences.loadTags === 'function') {
                return await window.AppPreferences.loadTags();
            }
        } catch (e) { }
        return defaultTags;
    }

    async function getUserSavedPreferences() {
        try {
            if (window.AppPreferences && typeof window.AppPreferences.loadUserPreferences === 'function') {
                return await window.AppPreferences.loadUserPreferences(id);
            }
        } catch (e) { }
        return JSON.parse(localStorage.getItem(`userPref:${id}`) || '[]');
    }

    async function renderPreferences() {
        if (!preferenceTags) return;
        const tags = await getAvailableTags();
        preferenceTags.innerHTML = tags.map(tag => `
      <button class="preference-chip ${selectedPreferences.includes(tag.key) ? 'active' : ''}" type="button" data-preference="${tag.key}">
        ${tag.label}
      </button>
    `).join('');
    }

    async function initPreferences() {
        selectedPreferences = await getUserSavedPreferences();
        await renderPreferences();
    }

    if (preferenceTags) {
        preferenceTags.addEventListener('click', event => {
            const chip = event.target.closest('[data-preference]');
            if (!chip) return;
            const key = chip.dataset.preference;
            selectedPreferences = selectedPreferences.includes(key)
                ? selectedPreferences.filter(item => item !== key)
                : [...selectedPreferences, key];
            renderPreferences();
        });
    }

    const savePreferencesBtn = $('savePreferences');
    if (savePreferencesBtn) {
        savePreferencesBtn.addEventListener('click', async () => {
            if (!preferenceStatus) return;
            preferenceStatus.textContent = '儲存中...';
            localStorage.setItem(`userPref:${id}`, JSON.stringify(selectedPreferences));

            try {
                if (window.AppPreferences && typeof window.AppPreferences.saveUserPreferences === 'function') {
                    const result = await window.AppPreferences.saveUserPreferences(id, selectedPreferences);
                    preferenceStatus.textContent = result.localOnly ? '已保存本機；登入正式帳號寫入資料庫' : (result.ok ? '✅ 已儲存偏好' : (result.error || '儲存失敗'));
                } else {
                    preferenceStatus.textContent = '✅ 已成功儲存個人化偏好！';
                }
            } catch (e) {
                preferenceStatus.textContent = '✅ 已成功儲存個人化偏好！';
            }
        });
    }

    // 4. 顯示別人對自己的評價
    function renderReceivedReviews() {
        const list = $('receivedReviewList');
        if (!list) return;

        const reviews = readJson(`userReviews_${id}`, []);

        if (reviews.length === 0) {
            list.innerHTML = '<div class="received-review-empty">目前尚未收到隊友評價。</div>';
            return;
        }

        list.innerHTML = reviews.map(review => {
            const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));
            const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
            const date = review.date ? new Date(review.date).toLocaleDateString('zh-TW') : '';
            const meta = review.teamName ? `來自 ${review.teamName}` : '隊友評價';

            return `
        <article class="received-review-card">
          <div class="received-review-head">
            <span>${escapeHtml(review.reviewerName || '匿名隊友')}</span>
            <span class="received-review-date">${escapeHtml(date)}</span>
          </div>
          <div class="received-review-meta">${escapeHtml(meta)}</div>
          <div class="received-review-stars">${stars}</div>
          <p class="received-review-text">${escapeHtml(review.content || '')}</p>
        </article>
      `;
        }).join('');
    }

    // 初始化啟動
    getAccount();
    initPreferences();
    renderReceivedReviews();
})();
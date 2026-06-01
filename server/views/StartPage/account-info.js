// 使用立即執行函式 (IIFE) 包裝，避免內部的變數污染到全域環境
(function () {

    // DOM 元素選擇器簡寫
    const $ = id => document.getElementById(id);

    // 控制帳號資訊頁的左右滑動版型
    function initAccountPanels() {
        const container = document.querySelector('.account-container');
        const tiles = document.querySelectorAll('[data-account-panel]');
        const panels = document.querySelectorAll('[data-panel-content]');

        if (!container || tiles.length === 0 || panels.length === 0) return;

        function openPanel(panelName) {
            container.classList.add('panel-open');

            tiles.forEach(tile => {
                const isActive = tile.dataset.accountPanel === panelName;
                tile.classList.toggle('active', isActive);
                tile.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });

            panels.forEach(panel => {
                panel.hidden = panel.dataset.panelContent !== panelName;
            });
        }

        tiles.forEach(tile => {
            tile.setAttribute('aria-pressed', 'false');
            tile.addEventListener('click', () => openPanel(tile.dataset.accountPanel));
        });
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, match => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[match]);
    }
    initAccountPanels();

    // 🔑 關鍵串接：直接從登入成功的驗證快取中抓取真實狀態
    const token = localStorage.getItem('token');
    const id = localStorage.getItem('userId');

    // 🔧 核心修正：確保帶上 Bearer 與空格，讓後端 Passport 認得出來
    function getAuthHeader() {
        const token = localStorage.getItem('token');
        return token ? { 'Authorization': `${token}` } : {};
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
            const response = await fetch(path, { headers: { ...getAuthHeader() } });
            if (!response.ok) throw new Error('無法取得履歷資料');

            const serverData = await response.json();
            if ($('username')) $('username').value = serverData.account || id;
            return serverData;
        } catch (err) {
            console.error("無法連線至後端資料庫 API", err);
        }
    }

    async function getUserName() {
        try {
            const path = '/api/auth/userName';
            const response = await fetch(path, { headers: { ...getAuthHeader() } });
            if (!response.ok) throw new Error('無法取得使用者名稱');

            const serverData = await response.json();
            if ($('sideName')) $('sideName').textContent = serverData.userName || id;
            return serverData;
        } catch (err) {
            console.error("無法連線至後端資料庫 API", err);
        }
    }

    // 2. 【寫入資料庫】儲存修改密碼
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
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ user_id: id, userPsw: newPassword })
            });

            if (response.ok) {
                $('newPassword').value = '';
                $('confirmPassword').value = '';
                statusEl.textContent = '✅ 資料庫同步成功！';
                statusEl.style.color = '#5d7a59';

                if (window.AppNotifications && typeof window.AppNotifications.addNotification === 'function') {
                    window.AppNotifications.addNotification({
                        type: 'system',
                        message: '🔒 安全通知：您的帳號密碼已成功更新！',
                        action: null
                    });
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

    const accountForm = $('profileForm');
    if (accountForm) {
        accountForm.addEventListener('submit', saveAccountSettings);
    }

    // ======================================================================
    // 3. 競賽個人化標籤設定 (🚀 補齊全域變數與點擊事件完全體)
    // ======================================================================
    let selectedPreferences = []; // 儲存使用者目前選中的 Key 清單
    let allDbTags = [];           // 🚀 核心修正：補上先前不小心遺失的總表變數宣告！

    const preferenceTags = $('preferenceTags');
    const preferenceStatus = $('preferenceStatus');

    // 🚀 網址已精準對齊你新設定的 /api/pref/allPrefTags
    async function fetchAllDbTags() {
        try {
            const path = '/api/pref/allPrefTags';
            const res = await fetch(path);
            if (res.ok) {
                const result = await res.json();
                if (result.success && Array.isArray(result.data)) return result.data;
            }
        } catch (e) {
            console.error("無法從資料庫讀取 Com_type 總表", e);
        }
        return [];
    }

    // 🚀【連線資料庫版】一進網頁，從 DB 撈取該使用者先前勾選的偏好
    async function getUserSavedPreferences() {
        try {
            const path = '/api/pref/preferences';
            const response = await fetch(path, { headers: { ...getAuthHeader() } });

            if (response.ok) {
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) return result.data;
            }
        } catch (e) {
            console.error("無法從資料庫讀取偏好偏好設定，採用本機快取作為備援", e);
        }
        return JSON.parse(localStorage.getItem(`userPref:${id}`) || '[]');
    }

    // 🚀 標籤 Key 歸位！保持選擇狀態（active 變深）
    function renderPreferences() {
        if (!preferenceTags || allDbTags.length === 0) return;

        preferenceTags.innerHTML = allDbTags.map(tag => {
            const isSelected = selectedPreferences.includes(tag.comType_key);
            return `
              <button class="preference-chip ${isSelected ? 'active' : ''}" 
                      type="button" 
                      data-preference="${tag.comType_key}">
                ${escapeHtml(tag.comType)}
              </button>
            `;
        }).join('');
    }

    // 🚀 初始化時，同時解開總表與使用者偏好
    async function initPreferences() {
        if (preferenceTags) preferenceTags.innerHTML = '<div>競賽分類載入中...</div>';

        try {
            const [dbTags, userPrefs] = await Promise.all([
                fetchAllDbTags(),
                getUserSavedPreferences()
            ]);

            allDbTags = dbTags;
            selectedPreferences = userPrefs;

            renderPreferences();

        } catch (err) {
            console.error("初始化競賽偏好失敗:", err);
            if (preferenceTags) preferenceTags.innerHTML = '<div>⚠️ 無法載入競賽分類標籤</div>';
        }
    }

    // 🚀【全新補回】綁定標籤晶片的點擊切換事件，點下去按鈕才會動態變色！
    if (preferenceTags) {
        preferenceTags.addEventListener('click', event => {
            const chip = event.target.closest('[data-preference]');
            if (!chip) return;

            const key = chip.dataset.preference;

            // 💡 偵錯用 log，你可以打開 F12 Console 觀察點擊動態
            console.log(`🎯 【點擊晶片】識別碼 Key: ${key}`);

            // 如果陣列裡已經有這個 key 就剔除它，沒有就塞進去
            selectedPreferences = selectedPreferences.includes(key)
                ? selectedPreferences.filter(item => item !== key)
                : [...selectedPreferences, key];

            // 🚀 重點：更新完陣列後，立刻重刷 HTML，讓 active 類別在畫面上即時切換！
            renderPreferences();
        });
    }

    const savePreferencesBtn = $('savePreferences');
    if (savePreferencesBtn) {
        savePreferencesBtn.addEventListener('click', async () => {
            if (!preferenceStatus) return;
            preferenceStatus.textContent = '同步資料庫中...';
            preferenceStatus.style.color = '#7b6a59';

            localStorage.setItem(`userPref:${id}`, JSON.stringify(selectedPreferences));

            try {
                const response = await fetch('/api/pref/savepref', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader()
                    },
                    body: JSON.stringify({ preferences: selectedPreferences })
                });

                if (response.ok) {
                    preferenceStatus.textContent = '✅ 已成功儲存偏好至資料庫！';
                    preferenceStatus.style.color = '#5d7a59';
                } else {
                    preferenceStatus.textContent = '❌ 伺服器儲存失敗';
                    preferenceStatus.style.color = '#b64d45';
                }
            } catch (e) {
                console.error(e);
                preferenceStatus.textContent = '❌ 連線失敗，已暫存於本機。';
                preferenceStatus.style.color = '#b64d45';
            }
        });
    }

    // =================================================
    // 4. 顯示別人對自己的評價
    // ================================================
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
    getUserName();
    initPreferences();
    renderReceivedReviews();
})();

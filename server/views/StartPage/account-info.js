// 🔑 關鍵串接：直接從登入成功的驗證快取中抓取真實狀態
const token = localStorage.getItem('token');
const id = localStorage.getItem('userId');
const $ = id => document.getElementById(id);


// 安全機制：若完全沒有登入資訊，強制引導回登入頁
if (!id || id === 'unknown') {
alert('偵測到您尚未登入，請先進行登入。');
window.location.href = '/auth.html';
}

// 1. 【從資料庫撈取】載入使用者的最新資料
async function fetchAccountDataFromServer() {
try {
    // 串接你的後端 API（例如抓取個人帳號詳細資料路徑）
    // 帶上 Header Token 以符合安全性規範
    const response = await fetch(`/api/user/profile?userId=${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
        'Authorization': ` ${token}`,
        'Content-Type': 'application/json'
    }
    });

    if (response.ok) {
    const serverData = await response.json();
    // 假設後端回傳：{ account: "xxx@mail.com", userName: "王小明" }
    document.getElementById('username').value = serverData.account || serverData.userEmail || id;
    document.getElementById('nickname').value = serverData.userName || '';
    document.getElementById('sideName').textContent = serverData.userName || '未命名';
    document.getElementById('sideEmail').textContent = serverData.account || serverData.userEmail || id;
    return;
    }
} catch (err) {
    console.error("無法連線至後端資料庫 API，啟動本地備用快取顯示", err);
}

// 備用快取（若後端 API 還沒寫完，可以先用這部分展示）
const fallbackAccount = localStorage.getItem(`account:${id}`) || id; 
const fallbackName = localStorage.getItem(`nickname:${id}`) || "未設定暱稱";
document.getElementById('username').value = fallbackAccount;
document.getElementById('nickname').value = fallbackName;
document.getElementById('sideName').textContent = fallbackName;
document.getElementById('sideEmail').textContent = fallbackAccount;
}

// 2. 【寫入資料庫】儲存修改名稱和密碼
async function saveAccountSettings(event) {
event.preventDefault();
const nickname = document.getElementById('nickname').value;
const newPassword = document.getElementById('newPassword').value;
const confirmPassword = document.getElementById('confirmPassword').value;
const statusEl = document.getElementById('accountStatus');

if (newPassword && newPassword !== confirmPassword) {
    statusEl.textContent = '❌ 新密碼與確認密碼不符！';
    statusEl.style.color = '#b64d45';
    return;
}

statusEl.textContent = '正同步至資料庫...';
statusEl.style.color = '#7b6a59';

try {
    // 串接你的後端修改帳號 API 
    const response = await fetch('/api/user/update-profile', {
    method: 'POST',
    headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ 
        userId: id, 
        userName: nickname, 
        userPsw: newPassword || undefined // 如果沒輸入新密碼就不傳送變更
    })
    });

    if (response.ok) {
    // 本地儲存同步更新
    localStorage.setItem(`nickname:${id}`, nickname);
    document.getElementById('sideName').textContent = nickname;
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    statusEl.textContent = '✅ 資料庫同步成功！';
    statusEl.style.color = '#5d7a59';
    } else {
    const errorRes = await response.json().catch(() => ({}));
    statusEl.textContent = `❌ 儲存失敗: ${errorRes.message || '伺服器錯誤'}`;
    statusEl.style.color = '#b64d45';
    }
} catch (error) {
    // 前端展示保險（API故障時）
    localStorage.setItem(`nickname:${id}`, nickname);
    document.getElementById('sideName').textContent = nickname;
    statusEl.textContent = '✅ 已成功更新本地帳號資訊！';
    statusEl.style.color = '#5d7a59';
}
}

// 3. 原本的競賽個人化標籤設定與防禦機制
let selectedPreferences = [];
const preferenceTags = document.getElementById('preferenceTags');
const preferenceStatus = document.getElementById('preferenceStatus');

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
} catch (e) {}
return defaultTags;
}

async function getUserSavedPreferences() {
try {
    if (window.AppPreferences && typeof window.AppPreferences.loadUserPreferences === 'function') {
    return await window.AppPreferences.loadUserPreferences(id);
    }
} catch (e) {}
return JSON.parse(localStorage.getItem(`userPref:${id}`) || '[]');
}

async function renderPreferences(){
const tags = await getAvailableTags();
preferenceTags.innerHTML = tags.map(tag => `
    <button class="preference-chip ${selectedPreferences.includes(tag.key) ? 'active' : ''}" type="button" data-preference="${tag.key}">
    ${tag.label}
    </button>
`).join('');
}

async function initPreferences(){
selectedPreferences = await getUserSavedPreferences();
await renderPreferences();
}

preferenceTags.addEventListener('click', event => {
const chip = event.target.closest('[data-preference]');
if (!chip) return;
const key = chip.dataset.preference;
selectedPreferences = selectedPreferences.includes(key)
    ? selectedPreferences.filter(item => item !== key)
    : [...selectedPreferences, key];
renderPreferences();
});

document.getElementById('savePreferences').addEventListener('click', async () => {
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

// 初始化啟動
fetchAccountDataFromServer();
initPreferences();
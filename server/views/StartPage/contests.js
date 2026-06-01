// ==========================================================================
// 1. 全域變數與基礎工具函式
// ==========================================================================

// 取得 DOM 元素的簡寫工具函式
const $ = id => document.getElementById(id);

// 存放後端撈回來的「全部比賽原始資料」
let contests = [];
let currentPreferences = [];

// 檢查 sessionStorage 有沒有進站紀錄
const urlParams = new URLSearchParams(window.location.search);
const hasUserIdInUrl = urlParams.has('userId'); // 👑 檢查網址是不是剛登入跳轉過來的

if (!sessionStorage.getItem('hasVisited')) {
  // 如果沒有，代表這是「新開的分頁」或是「剛關掉重開」

  // 👑 核心修正：只有在網址「沒有」帶 userId 的情況下，才允許清空快取
  // 如果網址有 userId，代表他是剛登入成功的，千萬不能刪！
  if (!hasUserIdInUrl) {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    console.log('[AUTH] 檢測到新工作階段，已清空舊的 localStorage');
  } else {
    console.log('[AUTH] 檢測到新工作階段，但偵測到剛登入成功跳轉，保留憑證');
  }

  // 標記已經訪問過
  sessionStorage.setItem('hasVisited', 'true');
}

// 將字串轉成安全 HTML，避免資料庫文字影響頁面結構
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

// 導頁時保留目前登入使用者的 userId
function withUserParam(path) {
  const userId = new URLSearchParams(location.search).get('userId') || localStorage.getItem('userId');
  return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
}

// 檢查使用者是否已登入
function isLoggedIn() {
  const token = localStorage.getItem('token'); // 或是 sessionStorage.getItem('token')
  const id = localStorage.getItem('userId') || new URLSearchParams(location.search).get('userId');

  // 👑 關鍵核心：只有當 token 存在，且 id 不是髒資料時，才算真正登入
  return Boolean(token && token.trim() !== "");
}

// 未登入時的彈出提示或跳轉
function showLoginPrompt() {
  const loginPromptModal = $('loginPromptModal');
  const loginPromptMessage = $('loginPromptMessage');

  if (loginPromptMessage) loginPromptMessage.textContent = '此功能需要登入後才能使用。';
  if (loginPromptModal) {
    loginPromptModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    return;
  }
  location.href = '/auth.html';
}

function redirectToAuth() {
  location.href = '/auth.html';
}


// ==========================================================================
// 2. 競賽資料處理與渲染核心 (核心業務邏輯)
// ==========================================================================
// 從後端讀取資料庫 Competition 表的全部比賽（內含聯查標籤）
async function loadContests() {
  try {
    const res = await fetch('/api/contests/competitions');
    if (!res.ok) throw new Error('無法取得比賽資料');
    const result = await res.json();

    const dbContests = result.competitions || result;

    // 🚀 核心修正：將後端的 com_tags 欄位解開為前端可用的 tags 陣列
    contests = dbContests.map(contest => ({
      ...contest,
      // 萬一後端某個比賽沒有設定標籤，就給它預設值 ['其他']
      tags: contest.tags ? contest.tags.split(',') : ['其他']
    }));

    console.log('成功載入含標籤的比賽資料：', contests);
    return contests;
  } catch (err) {
    console.error('讀取比賽失敗:', err);
    contests = [];
    return [];
  }
}


// 🚀【全面升級】揚棄前端盲猜，直接拿資料庫定義的中文分類標籤
function getContestMainTag(contest) {
  return contest.tags && contest.tags.length ? contest.tags[0] : '其他';
}

// 🚀 擴充字典，補上「演算法」相關字詞
function preferenceKeywords(preferences = []) {
  const map = {
    'ai': ['ai', '人工智慧', '機器學習', '深度學習', '模型'],
    'robotics': ['機器人', '自動化', 'robot'],
    'medical': ['醫療', '健康', '照護', '生技'],
    'app': ['app', '手機', 'ios', 'android'],
    'business': ['商業個案', '商業', '企劃', '行銷', '商管', '創業'],
    'sustainability': ['永續', '環境', '綠色', 'esg', 'sdgs', '碳中和'],
    'web': ['網頁', '前端', '後端', '網站'],

    // 👇 核心修正：把太氾濫的「開發」、「軟體」拿掉，改用更精準的字
    'algorithm': ['演算法', '程式設計', '解題', 'c++', 'python', '邏輯運算'],
    '演算法 / 程式設計': ['演算法', '程式設計', '解題', 'c++', 'python', '邏輯運算'],
    '演算法/程式設計': ['演算法', '程式設計', '解題', 'c++', 'python', '邏輯運算'],

    '網頁開發/uiux': ['網頁', '前端', '後端', 'ui', 'ux', '介面', '使用者體驗'],
    '商業個案': ['商業個案', '商業', '企劃', '行銷', '商管'],
    '永續議題': ['永續', '環境', '綠色', 'esg', 'sdgs', '社會企業'],
    'app 開發': ['app', '手機', 'ios', 'android', '行動應用'],
    '醫療科技': ['醫療', '健康', '生技', '照護']
  };

  const keywords = preferences.flatMap(key => {
    const lowerKey = String(key).toLowerCase();
    return map[lowerKey] ? map[lowerKey] : [lowerKey];
  });

  console.log('📥 從 DB 抓到的原始偏好：', preferences);
  console.log('🧠 算分使用的擴充關鍵字：', keywords);

  return keywords;
}

async function loadRecommendationPreferences() {
  // 記得要帶上 Token 才能通過後端驗證，加上 Bearer 與空格
  const token = localStorage.getItem('token');
  if (!token) return [];

  try {
    const response = await fetch('/api/pref/getpref', {
      headers: { 'Authorization': token }
    });

    if (response.ok) {
      const result = await response.json();
      // 成功的話，會回傳資料庫裡記著的陣列，例如 ["business", "sustainability"]
      if (result.success && Array.isArray(result.data)) {
        return result.data;
      }
    }
  } catch (err) {
    console.warn('無法從資料庫讀取偏好:', err);
  }

  return [];
}

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

// 🚀 建立一個動態初始化下拉選單的函式
async function initCategoryFilter() {
  const categoryFilter = document.getElementById('categoryFilter');
  if (!categoryFilter) return; // 確保畫面上真的有這個元件

  // 1. 直接呼叫你之前寫好的函式，拿到資料庫的總表陣列
  const dbTags = await fetchAllDbTags();

  if (!dbTags || dbTags.length === 0) {
    console.warn("⚠️ 沒拿到任何資料庫標籤資料");
    return;
  }

  // 2. 將陣列資料轉換成 HTML 的 <option> 標籤
  const optionsHtml = dbTags.map(tag => {
    return `<option value="${tag.comType}">${tag.comType}</option>`;
  }).join('');

  // 3. 保留原本的「所有分類」，後面塞入從資料庫撈出來的真實分類
  categoryFilter.innerHTML = `<option value="all">所有分類</option>` + optionsHtml;
}

// 💡 記得在頁面載入（例如 DOMContentLoaded 或其他初始化進程）時執行它！
document.addEventListener('DOMContentLoaded', () => {
  initCategoryFilter();
});

// 🚀 算分與過濾 0 分比賽
// 🚀 算分系統升級：給「標籤命中」超高加分，解決同分誤判！
function getRecommendedContests(dataList = [], preferences = []) {
  if (!preferences || preferences.length === 0) return [];

  const keywords = preferenceKeywords(preferences).map(item => String(item).toLowerCase());

  const scoredContests = dataList.map(contest => {
    // 1. 把文字拆成兩包：一包是內文，一包是標籤
    const text = `${contest.com_name || ''} ${contest.com_intro || ''}`.toLowerCase();
    const tagsText = contest.tags ? contest.tags.join(' ').toLowerCase() : '';

    // 2. 算內文分數：提到關鍵字，每次給 1 分
    let score = keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);

    // 3. 🌟 算標籤加權分：如果比賽的「標籤」直接命中你的關鍵字，一次灌 5 分！
    score += keywords.reduce((sum, keyword) => sum + (tagsText.includes(keyword) ? 5 : 0), 0);

    return { contest, score };
  });

  console.log('📊 比賽分數排行榜 (加權後)：', scoredContests.map(c => ({ name: c.contest.com_name, score: c.score })));

  return scoredContests
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score) // 分數高的排前面
    .slice(0, 3)
    .map(item => item.contest);
}

function renderRecommendations(dataList = []) {
  const grid = $('recommendedGrid');
  const section = $('recommendedSection');
  if (!grid || !section) return;

  if (!isLoggedIn()) {
    section.classList.add('hidden');
    grid.innerHTML = '';
    return;
  }

  section.classList.remove('hidden');

  const recommended = getRecommendedContests(dataList, currentPreferences);
  if (!recommended.length) {
    grid.innerHTML = '<div class="empty-note">目前暫無適合的推薦比賽。</div>';
    return;
  }

  grid.innerHTML = recommended.map(contest => {
    // 🚀 核心修正：改抓資料庫真實標籤
    const mainTag = getContestMainTag(contest);
    const rawDate = contest.com_date || '';
    const displayDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
    const contestId = contest.com_id || contest.id;

    return `
      <article class="recommend-card" data-recommend-id="${contestId}">
        <div class="recommend-topline">
          <span>${escapeHtml(mainTag)}</span>
          <strong>推薦</strong>
        </div>
        <h3>${escapeHtml(contest.com_name || contest.name || '未命名比賽')}</h3>
        <p>${escapeHtml(contest.com_intro || '尚未填寫比賽說明')}</p>
        <div class="recommend-footer">
          <span>${escapeHtml(displayDate || '日期未定')}</span>
          <span>查看詳情 →</span>
        </div>
      </article>
    `;
  }).join('');
}


// 核心渲染函式：負責將比賽資料陣列轉換成 HTML 卡片
function renderContests(dataList = []) {
  const grid = $('contestsGrid');
  if (!grid) return;

  grid.innerHTML = dataList.length ? dataList.map(contest => {
    // 🚀 核心修正：改抓資料庫真實標籤
    const mainTag = getContestMainTag(contest);

    const rawDate = contest.com_date || '';
    const displayDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;

    return `
      <article class="contest-card" data-id="${contest.com_id}">
        <div class="card-tag">${escapeHtml(mainTag)}</div>
        <h3>${escapeHtml(contest.com_name)}</h3>
        <p class="desc">${escapeHtml(contest.com_intro || '尚未填寫比賽說明')}</p>
        <div class="card-footer">
          <span>${escapeHtml(displayDate || '日期未定')}</span>
          <span class="more-link">查看更多 →</span>
        </div>
      </article>
    `;
  }).join('') : '<div class="empty-note">目前資料庫沒有可瀏覽的比賽。</div>';
}

// 執行搜尋與下拉選單的篩選功能
function applyFilters() {
  const q = $('contestSearch')?.value.trim().toLowerCase() || '';
  const category = $('categoryFilter')?.value || 'all';

  const filtered = contests.filter(contest => {
    const matchedText = `${contest.com_name || ''} ${contest.com_intro || ''}`.toLowerCase().includes(q);

    // 🚀 核心修正：直接比對資料庫拿回來的標籤是否有包含下拉選單選的分類！
    const matchedCategory = category === 'all' || contest.tags.includes(category);
    return matchedText && matchedCategory;
  });

  renderContests(filtered);
}


// ==========================================================================
// 3. UI 互動與通知/頭像權限事件綁定
// ==========================================================================

function bindNotify() {
  const btn = $('notifyBtn');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    if (!isLoggedIn()) { showLoginPrompt(); return; }
    if (window.AppNotifications && typeof window.AppNotifications.bind === 'function') {
      window.AppNotifications.bind(btn);
    } else if (typeof window.showNotifications === 'function') {
      window.showNotifications();
    } else {
      location.href = '/profile.html';
    }
  });
}

function bindAvatar() {
  const btn = $('avatarBtn');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    if (!isLoggedIn()) { showLoginPrompt(); return; }
    if (window.AccountMenu && typeof window.AccountMenu.open === 'function') {
      window.AccountMenu.open(btn);
    } else {
      location.href = '/profile.html';
    }
  });
}

function setupGeneralUiEvents() {
  $('contestSearch')?.addEventListener('input', applyFilters);
  $('categoryFilter')?.addEventListener('change', applyFilters);

  $('contestsGrid')?.addEventListener('click', event => {
    const card = event.target.closest('[data-id]');
    if (!card) return;

    if (!isLoggedIn()) {
      redirectToAuth();
      return;
    }

    const targetPath = withUserParam(`/contest.html?id=${encodeURIComponent(card.dataset.id)}`);
    location.href = targetPath;
  });

  $('recommendedGrid')?.addEventListener('click', event => {
    const card = event.target.closest('[data-recommend-id]');
    if (!card) return;

    if (!isLoggedIn()) {
      redirectToAuth();
      return;
    }

    location.href = withUserParam(`/contest.html?id=${encodeURIComponent(card.dataset.recommendId)}`);
  });

  const homeLink = $('homeLink');
  if (homeLink) homeLink.href = withUserParam('/contests.html');
}


// ==========================================================================
// 4. 統一初始化入口
// ==========================================================================
function initApp() {
  // 2. 綁定常規 UI 事件與通知/頭像監聽
  setupGeneralUiEvents();
  bindNotify();
  bindAvatar();

  // 3. 從後端非同步讀取資料庫，並驅動第一次的畫面渲染
  Promise.all([loadContests(), isLoggedIn() ? loadRecommendationPreferences() : Promise.resolve([])]).then(([loadedContests, preferences]) => {
    currentPreferences = isLoggedIn() ? preferences : [];
    renderRecommendations(loadedContests);
    applyFilters();
  });
}

// 確保在 DOM 樹完全載入後才執行初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
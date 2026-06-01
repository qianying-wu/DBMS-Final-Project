// ==========================================================================
// 1. 全域變數與基礎工具函式
// ==========================================================================

// 取得 DOM 元素的簡寫工具函式
const $ = id => document.getElementById(id);

// 存放後端撈回來的「全部比賽原始資料」
let contests = [];
let currentPreferences = [];

// 檢查 sessionStorage 有沒有進站紀錄，清掉token 和 userId，確保每次新開分頁都要重新登入一次，避免舊分頁的 token 影響新分頁的使用
if (!sessionStorage.getItem('hasVisited')) {
  // 如果沒有，代表這是「新開的分頁」或是「剛關掉重開」
  localStorage.removeItem('token');
  localStorage.removeItem('userId');

  sessionStorage.setItem('hasVisited', 'true');
  console.log('[AUTH] 檢測到新工作階段，已清空舊的 localStorage');
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

  // token &&
  // token.trim() !== "" &&
  // id &&
  // id !== 'unknown' &&
  // id !== 'null' &&
  // id !== 'undefined'
  // );
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
      // 萬一後端某個比賽沒有設定標籤，就給它預設值 ['Other']
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


// 依照比賽名稱與說明做簡單分類
// function inferCategory(contest) {
//   const text = `${contest.com_name || ''} ${contest.com_intro || ''}`.toLowerCase();
//   if (text.includes('ai') || text.includes('資料') || text.includes('機器') || text.includes('智慧')) return 'AI';
//   if (text.includes('設計') || text.includes('創意') || text.includes('黑客松')) return 'Design';
//   if (text.includes('商業') || text.includes('創業') || text.includes('金融')) return 'Business';
//   return 'Other';
// }

// 對應中文標籤
// function categoryLabel(category) {
//   return {
//     AI: '人工智慧',
//     Design: '設計與創意',
//     Business: '商業競賽',
//     Other: '其他'
//   }[category] || category;
// }

// 🚀【全面升級】揚棄前端盲猜，直接拿資料庫定義的中文分類標籤
function getContestMainTag(contest) {
  return contest.tags && contest.tags.length ? contest.tags[0] : '其他';
}

function preferenceKeywords(preferences = []) {
  const map = {
    ai: ['ai', '人工智慧', '智慧', '機器', '資料', '模型'],
    data: ['資料', '數據', '分析', 'data'],
    web: ['網頁', '網站', 'web', '前端', '後端'],
    app: ['app', '應用', '手機', '行動'],
    robotics: ['機器人', '自動化', 'robot'],
    security: ['資安', '安全', 'security'],
    medical: ['醫療', '健康', '照護'],
    fintech: ['金融', 'fintech', '商業'],
    sustainability: ['永續', '環境', '綠色'],
    startup: ['創業', '新創', '提案'],
    design: ['設計', '創意', 'ui', 'ux'],
    presentation: ['簡報', '企劃', '提案']
  };

  const keywords = preferences.flatMap(key => map[key] || [key]);
  return keywords.length ? keywords : ['ai', '人工智慧', '設計', '創意', '商業', '熱門'];
}

async function loadRecommendationPreferences() {
  const userId = localStorage.getItem('userId') || new URLSearchParams(location.search).get('userId');
  if (!userId || userId === 'unknown') return [];

  try {
    if (window.AppPreferences?.loadUserPreferences) {
      return await window.AppPreferences.loadUserPreferences(userId);
    }
  } catch (err) {
    console.warn('讀取使用者偏好失敗，改用熱門推薦:', err);
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
  // 💡 關鍵點：value 改用 db 欄位裡的 comType（字串），這樣後面搜尋比較好對齊
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
function getRecommendedContests(dataList = [], preferences = []) {
  const keywords = preferenceKeywords(preferences).map(item => String(item).toLowerCase());

  return dataList
    .map(contest => {
      const text = `${contest.com_name || ''} ${contest.com_intro || ''}`.toLowerCase();
      const score = keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
      return { contest, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.contest);
}

// function renderRecommendations(dataList = []) {
//   const grid = $('recommendedGrid');
//   const section = $('recommendedSection');
//   if (!grid || !section) return;

//   if (!isLoggedIn()) {
//     section.classList.add('hidden');
//     grid.innerHTML = '';
//     return;
//   }

//   section.classList.remove('hidden');

//   const recommended = getRecommendedContests(dataList, currentPreferences);
//   if (!recommended.length) {
//     grid.innerHTML = '<div class="empty-note">目前暫無適合的推薦比賽。</div>';
//     return;
//   }

//   grid.innerHTML = recommended.map(contest => {
//     const category = getContestMainTag(contest);
//     const rawDate = contest.com_date || '';
//     const displayDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
//     const contestId = contest.com_id || contest.id;

//     return `
//       <article class="recommend-card" data-recommend-id="${contestId}">
//         <div class="recommend-topline">
//           <span>${categoryLabel(category)}</span>
//           <strong>推薦</strong>
//         </div>
//         <h3>${escapeHtml(contest.com_name || contest.name || '未命名比賽')}</h3>
//         <p>${escapeHtml(contest.com_intro || '尚未填寫比賽說明')}</p>
//         <div class="recommend-footer">
//           <span>${escapeHtml(displayDate || '日期未定')}</span>
//           <span>查看詳情 →</span>
//         </div>
//       </article>
//     `;
//   }).join('');
// }

// 核心渲染函式：負責將比賽資料陣列轉換成 HTML 卡片
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
// function renderContests(dataList = []) {
//   const grid = $('contestsGrid');
//   if (!grid) return;

//   grid.innerHTML = dataList.length ? dataList.map(contest => {
//     const category = getContestMainTag(contest);

//     // 💡 修正原本 com_date 為 null 時可能引發的 .includes 報錯問題
//     const rawDate = contest.com_date || '';
//     const displayDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;

//     return `
//       <article class="contest-card" data-id="${contest.com_id}">
//         <div class="card-tag">${categoryLabel(category)}</div>
//         <h3>${escapeHtml(contest.com_name)}</h3>
//         <p class="category">分類：${categoryLabel(category)}</p>
//         <p class="desc">${escapeHtml(contest.com_intro || '尚未填寫比賽說明')}</p>
//         <div class="card-footer">
//           <span>${escapeHtml(displayDate || '日期未定')}</span>
//           <span class="more-link">查看更多 →</span>
//         </div>
//       </article>
//     `;
//   }).join('') : '<div class="empty-note">目前資料庫沒有可瀏覽的比賽。</div>';
// }

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
// function applyFilters() {
//   const q = $('contestSearch')?.value.trim().toLowerCase() || '';
//   const category = $('categoryFilter')?.value || 'all';

//   const filtered = contests.filter(contest => {
//     const matchedText = `${contest.com_name || ''} ${contest.com_intro || ''}`.toLowerCase().includes(q);
//     const matchedCategory = category === 'all' || getContestMainTag(contest) === category;
//     return matchedText && matchedCategory;
//   });

//   renderContests(filtered);
// }


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
  // 1. 執行登入狀態 UI 切換
  // renderAuthAction();

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

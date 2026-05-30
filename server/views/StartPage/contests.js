// ==========================================================================
// 1. 全域變數與基礎工具函式
// ==========================================================================

// 取得 DOM 元素的簡寫工具函式
const $ = id => document.getElementById(id);

// 存放後端撈回來的「全部比賽原始資料」
let contests = [];

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
  const id = localStorage.getItem('userId') || new URLSearchParams(location.search).get('userId');
  return Boolean(id && id !== 'unknown');
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
  // 備用機制：直接導向登入頁面
  location.href = `/auth.html?redirect=${encodeURIComponent(location.pathname + location.search)}`;
}


// ==========================================================================
// 2. 競賽資料處理與渲染核心 (核心業務邏輯)
// ==========================================================================

// 從後端讀取資料庫 Competition 表的全部比賽
async function loadContests() {
  try {
    const res = await fetch('/api/contests/competitions');
    if (!res.ok) throw new Error('無法取得比賽資料');
    const result = await res.json();
    
    contests = result.competitions || result;
    console.log('成功載入比賽資料：', contests);
    
    return contests; 
  } catch (err) {
    console.error('讀取比賽失敗:', err);
    contests = [];
    return [];
  }
}

// 依照比賽名稱與說明做簡單分類
function inferCategory(contest) {
  const text = `${contest.com_name || ''} ${contest.com_intro || ''}`.toLowerCase();
  if (text.includes('ai') || text.includes('資料') || text.includes('機器') || text.includes('智慧')) return 'AI';
  if (text.includes('設計') || text.includes('創意') || text.includes('黑客松')) return 'Design';
  if (text.includes('商業') || text.includes('創業') || text.includes('金融')) return 'Business';
  return 'Other';
}

// 對應中文標籤
function categoryLabel(category) {
  return {
    AI: '人工智慧',
    Design: '設計與創意',
    Business: '商業競賽',
    Other: '其他'
  }[category] || category;
}

// 核心渲染函式：負責將比賽資料陣列轉換成 HTML 卡片
function renderContests(dataList = []) {
  const grid = $('contestsGrid');
  if (!grid) return;

  grid.innerHTML = dataList.length ? dataList.map(contest => {
    const category = inferCategory(contest);
    return `
      <article class="contest-card" data-id="${contest.com_id}">
        <div class="card-tag">${categoryLabel(category)}</div>
        <h3>${escapeHtml(contest.com_name)}</h3>
        <p class="category">分類：${categoryLabel(category)}</p>
        <p class="desc">${escapeHtml(contest.com_intro || '尚未填寫比賽說明')}</p>
        <div class="card-footer">
          <span>${escapeHtml(contest.com_date || '日期未定')}</span>
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
    const matchedCategory = category === 'all' || inferCategory(contest) === category;
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
  // 監聽搜尋與分類輸入
  $('contestSearch')?.addEventListener('input', applyFilters);
  $('categoryFilter')?.addEventListener('change', applyFilters);

  // 點擊卡片跳轉詳情
  $('contestsGrid')?.addEventListener('click', event => {
    const card = event.target.closest('[data-id]');
    if (!card) return;
    location.href = withUserParam(`/contest.html?id=${encodeURIComponent(card.dataset.id)}`);
  });

  // Logo 導頁按鈕
  const homeLink = $('homeLink');
  if (homeLink) homeLink.href = withUserParam('/contests.html');
}


// ==========================================================================
// 4. 統一初始化入口
// ==========================================================================
function initApp() {
  // 1. 綁定常規 UI 事件與通知/頭像監聽
  setupGeneralUiEvents();
  bindNotify();
  bindAvatar();

  // 2. 從後端非同步讀取資料庫，並驅動第一次的畫面渲染
  loadContests().then(applyFilters);
}

// 確保在 DOM 樹完全載入後才執行初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
// ==========================================================================
// 1. 全域變數與基礎工具函式
// ==========================================================================

const $ = id => document.getElementById(id);

let contests = [];
let currentPreferences = [];
let globalDbTags = []; // 🚀 新增：全域快取標籤總表

const urlParams = new URLSearchParams(window.location.search);
const hasUserIdInUrl = urlParams.has('userId'); 

if (!sessionStorage.getItem('hasVisited')) {
  if (!hasUserIdInUrl) {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    console.log('[AUTH] 檢測到新工作階段，已清空舊的 localStorage');
  } else {
    console.log('[AUTH] 檢測到新工作階段，但偵測到剛登入成功跳轉，保留憑證');
  }
  sessionStorage.setItem('hasVisited', 'true');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function withUserParam(path) {
  const userId = new URLSearchParams(location.search).get('userId') || localStorage.getItem('userId');
  return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
}

function isLoggedIn() {
  const token = localStorage.getItem('token'); 
  const id = localStorage.getItem('userId') || new URLSearchParams(location.search).get('userId');
  return Boolean(token && token.trim() !== "");
}

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

async function loadContests() {
  try {
    const res = await fetch('/api/contests/competitions');
    if (!res.ok) throw new Error('無法取得比賽資料');
    const result = await res.json();

    const dbContests = result.competitions || result;

    contests = dbContests.map(contest => ({
      ...contest,
      tags: contest.tags ? contest.tags.split(',') : ['其他']
    }));

    return contests;
  } catch (err) {
    console.error('讀取比賽失敗:', err);
    contests = [];
    return [];
  }
}

function getContestMainTag(contest) {
  return contest.tags && contest.tags.length ? contest.tags[0] : '其他';
}

// 🚀 核心字典：只管中文對應，不用再猜英文代碼了
function preferenceKeywords(preferences = []) {
  const map = {
    // 預防萬一保留舊的英文
    'ai': ['ai', '人工智慧', '機器學習', '深度學習', '模型'],
    'robotics': ['機器人', '自動化', 'robot'],
    'medical': ['醫療', '健康', '照護', '生技'],
    'app': ['app', '手機', 'ios', 'android'],
    'business': ['商業個案', '商業', '企劃', '行銷', '商管', '創業'],
    'sustainability': ['永續', '環境', '綠色', 'esg', 'sdgs', '碳中和'],
    'web': ['網頁', '前端', '後端', '網站'],
    'algorithm': ['演算法', '程式設計', '解題', 'c++', 'python', '邏輯運算'],
    
    // 全面採用中文名稱作為 Key
    'ai / ml': ['ai', '人工智慧', '機器學習', '深度學習', '模型', 'ml'],
    '資料分析': ['資料', '數據', '分析', 'data', '大數據'],
    '網頁開發': ['網頁', '前端', '後端', '網站', 'web'],
    'app 開發': ['app', '手機', 'ios', 'android', '行動應用'],
    '機器人': ['機器人', '自動化', 'robot'],
    '資安': ['資安', '安全', '駭客', 'security', '資訊安全'],
    
    '醫療科技': ['醫療', '健康', '生技', '照護', '醫學'],
    '金融科技': ['金融', 'fintech', '區塊鏈', '理財', '支付'],
    '永續議題': ['永續', '環境', '綠色', 'esg', 'sdgs', '社會企業', '淨零'],
    '創業提案': ['創業', '新創', '提案', 'startup', '商業模式'],
    'ui/ux': ['ui', 'ux', '介面', '使用者體驗', '設計'],
    
    '簡報企劃': ['簡報', '企劃', '提案', '發表', 'pitch'],
    '物聯網 / 硬體整合': ['物聯網', 'iot', '硬體', '感測', '嵌入式'],
    '商業個案': ['商業個案', '商業', '企劃', '行銷', '商管', 'case'],
    '智慧城市 / 地方創生': ['智慧城市', '地方創生', '社區', '城鄉', '都市'],
    
    '建築與空間設計': ['建築', '空間', '室內設計', '景觀', '環境設計'],
    '智慧製造 / 機械工程': ['製造', '機械', '工廠', '自動化', '機電'],
    '體育賽事 / 健康促進': ['體育', '運動', '健康', '賽事', '休閒'],
    
    '智慧財產 / 專利活化': ['專利', '智財', '商標', '著作權', 'ip'],
    '行銷企劃 / 廣告設計': ['行銷', '廣告', '公關', '社群', '行銷企劃'],
    '社會參與 / 社會企業': ['社會', '志工', '公益', '社會企業', 'npo'],
    
    '電子商務 / 國際貿易': ['電商', '貿易', '電子商務', '進出口', '零售'],
    '演算法 / 程式設計': ['演算法', '程式設計', '解題', 'c++', 'python', '邏輯運算', '軟體設計']
  };

  const keywords = preferences.flatMap(key => {
    const lowerKey = String(key).toLowerCase();
    return map[lowerKey] ? map[lowerKey] : [lowerKey]; 
  });

  return keywords;
}

// 🚀 負責抓取資料庫標籤總表，並存在全域變數裡
async function fetchAllDbTags() {
  if (globalDbTags.length > 0) return globalDbTags; // 如果已經抓過就直接用
  try {
    const path = '/api/pref/allPrefTags';
    const res = await fetch(path);
    if (res.ok) {
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        globalDbTags = result.data;
        return result.data;
      }
    }
  } catch (e) {
    console.error("無法從資料庫讀取 Com_type 總表", e);
  }
  return [];
}

async function loadRecommendationPreferences() {
  const token = localStorage.getItem('token');
  if (!token) return [];

  try {
    const response = await fetch('/api/pref/getpref', {
      headers: { 'Authorization': token }
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        const rawPrefs = result.data;
        
        // 🚀 神級翻譯蒟蒻：拿著後端回傳的 Key，去總表裡面找出對應的中文！
        await fetchAllDbTags(); // 確保總表已經準備好
        const translatedPrefs = rawPrefs.map(pref => {
          // 不管傳來的是 comType_key 還是 comType，我們統一轉成中文的 comType
          const foundTag = globalDbTags.find(tag => tag.comType_key === pref || tag.comType === pref);
          return foundTag ? foundTag.comType : pref;
        });

        console.log('🔄 翻譯前的後端偏好：', rawPrefs);
        console.log('✨ 翻譯後的純中文偏好：', translatedPrefs);
        
        return translatedPrefs;
      }
    }
  } catch (err) {
    console.warn('無法從資料庫讀取偏好:', err);
  }

  return [];
}

async function initCategoryFilter() {
  const categoryFilter = document.getElementById('categoryFilter');
  if (!categoryFilter) return; 

  const dbTags = await fetchAllDbTags();

  if (!dbTags || dbTags.length === 0) return;

  const optionsHtml = dbTags.map(tag => {
    return `<option value="${tag.comType}">${tag.comType}</option>`;
  }).join('');

  categoryFilter.innerHTML = `<option value="all">所有分類</option>` + optionsHtml;
}

document.addEventListener('DOMContentLoaded', () => {
  initCategoryFilter();
});

// 🚀 算分系統升級：主副標籤加權，保證精準命中
function getRecommendedContests(dataList = [], preferences = []) {
  if (!preferences || preferences.length === 0) return [];

  const keywords = preferenceKeywords(preferences).map(item => String(item).toLowerCase());

  const scoredContests = dataList.map(contest => {
    const text = `${contest.com_name || ''} ${contest.com_intro || ''}`.toLowerCase();
    
    const mainTag = (contest.tags && contest.tags.length > 0) ? contest.tags[0].toLowerCase() : '';
    const subTagsText = (contest.tags && contest.tags.length > 1) ? contest.tags.slice(1).join(' ').toLowerCase() : '';

    let score = keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
    score += keywords.reduce((sum, keyword) => sum + (mainTag.includes(keyword) ? 10 : 0), 0);
    score += keywords.reduce((sum, keyword) => sum + (subTagsText.includes(keyword) ? 2 : 0), 0);

    return { contest, score };
  });

  console.log('📊 最終分數排行榜：', scoredContests.map(c => ({ name: c.contest.com_name, score: c.score })));

  return scoredContests
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score) 
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
    grid.innerHTML = '<div class="empty-note" style="grid-column: 1 / -1; color: #8a735e;">目前暫無適合的推薦比賽，先看看下方的熱門競賽吧！</div>';
    return;
  }

  grid.innerHTML = recommended.map(contest => {
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

function renderContests(dataList = []) {
  const grid = $('contestsGrid');
  if (!grid) return;

  grid.innerHTML = dataList.length ? dataList.map(contest => {
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

function applyFilters() {
  const q = $('contestSearch')?.value.trim().toLowerCase() || '';
  const category = $('categoryFilter')?.value || 'all';

  const filtered = contests.filter(contest => {
    const matchedText = `${contest.com_name || ''} ${contest.com_intro || ''}`.toLowerCase().includes(q);
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
  setupGeneralUiEvents();
  bindNotify();
  bindAvatar();

  Promise.all([loadContests(), isLoggedIn() ? loadRecommendationPreferences() : Promise.resolve([])]).then(([loadedContests, preferences]) => {
    currentPreferences = isLoggedIn() ? preferences : [];
    renderRecommendations(loadedContests);
    applyFilters();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
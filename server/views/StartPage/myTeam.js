import * as Data from '../team-data.js';

// DOM 元素選擇器輔助
const $ = id => document.getElementById(id);

// 核心狀態管理
let currentPreferences = [];
let allContestsData = []; // 快取比賽資料，供隊伍卡片對照比賽名稱使用
let activeTab = 'joined'; // 預設當前分頁：已加入

/**
 * 👑 1. 初始化管理控制台的所有事件監聽
 */
export function initManageDashboard() {
  const sidebarNav = document.querySelector('.manage-menu');
  if (!sidebarNav) return;

  // 綁定左側控制邊欄的「分類切換」點擊事件
  sidebarNav.addEventListener('click', async event => {
    const button = event.target.closest('[data-team-tab]');
    if (!button) return;

    // 切換按鈕的 active 狀態
    document.querySelectorAll('[data-team-tab]').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // 更新右側主畫面的標題
    const tab = button.dataset.teamTab;
    activeTab = tab;
    
    const tabTitles = {
      joined: '👥 已加入的隊伍',
      owned: '👑 我建立的隊伍',
      favorites: '♥ 我的收藏隊伍',
      history: '🕒 歷史紀錄隊伍'
    };
    if ($('currentTabTitle')) {
      $('currentTabTitle').textContent = tabTitles[tab] || '隊伍列表';
    }

    // 重新驅動中央主畫面的資料撈取與字卡渲染
    renderTeamsGridSection();
  });
}

/**
 * 👑 2. 驅動並渲染中央主畫面的隊伍字卡網格 (依照當前 activeTab)
 */
export async function renderTeamsGridSection() {
  const gridContainer = $('teamsGrid');
  if (!gridContainer) return;

  gridContainer.innerHTML = '<div class="loading-placeholder">動態資料加載中...</div>';

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  if (!isLoggedIn()) {
    gridContainer.innerHTML = '<div class="empty-text">請先登入以管理您的隊伍。</div>';
    return;
  }

  // 根據左側選單設定對應的後端 API 端點
  let apiEndpoint = '';
  switch (activeTab) {
    case 'joined':
      apiEndpoint = `/api/teams/my-joined?userId=${userId}`;
      break;
    case 'owned':
      apiEndpoint = `/api/teams/my-owned?userId=${userId}`;
      break;
    case 'favorites':
      apiEndpoint = `/api/teams/my-favorites?userId=${userId}`;
      break;
    case 'history':
      apiEndpoint = `/api/teams/my-history?userId=${userId}`; // 確保後端有此路由，或先用 joined 模擬
      break;
    default:
      apiEndpoint = `/api/teams/my-joined?userId=${userId}`;
  }

  try {
    const res = await fetch(apiEndpoint, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    });
    
    if (!res.ok) throw new Error('API 回傳失敗');
    const result = await res.json();
    
    // 取得隊伍陣列 (相容 success.data 或直接回傳陣列)
    const teams = result.data || result.teams || (Array.isArray(result) ? result : []);

    if (teams.length === 0) {
      gridContainer.innerHTML = `<div class="empty-text">目前在此分類下查無任何隊伍。</div>`;
      return;
    }

    // 渲染「精緻的隊伍字卡框框」
    gridContainer.innerHTML = teams.map(t => {
      // 判斷角色標籤：如果當前分頁本來就是我建立的，或是資料中 owner_id 等於目前登入者
      const isCreator = activeTab === 'owned' || String(t.owner_id) === String(userId);
      const badgeHtml = isCreator 
        ? `<span class="role-badge creator">我創立</span>` 
        : `<span class="role-badge member">已加入</span>`;

      // 預留容錯欄位名 (後端欄位可能為 t.competition_name 或 t.com_name)
      const contestName = t.competition_name || t.com_name || '未指定特定競賽';
      const currentCount = t.current_members || t.member_count || 1;
      const maxCount = t.max_members || 5;

      return `
        <div class="team-manage-card">
            <div class="card-top">
                ${badgeHtml}
                <h3 class="team-title">${Data.escapeHtml(t.team_name)}</h3>
            </div>
            <div class="card-mid">
                <div class="info-row">
                  <span class="label">競賽項目：</span>
                  <span class="val">${Data.escapeHtml(contestName)}</span>
                </div>
                <div class="info-row">
                  <span class="label">目前人數：</span>
                  <span class="val">${currentCount} / ${maxCount} 人</span>
                </div>
            </div>
            <div class="card-bottom">
                <button class="btn-manage-action" data-team-id="${t.team_id || t.id}">
                  管理隊伍
                </button>
            </div>
        </div>
      `;
    }).join('');

    // 綁定所有新生成卡片的「管理隊伍」按鈕點擊跳轉事件
    gridContainer.querySelectorAll('.btn-manage-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const teamId = btn.dataset.teamId;
        location.href = Data.withUserParam(`/team-info.html?teamId=${teamId}`);
      });
    });

  } catch (error) {
    console.error('❌ 中央管理字卡驅動失敗:', error);
    gridContainer.innerHTML = '<div class="empty-text" style="color:red;">資料載入失敗，請確認伺服器連線。</div>';
  }
}

/**
 * 👑 3. 渲染下方的固定輔助區塊：關注比賽、專屬推薦
 */
export async function loadSummaryContestsZone() {
  const token = localStorage.getItem('token');
  
  // 1. 撈取關注的比賽 (由 localStorage 驅動對照，或後端 API)
  const followedEl = $('followed');
  const contestFavs = JSON.parse(localStorage.getItem('favoriteContests') || '[]');

  try {
    // 預先拉取一次大賽庫以利後面推薦與關注對照
    const res = await fetch('/api/contests/competitions');
    if (res.ok) {
      const result = await res.json();
      allContestsData = result.competitions || result || [];
    }

    // 渲染關注比賽
    if (followedEl && allContestsData.length > 0) {
      const favContests = allContestsData.filter(c => contestFavs.includes(Number(c.id || c.com_id)));
      if (favContests.length > 0) {
        followedEl.innerHTML = favContests.map(c => `
          <a href="${Data.withUserParam(`/contest.html?id=${c.id || c.com_id}`)}" class="contest-item-link">
            <span>📌 ${Data.escapeHtml(c.name || c.com_name)}</span>
            <span style="font-size:12px; color:#caa77a;">查看詳情 →</span>
          </a>
        `).join('');
      } else {
        followedEl.innerHTML = '<div class="empty-text">暫無關注的比賽</div>';
      }
    }

    // 2. 撈取並渲染專屬推薦比賽
    const userId = localStorage.getItem('userId');
    if (isLoggedIn() && userId && window.AppPreferences?.loadUserPreferences) {
      currentPreferences = await window.AppPreferences.loadUserPreferences(userId);
    }
    renderRecommendationsUI(allContestsData, currentPreferences);

  } catch (err) {
    console.error('❌ 下方競賽摘要區載入失敗:', err);
  }
}

/**
 * 內部輔助：渲染推薦比賽垂直清單
 */
function renderRecommendationsUI(contests, preferences) {
  const body = $('recommendedBody');
  if (!body) return;
  
  const tags = preferences.length ? preferences : ['熱門'];
  // 篩選符合興趣標籤的前 3 個比賽
  const filtered = contests.filter(c => tags.some(t => (c.com_intro || '').includes(t))).slice(0, 3);
  
  if (filtered.length === 0) {
    body.innerHTML = '<div class="empty-text">暫無適合的推薦比賽</div>';
    return;
  }

  body.innerHTML = filtered.map(c => `
    <a href="${Data.withUserParam(`/contest.html?id=${c.com_id || c.id}`)}" class="contest-item-link" data-cid="${c.com_id || c.id}">
      <div>
        <span style="display:block;">✨ ${Data.escapeHtml(c.com_name || c.name)}</span>
        <small style="font-size:11px; color:#99k; font-weight:400;">${Data.escapeHtml((c.com_intro || '').substring(0, 35))}...</small>
      </div>
      <span style="font-size:12px; color:#caa77a; flex-shrink:0; margin-left:10px;">推薦 →</span>
    </a>
  `).join('');
}

function isLoggedIn() {
  const token = localStorage.getItem("token");
  return Boolean(token && token.trim() !== "");
}

const homeLink = $('homeLink');
if (homeLink) homeLink.href = withUserParam('/contests.html');

// ----------------------------------
// --- 🚀 初始自動啟動流程 ---
// ----------------------------------
initManageDashboard();       // 1. 綁定左側導覽選單控制監聽
renderTeamsGridSection();    // 2. 頁面一開，預設抓取渲染「已加入的隊伍」字卡
loadSummaryContestsZone();   // 3. 同步載入底部關注與推薦資訊
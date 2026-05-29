import * as Data from './team-data.js';

// DOM 元素選擇器輔助
const $ = id => document.getElementById(id);

// 核心狀態管理 (從主程式移入)
const collapsedSideCards = new Set(JSON.parse(localStorage.getItem('collapsedSideCards') || '[]'));
let currentPreferences = [];

/**
 * 👑 初始化右側邊欄的所有事件監聽
 */
export function initRightSidebar() {
  const rightSidebar = document.querySelector('.sidebar.right');
  if (!rightSidebar) return;

  // 1. 綁定卡片「展開 / 折疊」的點擊事件
  rightSidebar.addEventListener('click', event => {
    const toggle = event.target.closest('[data-card-toggle]');
    if (!toggle) return;
    const card = toggle.closest('[data-collapsible-card]');
    if (!card) return;

    const key = card.dataset.collapsibleCard;
    card.classList.toggle('collapsed');
    const isCollapsed = card.classList.contains('collapsed');
    toggle.setAttribute('aria-expanded', String(!isCollapsed));
    
    if (isCollapsed) collapsedSideCards.add(key);
    else collapsedSideCards.delete(key);
    
    localStorage.setItem('collapsedSideCards', JSON.stringify([...collapsedSideCards]));
  });

  // 2. 綁定「我加入的隊伍 / 我建立的隊伍」內部頁籤切換
  const myJoinedTeams = $('myJoinedTeams');
  const myOwnedTeams = $('myOwnedTeams');
  
  rightSidebar.addEventListener('click', event => {
    const button = event.target.closest('[data-my-team-tab]');
    if (!button) return;

    const tab = button.dataset.myTeamTab;
    const targetPanel = tab === 'joined' ? myJoinedTeams : myOwnedTeams;
    const isAlreadyOpen = button.classList.contains('active') && targetPanel && !targetPanel.hidden;
    
    if (isAlreadyOpen) {
      button.classList.remove('active');
      if (targetPanel) targetPanel.hidden = true;
      return;
    }
    
    document.querySelectorAll('[data-my-team-tab]').forEach(item => item.classList.toggle('active', item === button));
    if (myJoinedTeams) myJoinedTeams.hidden = tab !== 'joined';
    if (myOwnedTeams) myOwnedTeams.hidden = tab !== 'owned';
  });

  // 3. 綁定側邊欄「我管理的隊伍」內部的管理按鈕監聽
  if (myOwnedTeams) {
    myOwnedTeams.addEventListener('click', event => {
      const btn = event.target.closest('.manage-btn');
      if (btn && window.AppReview?.openTeamRequests) {
        window.AppReview.openTeamRequests(Number(btn.dataset.team));
      }
    });
  }

  // 4. 綁定「推薦比賽」點擊跳轉事件
  const recommendedContests = $('recommendedContests');
  if (recommendedContests) {
    recommendedContests.addEventListener('click', event => {
      const preferenceLink = event.target.closest('a');
      if (preferenceLink && !isLoggedIn()) {
        event.preventDefault();
        if (typeof window.requireLogin === 'function') window.requireLogin('設定個人化標籤需要先登入。');
        return;
      }
      
      const card = event.target.closest('[data-cid]');
      if (!card) return;
      if (!isLoggedIn()) {
        if (typeof window.requireLogin === 'function') window.requireLogin('查看推薦比賽詳情需要先登入。');
        return;
      }
      
      if (typeof Data.setSelectedContestId === 'function') {
        Data.setSelectedContestId(Number(card.dataset.cid));
      }
      location.href = Data.withUserParam(`/contest.html?id=${encodeURIComponent(card.dataset.cid)}`);
    });
  }

  // 5. 恢復使用者上次留下的卡片收合記憶
  applySideCardCollapseState();

  // 6. 如果登入，異步加載個性化推薦標籤
  const userId = localStorage.getItem('userId'); // 🚀 修正：改從本地獲取可靠的 userId
  if (isLoggedIn() && userId && window.AppPreferences?.loadUserPreferences) {
    window.AppPreferences.loadUserPreferences(userId).then(preferences => {
      currentPreferences = preferences;
      const rightSide = document.getElementById('rightSide') || document.querySelector('.sidebar.right');
      if (rightSide && rightSide.style.display !== 'none') {
        fetchAndRenderRecommended();
      }
    });
  }
}

/**
 * 👑 刷新並渲染右側所有需要接資料庫的區塊
 */
export async function updateRightSidebar(globalContests = [], globalTeams = []) {
  const rightSide = document.getElementById('rightSide') || document.querySelector('.sidebar.right');
  if (!isLoggedIn() || (rightSide && rightSide.style.display === 'none')) {
    return;
  }

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  try {
    const [joinedRes, ownedRes, favsRes] = await Promise.all([
      fetch(`/api/teams/my-joined?userId=${userId}`, { headers: { 'Authorization': ` ${token}` } }),
      fetch(`/api/teams/my-owned?userId=${userId}`, { headers: { 'Authorization': ` ${token}` } }),
      fetch(`/api/teams/my-favorites?userId=${userId}`, { headers: { 'Authorization': ` ${token}` } })
    ]);

    // 1. 渲染「已加入的隊伍」
    const myJoinedTeamsEl = $('myJoinedTeams');
    if (myJoinedTeamsEl && joinedRes.ok) {
      const joinedData = await joinedRes.json();
      if (joinedData.success && joinedData.data.length > 0) {
        myJoinedTeamsEl.innerHTML = 
        `<ul class="side-list">${joinedData.data.map(t => `
            <li><a href="${Data.withUserParam(`/team-info.html?teamId=${t.team_id}`)}">${Data.escapeHtml(t.team_name)}</a></li>`
        ).join('')}</ul>`;
      } else {
        myJoinedTeamsEl.textContent = '尚未加入隊伍';
      }
    }

    // 2. 渲染「我建立的隊伍」
    const myOwnedTeamsEl = $('myOwnedTeams');
    if (myOwnedTeamsEl && ownedRes.ok) {
      const ownedData = await ownedRes.json();
      if (ownedData.success && ownedData.data.length > 0) {
        myOwnedTeamsEl.innerHTML = `<ul class="side-list">${ownedData.data.map(t => `
          <li style="display:flex;justify-content:space-between;align-items:center; margin-bottom: 4px;">
            <a href="${Data.withUserParam(`/team-info.html?teamId=${t.team_id}`)}">${Data.escapeHtml(t.team_name)}</a>
            <button class="btn outline manage-btn" style="padding:2px 6px;font-size:12px;" data-team="${t.team_id}">管理</button>
          </li>`).join('')}</ul>`;
      } else {
        myOwnedTeamsEl.textContent = '尚未建立隊伍';
      }
    }

    // 3. 渲染「我的收藏隊伍」
    const myFavsEl = $('myFavs');
    if (myFavsEl && favsRes.ok) {
      const favsData = await favsRes.json();
      if (favsData.success && favsData.data.length > 0) {
        myFavsEl.innerHTML = `<ul class="fav-list">${favsData.data.map(t => `<li><strong>${Data.escapeHtml(t.team_name)}</strong></li>`).join('')}</ul>`;
      } else {
        myFavsEl.textContent = '尚無收藏隊伍';
      }
    }

    // 4. 渲染「關注的比賽」(延用舊邏輯)
    const contestFavs = JSON.parse(localStorage.getItem('favoriteContests') || '[]');
    const followedEl = $('followed');
    if (followedEl && globalContests.length > 0) {
      const favContests = globalContests.filter(c => contestFavs.includes(Number(c.id || c.com_id)));
      if (favContests.length > 0) {
        followedEl.innerHTML = `<ul class="side-list">${favContests.map(c => `<li><a href="${Data.withUserParam(`/contest.html?id=${c.id || c.com_id}`)}">${Data.escapeHtml(c.name || c.com_name)}</a></li>`).join('')}</ul>`;
      } else {
        followedEl.textContent = '無';
      }
    }

    // 5. 渲染「推薦比賽」
    if (globalContests.length > 0) {
      renderRecommendationsUI(globalContests, currentPreferences);
    } else {
      fetchAndRenderRecommended();
    }

  } catch (error) {
    console.error('❌ 右側邊欄即時異步渲染失敗:', error);
  }
}

/**
 * 內部輔助：單獨為推薦比賽撈取資料庫
 */
async function fetchAndRenderRecommended() {
  try {
    const res = await fetch('/api/contests/competitions');
    if (!res.ok) return;
    const result = await res.json();
    const contests = result.competitions || result;
    renderRecommendationsUI(contests, currentPreferences);
  } catch (err) {
    console.error('❌ 推薦區塊獨立拉取失敗:', err);
  }
}

/**
 * 內部輔助：把組裝好的推薦卡片塞入 DOM
 */
function renderRecommendationsUI(contests, preferences) {
  const body = $('recommendedBody');
  if (!body) return;
  
  const tags = preferences.length ? preferences : ['熱門'];
  const filtered = contests.filter(c => tags.some(t => (c.com_intro || '').includes(t))).slice(0, 3);
  
  if (filtered.length === 0) {
    body.innerHTML = '<div class="box">暫無適合的推薦比賽</div>';
    return;
  }

  body.innerHTML = filtered.map(c => `
    <div class="recommend-item" data-cid="${c.com_id || c.id}" style="cursor:pointer; padding:8px 0; border-bottom:1px solid #eee;">
      <strong style="font-size:14px;color:#4f3827;">${Data.escapeHtml(c.com_name || c.name)}</strong>
      <p style="margin:4px 0 0; font-size:12px; color:#888;">${Data.escapeHtml((c.com_intro || '').substring(0, 30))}...</p>
    </div>
  `).join('');
}

/**
 * 內部輔助：套用折疊狀態
 */
function applySideCardCollapseState() {
  document.querySelectorAll('[data-collapsible-card]').forEach(card => {
    const key = card.dataset.collapsibleCard;
    const isCollapsed = collapsedSideCards.has(key);
    card.classList.toggle('collapsed', isCollapsed);
    card.querySelector('[data-card-toggle]')?.setAttribute('aria-expanded', String(!isCollapsed));
  });
}

function isLoggedIn() {
  const token = localStorage.getItem("token");
  return Boolean(token && token.trim() !== "");
}

// ----------------------------------
// --- 🚀 初始自動啟動流程 ---
// ----------------------------------
initRightSidebar();     // 1. 建立監聽器
updateRightSidebar();   // 2. 🚀 新增：頁面一開，自動驅動撈取資料庫並把資料塞進側邊欄！
import * as Data from './team-data.js';

// DOM 元素選擇器輔助
const $ = id => document.getElementById(id);

// 核心狀態管理
let currentPreferences = [];
let allContestsData = []; // 快取比賽資料，供隊伍卡片與收藏比賽使用
let activeTab = 'my-teams'; // 預設當前分頁

// 🚀 四大分頁 Meta 資訊設定（包含右側主畫面大標題與動態 SVG 圖標）
const tabMeta = {
  'my-teams': {
    title: '我的隊伍',
    icon: `
      <svg viewBox="0 0 24 24">
        <path d="M16 20v-1.5c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4V20"/>
        <circle cx="9.5" cy="7.5" r="3.5"/>
        <path d="M21 20v-1.2c0-1.8-1.2-3.3-2.8-3.8"/>
        <path d="M16.5 4.4a3.4 3.4 0 0 1 0 6.2"/>
      </svg>`
  },
  'favorites-teams': {
    title: '我收藏的隊伍',
    icon: `
                      <svg viewBox="0 0 24 24">
                          <path d="m3 8 4.2 3.4L12 4l4.8 7.4L21 8l-2 11H5L3 8Z"/>
                          <path d="M6.5 15.5h11"/>
                      </svg>`
  },
  'favorites-com': {
    title: '我收藏的比賽',
    icon: `
      <svg viewBox="0 0 24 24">
        <path d="M12 20.5s-7.5-4.6-9.2-9.1C1.7 8.5 3.5 5.5 6.5 5.5c1.8 0 3.2 1 4 2.3.8-1.3 2.2-2.3 4-2.3 3 0 4.8 3 3.7 5.9C16.5 15.9 12 20.5 12 20.5Z"/>
      </svg>`
  },
  'history': {
    title: '歷史紀錄隊伍',
    icon: `
      <svg viewBox="0 0 24 24">
        <path d="M4 12a8 8 0 1 0 2.3-5.7"/>
        <path d="M4 4.8v4.5h4.5"/>
        <path d="M12 8v4.4l3 1.8"/>
      </svg>`
  }
};

/**
 * 👑 1. 初始化管理控制台的所有事件監聽
 */
export function initManageDashboard() {
  const sidebarNav = document.querySelector('.manage-menu');
  if (!sidebarNav) return;

  updateCurrentTabTitle(activeTab);

  sidebarNav.addEventListener('click', async event => {
    const button = event.target.closest('[data-team-tab]');
    if (!button) return;

    document.querySelectorAll('[data-team-tab]').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const tab = button.dataset.teamTab;
    activeTab = tab;
    updateCurrentTabTitle(tab);

    renderTeamsGridSection();
  });
}

/**
 * 👑 2. 驅動並渲染中央主畫面的網格 (核心四大模式切換與渲染)
 */
export async function renderTeamsGridSection() {
  const gridContainer = $('teamsGrid');
  if (!gridContainer) return;

  gridContainer.innerHTML = '<div class="loading-placeholder">動態資料加載中...</div>';

  const token = localStorage.getItem('token');
  const userId = getCurrentUserId();

  if (!isLoggedIn() || !userId || userId === 'unknown') {
    gridContainer.innerHTML = '<div class="empty-text">請先登入以檢視您的資料。</div>';
    return;
  }

  if (activeTab === 'history') {
    gridContainer.innerHTML = '<div class="empty-text">歷史紀錄隊伍目前尚未開放。</div>';
    return;
  }

  try {
    // ----------------------------------------------------------------------
    // 分頁一：我的隊伍 (混合我建立的、我加入的，前端安全標記去重)
    // ----------------------------------------------------------------------
    if (activeTab === 'my-teams') {
      const joinedUrl = `/api/teams/my-joined?userId=${encodeURIComponent(userId)}`;
      const ownedUrl = `/api/teams/my-owned?userId=${encodeURIComponent(userId)}`;

      const [resJoined, resOwned] = await Promise.all([
        fetch(joinedUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(ownedUrl, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const dataJoined = resJoined.ok ? await resJoined.json() : [];
      const dataOwned = resOwned.ok ? await resOwned.json() : [];

      const listJoined = dataJoined.data || dataJoined.teams || (Array.isArray(dataJoined) ? dataJoined : []);
      const listOwned = dataOwned.data || dataOwned.teams || (Array.isArray(dataOwned) ? dataOwned : []);

      const processedOwned = listOwned.map(item => ({ ...item, isApiOwner: true }));
      const processedJoined = listJoined.map(item => ({ ...item, isApiOwner: false }));

      const mergedMap = new Map();
      processedJoined.forEach(item => { const id = item.team_id || item.id; if (id) mergedMap.set(id, item); });
      processedOwned.forEach(item => { const id = item.team_id || item.id; if (id) mergedMap.set(id, item); });
      
      const teams = Array.from(mergedMap.values());

      if (teams.length === 0) {
        gridContainer.innerHTML = `<div class="empty-text">目前您尚未建立或加入任何隊伍。</div>`;
        return;
      }

      gridContainer.innerHTML = teams.map(t => {
        const userRole = String(t.role || t.membership || '').toLowerCase();
        const isCreator = t.isApiOwner === true || userRole === 'creator' || userRole === 'owner' || userRole === 'leader';
        const badgeHtml = isCreator ? `<span class="role-badge creator">我建立的隊伍</span>` : ``;

        const contestName = t.com_name || t.competition_name || '未指定特定競賽';
        const currentCount = t.current_member_count ?? t.current_members ?? t.member_count ?? 1;
        const maxCount = t.num_limit ?? t.max_members ?? 5;

        return `
          <div class="team-manage-card">
              <div class="card-top">
                  ${badgeHtml}
                  <h3 class="team-title" style="${!isCreator ? 'margin-top: 10px;' : ''}">${Data.escapeHtml(t.team_name)}</h3>
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

      gridContainer.querySelectorAll('.btn-manage-action').forEach(btn => {
        btn.addEventListener('click', () => {
          location.href = Data.withUserParam(`/team-info.html?teamId=${btn.dataset.teamId}`);
        });
      });

    // ----------------------------------------------------------------------
    // 分頁二：我收藏的隊伍 (原先撈取 my-favorites API 的功能)
    // ----------------------------------------------------------------------
    } else if (activeTab === 'favorites-teams') {
      const res = await fetch(`/api/teams/my-favorites?userId=${encodeURIComponent(userId)}`, { 
        headers: { 'Authorization': ` ${token}` } 
      });
      if (!res.ok) throw new Error('API 回傳失敗');
      const result = await res.json();
      const favTeams = result.data || result.teams || (Array.isArray(result) ? result : []);

      if (favTeams.length === 0) {
        gridContainer.innerHTML = `<div class="empty-text">目前您尚未收藏任何隊伍。</div>`;
        return;
      }

      gridContainer.innerHTML = favTeams.map(t => {
        const contestName = t.com_name || '未指定特定競賽';
        const currentCount = t.current_member_count ?? t.current_members ?? t.member_count ?? 1;
        const maxCount = t.num_limit ?? t.max_members ?? 5;

        return `
          <div class="team-manage-card">
              <div class="card-top">
                  <h3 class="team-title" style="margin-top: 5px;">${Data.escapeHtml(t.team_name)}</h3>
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
                    查看隊伍
                  </button>
              </div>
          </div>
        `;
      }).join('');

      gridContainer.querySelectorAll('.btn-manage-action').forEach(btn => {
        btn.addEventListener('click', () => {
          location.href = Data.withUserParam(`/team-info.html?teamId=${btn.dataset.teamId}`);
        });
      });

    // ----------------------------------------------------------------------
    // 分頁三：我收藏的比賽 (讀取總大賽庫與 localStorage 對照)
    // ----------------------------------------------------------------------
    } else if (activeTab === 'favorites-com') {
      if (!allContestsData || allContestsData.length === 0) {
        const res = await fetch('/api/contests/competitions');
        if (res.ok) {
          const result = await res.json();
          allContestsData = result.competitions || result || [];
        }
      }

      const contestFavs = JSON.parse(localStorage.getItem('favoriteContests') || '[]');
      const favContests = allContestsData.filter(c => contestFavs.includes(Number(c.id || c.com_id)));

      if (favContests.length === 0) {
        gridContainer.innerHTML = `<div class="empty-text">目前暫無收藏的比賽。快去首頁逛逛吧！</div>`;
        return;
      }

      gridContainer.innerHTML = favContests.map(c => {
        const cId = c.com_id || c.id;
        const cName = c.com_name || c.name || '未命名比賽';
        const cIntro = c.com_intro || '尚未填寫比賽說明';
        
        return `
          <div class="team-manage-card" style="border-left: 4px solid #caa77a;">
              <div class="card-top">
                  <h3 class="team-title" style="margin-top: 5px;">${Data.escapeHtml(cName)}</h3>
              </div>
              <div class="card-mid">
                  <div class="info-row">
                    <span class="label">簡介：</span>
                    <span class="val" style="font-weight:400; color:#666;">${Data.escapeHtml(cIntro.substring(0, 50))}...</span>
                  </div>
              </div>
              <div class="card-bottom">
                  <button class="btn-contest-action" data-contest-id="${cId}" style="width: 100%; background-color: #caa77a; color: white; border: none; padding: 10px 0; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer;">
                    前往比賽詳情 →
                  </button>
              </div>
          </div>
        `;
      }).join('');

      gridContainer.querySelectorAll('.btn-contest-action').forEach(btn => {
        btn.addEventListener('click', () => {
          location.href = Data.withUserParam(`/contest.html?id=${btn.dataset.contestId}`);
        });
      });
    }

  } catch (error) {
    console.error('❌ 中央管理網格驅動失敗:', error);
    gridContainer.innerHTML = '<div class="empty-text" style="color:red;">資料載入失敗，請確認網路連線。</div>';
  }
}

/**
 * 👑 3. 渲染下方的固定輔助區塊：關注比賽、專屬推薦
 */
export async function loadSummaryContestsZone() {
  const token = localStorage.getItem('token');
  const followedEl = $('followed');
  const contestFavs = JSON.parse(localStorage.getItem('favoriteContests') || '[]');

  try {
    const res = await fetch('/api/contests/competitions');
    if (res.ok) {
      const result = await res.json();
      allContestsData = result.competitions || result || [];
    }

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

    const userId = getCurrentUserId();
    if (isLoggedIn() && userId && window.AppPreferences?.loadUserPreferences) {
      currentPreferences = await window.AppPreferences.loadUserPreferences(userId);
    }
    renderRecommendationsUI(allContestsData, currentPreferences);

  } catch (err) {
    console.error('❌ 下方競賽摘要區載入失敗:', err);
  }
}

function renderRecommendationsUI(contests, preferences) {
  const body = $('recommendedBody');
  if (!body) return;
  
  const tags = preferences.length ? preferences : ['熱門'];
  const filtered = contests.filter(c => tags.some(t => (c.com_intro || '').includes(t))).slice(0, 3);
  
  if (filtered.length === 0) {
    body.innerHTML = '<div class="empty-text">暫無適合的推薦比賽</div>';
    return;
  }

  body.innerHTML = filtered.map(c => `
    <a href="${Data.withUserParam(`/contest.html?id=${c.com_id || c.id}`)}" class="contest-item-link" data-cid="${c.com_id || c.id}">
      <div>
        <span style="display:block;">✨ ${Data.escapeHtml(c.com_name || c.name)}</span>
        <small style="font-size:11px; color:#889; font-weight:400;">${Data.escapeHtml((c.com_intro || '').substring(0, 35))}...</small>
      </div>
      <span style="font-size:12px; color:#caa77a; flex-shrink:0; margin-left:10px;">推薦 →</span>
    </a>
  `).join('');
}

function isLoggedIn() {
  const token = localStorage.getItem("token");
  return Boolean(token && token.trim() !== "");
}

function updateCurrentTabTitle(tab) {
  const titleEl = $('currentTabTitle');
  if (!titleEl) return;

  const meta = tabMeta[tab] || tabMeta['my-teams'];
  titleEl.innerHTML = `
    <span class="title-icon" aria-hidden="true">${meta.icon}</span>
    <span>${meta.title}</span>
  `;
}

function getCurrentUserId() {
  const urlUserId = new URLSearchParams(location.search).get('userId');
  const userId = localStorage.getItem('userId') || urlUserId || Data.currentUserId;
  if (urlUserId && urlUserId !== 'unknown') {
    localStorage.setItem('userId', urlUserId);
  }
  return userId;
}

const homeLink = $('homeLink');
if (homeLink) homeLink.href = Data.withUserParam('/contests.html');

// --- 🚀 初始自動啟動流程 ---
initManageDashboard();       
renderTeamsGridSection();    
loadSummaryContestsZone();
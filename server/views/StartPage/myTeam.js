import * as Data from './team-data.js';

// DOM 元素選擇器輔助
const $ = id => document.getElementById(id);

// 核心狀態管理
let currentPreferences = [];
let allContestsData = []; // 快取比賽資料，供隊伍卡片對照比賽名稱使用
let activeTab = 'joined'; // 預設當前分頁：已加入

const tabMeta = {
  joined: {
    title: '已加入的隊伍',
    icon: `
      <svg viewBox="0 0 24 24">
        <path d="M16 20v-1.5c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4V20"/>
        <circle cx="9.5" cy="7.5" r="3.5"/>
        <path d="M21 20v-1.2c0-1.8-1.2-3.3-2.8-3.8"/>
        <path d="M16.5 4.4a3.4 3.4 0 0 1 0 6.2"/>
      </svg>`
  },
  owned: {
    title: '我建立的隊伍',
    icon: `
      <svg viewBox="0 0 24 24">
        <path d="m3 8 4.2 3.4L12 4l4.8 7.4L21 8l-2 11H5L3 8Z"/>
        <path d="M6.5 15.5h11"/>
      </svg>`
  },
  favorites: {
    title: '我的收藏隊伍',
    icon: `
      <svg viewBox="0 0 24 24">
        <path d="M12 20.5s-7.5-4.6-9.2-9.1C1.7 8.5 3.5 5.5 6.5 5.5c1.8 0 3.2 1 4 2.3.8-1.3 2.2-2.3 4-2.3 3 0 4.8 3 3.7 5.9C16.5 15.9 12 20.5 12 20.5Z"/>
      </svg>`
  },
  history: {
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
    updateCurrentTabTitle(tab);

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
  const userId = getCurrentUserId();

  if (!isLoggedIn() || !userId || userId === 'unknown') {
    gridContainer.innerHTML = '<div class="empty-text">請先登入以管理您的隊伍。</div>';
    return;
  }

  if (activeTab === 'history') {
    gridContainer.innerHTML = '<div class="empty-text">歷史紀錄隊伍目前尚未開放。</div>';
    return;
  }

  // 根據左側選單設定對應的後端 API 端點
  let apiEndpoint = '';
  switch (activeTab) {
    case 'joined':
      apiEndpoint = `/api/teams/my-joined?userId=${encodeURIComponent(userId)}`;
      break;
    case 'owned':
      apiEndpoint = `/api/teams/my-owned?userId=${encodeURIComponent(userId)}`;
      break;
    case 'favorites':
      apiEndpoint = `/api/teams/my-favorites?userId=${encodeURIComponent(userId)}`;
      break;
    default:
      apiEndpoint = `/api/teams/my-joined?userId=${encodeURIComponent(userId)}`;
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
    const cardsHtml = teams.map(t => {
      // 判斷角色標籤：如果當前分頁本來就是我建立的，或是資料中 owner_id 等於目前登入者
      const isCreator = activeTab === 'owned' || String(t.owner_id) === String(userId);
      const teamId = t.team_id || t.id;
      const pendingCount = getLocalApplications(teamId).filter(app => app.status === 'pending').length;
      const badgeHtml = isCreator 
        ? `<span class="role-badge creator">我創立</span>` 
        : `<span class="role-badge member">已加入</span>`;

      // 預留容錯欄位名 (後端欄位可能為 t.competition_name 或 t.com_name)
      const contestName = t.competition_name || t.com_name || t.contestName || '未指定特定競賽';
      const currentCount = t.current_member_count ?? t.current_members ?? t.member_count ?? 1;
      const maxCount = t.num_limit ?? t.max_members ?? 5;

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
                <button class="btn-manage-action" data-team-id="${teamId}">
                  管理隊伍
                </button>
                ${activeTab === 'owned' ? `
                  <div class="owned-action-row">
                    <button class="btn-secondary-action" data-owned-action="applications" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}">
                      申請審核${pendingCount ? ` (${pendingCount})` : ''}
                    </button>
                    <button class="btn-secondary-action" data-owned-action="members" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}">
                      隊友名單
                    </button>
                  </div>
                ` : ''}
            </div>
        </div>
      `;
    }).join('');

    gridContainer.innerHTML = activeTab === 'owned'
      ? `${cardsHtml}<section id="ownedTeamPanel" class="owned-team-panel"><div class="empty-text">選擇一支隊伍查看申請審核或隊友名單。</div></section>`
      : cardsHtml;

    // 綁定所有新生成卡片的「管理隊伍」按鈕點擊跳轉事件
    gridContainer.querySelectorAll('.btn-manage-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const teamId = btn.dataset.teamId;
        location.href = Data.withUserParam(`/team-info.html?teamId=${teamId}`);
      });
    });

    gridContainer.querySelectorAll('[data-owned-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        renderOwnedTeamPanel(btn.dataset.teamId, btn.dataset.teamName, btn.dataset.ownedAction);
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
    const userId = getCurrentUserId();
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

function getLocalApplications(teamId) {
  return JSON.parse(localStorage.getItem('teamApplications:v1') || '[]')
    .filter(app => Number(app.teamId) === Number(teamId));
}

function saveLocalApplications(applications) {
  localStorage.setItem('teamApplications:v1', JSON.stringify(applications));
}

function getLocalMembers(teamId) {
  return JSON.parse(localStorage.getItem(`teamMembers:v1:${teamId}`) || '[]');
}

function saveLocalMembers(teamId, members) {
  localStorage.setItem(`teamMembers:v1:${teamId}`, JSON.stringify(members));
}

function getCreatorMember() {
  const userId = getCurrentUserId();
  return {
    userId,
    applicantName: `隊長 ${userId}`,
    applicantContact: '登入帳號',
    applicantReason: '隊伍建立者',
    status: 'approved',
    role: '建立人'
  };
}

function renderOwnedTeamPanel(teamId, teamName, mode) {
  const panel = $('ownedTeamPanel');
  if (!panel) return;

  if (mode === 'applications') {
    renderApplicationsPanel(panel, teamId, teamName);
    return;
  }

  renderMembersPanel(panel, teamId, teamName);
}

function renderApplicationsPanel(panel, teamId, teamName) {
  const pending = getLocalApplications(teamId).filter(app => app.status === 'pending');

  panel.innerHTML = `
    <div class="owned-panel-head">
      <div>
        <span class="panel-eyebrow">申請審核</span>
        <h3>${Data.escapeHtml(teamName)}</h3>
      </div>
      <span class="panel-count">${pending.length} 筆待審</span>
    </div>
    ${pending.length ? pending.map(app => renderApplicationCard(app)).join('') : '<div class="empty-text">目前沒有待審核的申請。</div>'}
  `;

  panel.querySelectorAll('[data-application-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      handleLocalApplication(teamId, btn.dataset.applicationId, btn.dataset.applicationAction, teamName);
    });
  });
}

function renderApplicationCard(app) {
  const resume = app.resume?.data || app.resume || {};
  return `
    <article class="local-review-card">
      <div class="local-review-main">
        <div class="local-review-title">
          <strong>${Data.escapeHtml(app.applicantName)}</strong>
          <span>${new Date(app.createdAt).toLocaleDateString('zh-TW')}</span>
        </div>
        <p>聯絡方式：${Data.escapeHtml(app.applicantContact || '尚未填寫')}</p>
        <p>申請理由：${Data.escapeHtml(app.applicantReason || '尚未填寫')}</p>
        ${resume.school || resume.grade || resume.intro ? `
          <div class="local-resume-box">
            <strong>${Data.escapeHtml(app.resume?.name || resume.resume_name || '履歷摘要')}</strong>
            <span>學校：${Data.escapeHtml(resume.school || app.resume?.user_school || '未填寫')}</span>
            <span>年級：${Data.escapeHtml(resume.grade || app.resume?.department_grade || '未填寫')}</span>
            <span>自我介紹：${Data.escapeHtml(resume.intro || app.resume?.user_intro || '未填寫')}</span>
          </div>
        ` : ''}
      </div>
      <div class="local-review-actions">
        <button class="btn-secondary-action approve" data-application-action="approve" data-application-id="${app.id}">同意</button>
        <button class="btn-secondary-action reject" data-application-action="reject" data-application-id="${app.id}">拒絕</button>
      </div>
    </article>
  `;
}

function handleLocalApplication(teamId, applicationId, action, teamName) {
  const applications = JSON.parse(localStorage.getItem('teamApplications:v1') || '[]');
  const target = applications.find(app => app.id === applicationId);
  if (!target) return;

  target.status = action === 'approve' ? 'approved' : 'rejected';
  saveLocalApplications(applications);

  if (action === 'approve') {
    const members = getLocalMembers(teamId);
    const exists = members.some(member => String(member.userId) === String(target.userId));
    if (!exists) {
      members.push({ ...target, role: '組員' });
      saveLocalMembers(teamId, members);
    }
  }

  renderApplicationsPanel($('ownedTeamPanel'), teamId, teamName);
}

function renderMembersPanel(panel, teamId, teamName) {
  const members = [getCreatorMember(), ...getLocalMembers(teamId)];

  panel.innerHTML = `
    <div class="owned-panel-head">
      <div>
        <span class="panel-eyebrow">隊友名單</span>
        <h3>${Data.escapeHtml(teamName)}</h3>
      </div>
      <span class="panel-count">${members.length} 人</span>
    </div>
    <div class="local-members-list">
      ${members.map(member => `
        <article class="local-member-card">
          <div>
            <strong>${Data.escapeHtml(member.applicantName)}</strong>
            <span>${Data.escapeHtml(member.role || '組員')}</span>
          </div>
          <p>聯絡方式：${Data.escapeHtml(member.applicantContact || '尚未填寫')}</p>
          <p>備註：${Data.escapeHtml(member.applicantReason || '尚未填寫')}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function updateCurrentTabTitle(tab) {
  const titleEl = $('currentTabTitle');
  if (!titleEl) return;

  const meta = tabMeta[tab] || tabMeta.joined;
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

// ----------------------------------
// --- 🚀 初始自動啟動流程 ---
// ----------------------------------
initManageDashboard();       // 1. 綁定左側導覽選單控制監聽
renderTeamsGridSection();    // 2. 頁面一開，預設抓取渲染「已加入的隊伍」字卡
loadSummaryContestsZone();   // 3. 同步載入底部關注與推薦資訊

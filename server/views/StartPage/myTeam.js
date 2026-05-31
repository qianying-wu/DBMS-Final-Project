import * as Data from './team-data.js';
import * as tabMyTeams from './modules/tabMyTeams.js';
import * as tabSearchTalent from './modules/tabSearchTalent.js';
import * as tabFavTeams from './modules/tabFavTeams.js';
import * as tabFavContests from './modules/tabFavContests.js';
import * as tabHistory from './modules/tabHistory.js';

const $ = id => document.getElementById(id);
let allContestsData = []; 
let activeTab = 'my-teams'; 

// 🚀 四大分頁 Meta 資訊設定（包含右側主畫面大標題與動態 SVG 圖標）
const tabMeta = {
  'my-teams': { title: '我的隊伍', icon: `<svg viewBox="0 0 24 24"><path d="M16 20v-1.5c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M21 20v-1.2c0-1.8-1.2-3.3-2.8-3.8"/><path d="M16.5 4.4a3.4 3.4 0 0 1 0 6.2"/></svg>` },
  'search-talent': { title: '探索人才與隊伍', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><path d="M11 8a3 3 0 0 0-3 3"></path></svg>` },
  'favorites-teams': { title: '我收藏的隊伍', icon: `<svg viewBox="0 0 24 24"><path d="m3 8 4.2 3.4L12 4l4.8 7.4L21 8l-2 11H5L3 8Z"/><path d="M6.5 15.5h11"/></svg>` },
  'favorites-com': { title: '我收藏的比賽', icon: `<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.2-9.1C1.7 8.5 3.5 5.5 6.5 5.5c1.8 0 3.2 1 4 2.3.8-1.3 2.2-2.3 4-2.3 3 0 4.8 3 3.7 5.9C16.5 15.9 12 20.5 12 20.5Z"/></svg>` },
  'history': { title: '歷史紀錄隊伍', icon: `<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4.8v4.5h4.5"/><path d="M12 8v4.4l3 1.8"/></svg>` }
};

export function initManageDashboard() {
  const sidebarNav = document.querySelector('.manage-menu');
  if (!sidebarNav) return;

  updateCurrentTabTitle(activeTab);

  sidebarNav.addEventListener('click', async event => {
    const button = event.target.closest('[data-team-tab]');
    if (!button) return;

    document.querySelectorAll('[data-team-tab]').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    activeTab = button.dataset.teamTab;
    updateCurrentTabTitle(activeTab);
    renderTeamsGridSection();
  });

  setupReviewPanelDelegation();
}

export async function renderTeamsGridSection() {
  const gridContainer = $('teamsGrid');
  if (!gridContainer) return;

  const token = localStorage.getItem('token');
  const userId = getCurrentUserId();

  if (!isLoggedIn() || !userId || userId === 'unknown') {
    gridContainer.innerHTML = '<div class="empty-text">請先登入以檢視您的資料。</div>';
    return;
  }

  try {
    // my-owned / my-favorites API 回傳欄位較少，先載入完整隊伍與比賽資料來補齊卡片資訊。
    await ensureReferenceData();

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

      // 渲染「精緻的隊伍字卡框框」
      const cardsHtml = teams.map(t => {
        const fullTeam = enrichTeam(t);
        // 判斷是不是隊伍建立者；只有建立者才顯示審核申請與隊友名單入口。
        const isCreator = t.isApiOwner === true || activeTab === 'owned' || String(fullTeam.owner_id) === String(userId);
        const teamId = getTeamId(fullTeam);
        const pendingCount = getLocalApplications(teamId).filter(app => app.status === 'pending').length;
        const badgeHtml = isCreator
          ? `<span class="role-badge creator">我創立</span>`
          : `<span class="role-badge member">已加入</span>`;

        // 透過完整 Team.com_id 對到 Competition.com_name，補上原 API 沒回傳的比賽名稱。
        const contestName = getContestNameForTeam(fullTeam);
        const currentCount = getTeamDisplayCount(fullTeam);
        const maxCount = fullTeam.num_limit ?? fullTeam.max_members ?? 5;

        return `
        <div class="team-manage-card">
            <div class="card-top">
                ${badgeHtml}
                <h3 class="team-title">${Data.escapeHtml(fullTeam.team_name)}</h3>
            </div>
            <div class="card-mid">
                <div class="info-row">
                  <span class="label">競賽項目：</span>
                  <span class="val">${Data.escapeHtml(contestName)}</span>
                </div>
                <div class="info-row">
                  <span class="label">目前人數：</span>
                  <span class="val" data-member-count-team-id="${teamId}">${currentCount} / ${maxCount} 人</span>
                </div>
            </div>
            <div class="card-bottom">
                <button class="btn-manage-action" data-team-id="${teamId}">
                  管理隊伍
                </button>
                ${isCreator ? `
                  <div class="owned-action-row">
                    <button class="btn-secondary-action" data-owned-action="applications" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(fullTeam.team_name)}">
                      申請審核${pendingCount ? ` (${pendingCount})` : ''}
                    </button>
                    <button class="btn-secondary-action" data-owned-action="members" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(fullTeam.team_name)}">
                      隊友名單
                    </button>
                  </div>
                ` : ''}
            </div>
        </div>
      `;
      }).join('');

      gridContainer.innerHTML = `${cardsHtml}<section id="ownedTeamPanel" class="owned-team-panel"><div class="empty-text">選擇一支由您建立的隊伍，查看申請審核或隊友名單。</div></section>`;

      // 綁定所有新生成卡片的「管理隊伍」按鈕點擊跳轉事件
      gridContainer.querySelectorAll('.btn-manage-action').forEach(btn => {
        btn.addEventListener('click', () => {
          const teamId = btn.dataset.teamId;
          location.href = Data.withUserParam(`/team-info.html?teamId=${teamId}`);
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
        const fullTeam = enrichTeam(t);
        const teamId = getTeamId(fullTeam);
        const contestName = getContestNameForTeam(fullTeam);
        const currentCount = getTeamDisplayCount(fullTeam);
        const maxCount = fullTeam.num_limit ?? fullTeam.max_members ?? 5;

        return `
          <div class="team-manage-card">
              <div class="card-top">
                  <h3 class="team-title" style="margin-top: 5px;">${Data.escapeHtml(fullTeam.team_name)}</h3>
              </div>
              <div class="card-mid">
                  <div class="info-row">
                    <span class="label">競賽項目：</span>
                    <span class="val">${Data.escapeHtml(contestName)}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">目前人數：</span>
                    <span class="val" data-member-count-team-id="${teamId}">${currentCount} / ${maxCount} 人</span>
                  </div>
              </div>
              <div class="card-bottom">
                  <button class="btn-manage-action" data-team-id="${teamId}">
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
      await tabFavContests.render(gridContainer, allContestsData, (data) => { allContestsData = data; });
    } else if (activeTab === 'history') {
      await tabHistory.render(gridContainer);
    }
  } catch (error) {
    console.error('❌ 中央管理網格驅動失敗:', error);
    gridContainer.innerHTML = '<div class="empty-text" style="color:red;">資料載入失敗，請確認網路連線。</div>';
  }
}

// 👑 右側審核面板動態事件代理 (處理資料庫、本地與評價跳轉)
function setupReviewPanelDelegation() {
  const gridContainer = $('teamsGrid');
  if (!gridContainer) return;

  gridContainer.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-owned-action]');
    if (!btn) return;

    const action = btn.dataset.ownedAction;
    const teamId = btn.dataset.teamId;
    const teamName = btn.dataset.teamName;
    const token = localStorage.getItem('token');
    const panel = document.getElementById('ownedTeamPanel');

    if (!panel) return;
    panel.innerHTML = `<div class="loading-placeholder" style="padding:20px; text-align:center; color:#caa77a;">🔍 正在連線讀取【${Data.escapeHtml(teamName)}】...</div>`;

    try {
      const res = await fetch(`/api/teams/detail?teamId=${teamId}`, { headers: { 'Authorization': ` ${token}` } });
      if (!res.ok) throw new Error();
      const result = await res.json();
      const members = result.members || [];

      if (action === 'applications') {
        const applicants = members.filter(m => m.mem_status === '申請中' || m.status === '申請中');
        if (applicants.length === 0) {
          panel.innerHTML = `<div class="panel-header"><h3>👋 申請審核中心：${Data.escapeHtml(teamName)}</h3></div><div class="empty-text">🎉 目前沒有任何待審核的加入申請。</div>`;
          return;
        }

        let html = `<div class="panel-header" style="display:flex; justify-content:space-between;"><h3>👋 申請審核中心：${Data.escapeHtml(teamName)}</h3><span class="role-badge creator">${applicants.length} 筆待處理</span></div><div style="display:grid; gap:12px; margin-top:10px;">`;
        applicants.forEach(a => {
          html += `
            <div class="applicant-card" style="background:#fff; border:1px solid #eadfd2; border-radius:8px; padding:16px; display:flex; justify-content:space-between; align-items:center;">
              <div><strong>${Data.escapeHtml(a.user_name || '未知名稱')}</strong><small style="display:block; color:#8a735e; margin-top:4px;">附帶履歷：${Data.escapeHtml(a.resume_name || '預設履歷')}</small></div>
              <div style="display:flex; gap:8px;">
                <button class="btn-review-view" data-uid="${a.user_id}" data-res-id="${a.resume_id || ''}" style="cursor:pointer;">檢視履歷</button>
                <button class="btn-review-pass" data-uid="${a.user_id}" data-team-id="${teamId}" style="cursor:pointer; background:#caa77a; color:#fff; border:none; padding:4px 8px; border-radius:4px;">通過</button>
                <button class="btn-review-reject" data-uid="${a.user_id}" data-team-id="${teamId}" style="cursor:pointer; color:#b05353; background:#fff; border:1px solid #f3cccc; padding:4px 8px; border-radius:4px;">拒絕</button>
              </div>
            </div>`;
        });
        panel.innerHTML = html + '</div>';
        bindReviewActionButtons(panel);
      }

      if (action === 'members') {
        const activeMembers = members.filter(m => m.mem_status === '通過' || m.status === '通過');
        let html = `<div class="panel-header"><h3>👥 正式隊友名單：${Data.escapeHtml(teamName)}</h3></div><div style="display:grid; gap:8px; margin-top:10px;">`;
        activeMembers.forEach(m => {
          const isLeader = m.role === '建立人';
          html += `<div style="background:#fbfbfb; border:1px solid #eee; padding:12px; border-radius:6px; display:flex; justify-content:space-between;"><strong>${Data.escapeHtml(m.user_name || '隊員')}</strong><span class="role-badge">${isLeader ? '建立人' : '組員'}</span></div>`;
        });
        panel.innerHTML = html + '</div>';
      }
    } catch (err) {
      panel.innerHTML = `<div class="empty-text" style="color:red;">載入失敗，請確認伺服器連線。</div>`;
    }
  });
}

async function ensureReferenceData() {
  const [teams, contests] = await Promise.all([
    loadAllTeamsData(),
    loadAllContestsData()
  ]);
  allTeamsData = teams;
  allContestsData = contests;
}

async function loadAllTeamsData() {
  if (allTeamsData.length) return allTeamsData;

  try {
    const res = await fetch('/api/teams/all');
    if (!res.ok) throw new Error('無法取得完整隊伍資料');
    const result = await res.json();
    return result.data || result.teams || (Array.isArray(result) ? result : []);
  } catch (error) {
    console.error('❌ 補齊隊伍資料失敗:', error);
    return [];
  }
}

async function loadAllContestsData() {
  if (allContestsData.length) return allContestsData;

  try {
    const res = await fetch('/api/contests/competitions');
    if (!res.ok) throw new Error('無法取得完整比賽資料');
    const result = await res.json();
    return result.competitions || result.contests || (Array.isArray(result) ? result : []);
  } catch (error) {
    console.error('❌ 補齊比賽資料失敗:', error);
    return [];
  }
}

function getTeamId(team) {
  return team?.team_id || team?.id;
}

function enrichTeam(team) {
  const teamId = getTeamId(team);
  const fullTeam = allTeamsData.find(item => Number(getTeamId(item)) === Number(teamId)) || {};
  // 後端不同 API 回傳欄位不一致，所以用完整隊伍資料當底，再保留原 API 的角色標記。
  return { ...fullTeam, ...team, com_id: team.com_id || fullTeam.com_id };
}

function getContestNameForTeam(team) {
  const contestId = team.com_id || team.contestId || team.contest_id;
  const contest = allContestsData.find(item => Number(item.com_id || item.id) === Number(contestId));
  return team.competition_name || team.com_name || team.contestName || contest?.com_name || contest?.name || '未指定特定競賽';
}

function getTeamDisplayCount(team) {
  const teamId = getTeamId(team);
  // local 通過審核的隊友不會立刻同步後端，所以這裡把隊長 1 人 + local 成員一起算進顯示人數。
  const localApprovedCount = 1 + getLocalMembers(teamId).length;
  const dbCount = Number(team.current_member_count ?? team.current_members ?? team.member_count ?? 1) || 1;
  return Math.max(dbCount, localApprovedCount);
}

function refreshTeamCountBadge(teamId) {
  const el = document.querySelector(`[data-member-count-team-id="${teamId}"]`);
  if (!el) return;

  const fullTeam = enrichTeam({ team_id: teamId });
  const maxCount = fullTeam.num_limit ?? fullTeam.max_members ?? 5;
  el.textContent = `${getTeamDisplayCount(fullTeam)} / ${maxCount} 人`;
}

function getLocalApplications(teamId) {
  return JSON.parse(localStorage.getItem('teamApplications:v1') || '[]')
    .filter(app => Number(app.teamId) === Number(teamId));
}
  panelContainer.querySelectorAll('.btn-review-view').forEach(btn => {
    btn.addEventListener('click', () => alert(`即將跳轉檢視用戶 ID: ${btn.dataset.uid}`));
  });

  panelContainer.querySelectorAll('.btn-review-pass').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('確定要核准此成員加入隊伍嗎？')) return;
      try {
        const res = await fetch('/api/teams/review', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': ` ${token}` }, body: JSON.stringify({ team_id: btn.dataset.teamId, user_id: btn.dataset.uid, action: 'pass' }) });
        if (res.ok) { alert('已成功核准加入！'); renderTeamsGridSection(); }
      } catch (err) { alert('運作失敗'); }
    });
  });

  panelContainer.querySelectorAll('.btn-review-reject').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('確定要拒絕此申請嗎？')) return;
      try {
        const res = await fetch('/api/teams/review', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': ` ${token}` }, body: JSON.stringify({ team_id: btn.dataset.teamId, user_id: btn.dataset.uid, action: 'reject' }) });
        if (res.ok) { alert('已成功駁回申請。'); renderTeamsGridSection(); }
      } catch (err) { alert('運作失敗'); }
    });
  });


function isLoggedIn() { return Boolean(localStorage.getItem("token")?.trim()); }
function updateCurrentTabTitle(tab) { const titleEl = $('currentTabTitle'); if (!titleEl) return; const meta = tabMeta[tab] || tabMeta['my-teams']; titleEl.innerHTML = `<span class="title-icon" aria-hidden="true">${meta.icon}</span><span>${meta.title}</span>`; }
function getCurrentUserId() { const urlUserId = new URLSearchParams(location.search).get('userId'); const userId = localStorage.getItem('userId') || urlUserId || Data.currentUserId; if (urlUserId && urlUserId !== 'unknown') localStorage.setItem('userId', urlUserId); return userId; }


  target.status = action === 'approve' ? 'approved' : 'rejected';
  saveLocalApplications(applications);

  if (action === 'approve') {
    const members = getLocalMembers(teamId);
    const exists = members.some(member => String(member.userId) === String(target.userId));
    if (!exists) {
      members.push({ ...target, role: '組員' });
      saveLocalMembers(teamId, members);
    }
    refreshTeamCountBadge(teamId);
  }

  renderApplicationsPanel($('ownedTeamPanel'), teamId, teamName);


function renderMembersPanel(panel, teamId, teamName) {
  const members = [getCreatorMember(), ...getLocalMembers(teamId)];
  const currentUserId = getCurrentUserId();

  panel.innerHTML = `
    <div class="owned-panel-head">
      <div>
        <span class="panel-eyebrow">隊友名單</span>
        <h3>${Data.escapeHtml(teamName)}</h3>
      </div>
      <span class="panel-count">${members.length} 人</span>
    </div>
    <div class="local-members-list">
      ${members.map(member => {
        const canReview = String(member.userId) !== String(currentUserId);
        return `
        <article class="local-member-card">
          <div>
            <strong>${Data.escapeHtml(member.applicantName)}</strong>
            <span>${Data.escapeHtml(member.role || '組員')}</span>
          </div>
          <p>聯絡方式：${Data.escapeHtml(member.applicantContact || '尚未填寫')}</p>
          <p>備註：${Data.escapeHtml(member.applicantReason || '尚未填寫')}</p>
          ${canReview ? `
            <a class="btn-secondary-action review-link member-review-link" href="${buildReviewUrl(member.userId, { teamId, teamName })}">
              評價隊友
            </a>
          ` : ''}
        </article>
      `;
      }).join('')}
    </div>
  `;
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
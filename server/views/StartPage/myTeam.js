import * as Data from './team-data.js';
import * as tabMyTeams from './modules/tabMyTeams.js';
import * as tabSearchTalent from './modules/tabSearchTalent.js';
import * as tabFavTeams from './modules/tabFavTeams.js';
import * as tabFavContests from './modules/tabFavContests.js';
import * as tabHistory from './modules/tabHistory.js';

const $ = id => document.getElementById(id);
let allContestsData = []; 
let activeTab = 'my-teams'; 

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
    if (activeTab === 'my-teams') {
      await tabMyTeams.render(gridContainer, token, userId);
    } else if (activeTab === 'search-talent') {
      await tabSearchTalent.render(gridContainer, token, userId);
    } else if (activeTab === 'favorites-teams') {
      await tabFavTeams.render(gridContainer, token, userId);
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
          html += `<div style="background:#fbfbfb; border:1px solid #eee; padding:12px; border-radius:6px; display:flex; justify-content:space-between;"><strong>${Data.escapeHtml(m.userName || '隊員')}</strong><span class="role-badge">${isLeader ? '建立人' : '組員'}</span></div>`;
        });
        panel.innerHTML = html + '</div>';
      }
    } catch (err) {
      panel.innerHTML = `<div class="empty-text" style="color:red;">載入失敗，請確認伺服器連線。</div>`;
    }
  });
}

function bindReviewActionButtons(panelContainer) {
  const token = localStorage.getItem('token');

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
}

function isLoggedIn() { return Boolean(localStorage.getItem("token")?.trim()); }
function updateCurrentTabTitle(tab) { const titleEl = $('currentTabTitle'); if (!titleEl) return; const meta = tabMeta[tab] || tabMeta['my-teams']; titleEl.innerHTML = `<span class="title-icon" aria-hidden="true">${meta.icon}</span><span>${meta.title}</span>`; }
function getCurrentUserId() { const urlUserId = new URLSearchParams(location.search).get('userId'); const userId = localStorage.getItem('userId') || urlUserId || Data.currentUserId; if (urlUserId && urlUserId !== 'unknown') localStorage.setItem('userId', urlUserId); return userId; }

const homeLink = $('homeLink'); if (homeLink) homeLink.href = Data.withUserParam('/contests.html');

// 啟動
initManageDashboard();
renderTeamsGridSection();
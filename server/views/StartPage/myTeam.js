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

  // 👑 修正點：從 tabMyTeams 模組調用被抽離的事件代理，並將刷新網格的函式作為 Callback 傳進去
  tabMyTeams.setupReviewPanelDelegation(renderTeamsGridSection);
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
      await tabHistory.render(gridContainer, token, userId);
    }
  } catch (error) {
    console.error('❌ 中央管理網格驅動失敗:', error);
    gridContainer.innerHTML = '<div class="empty-text" style="color:red;">資料載入失敗，請確認網路連線。</div>';
  }
}

function isLoggedIn() { return Boolean(localStorage.getItem("token")?.trim()); }
function updateCurrentTabTitle(tab) { const titleEl = $('currentTabTitle'); if (!titleEl) return; const meta = tabMeta[tab] || tabMeta['my-teams']; titleEl.innerHTML = `<span class="title-icon" aria-hidden="true">${meta.icon}</span><span>${meta.title}</span>`; }
function getCurrentUserId() { const urlUserId = new URLSearchParams(location.search).get('userId'); const userId = localStorage.getItem('userId') || urlUserId || Data.currentUserId; if (urlUserId && urlUserId !== 'unknown') localStorage.setItem('userId', urlUserId); return userId; }

const homeLink = $('homeLink'); if (homeLink) homeLink.href = Data.withUserParam('/contests.html');

// 啟動
initManageDashboard();
renderTeamsGridSection();

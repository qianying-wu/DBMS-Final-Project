import * as Data from './team-data.js';
import * as UI from './team-ui.js';

// DOM 元素簡寫函式與取得頁面上各個重要元素的參考
const $ = id => document.getElementById(id);
const teamsGrid = $('teamsGrid');
const contestsGrid = $('contestsGrid');
const recommendedContests = $('recommendedContests');
const myJoinedTeams = $('myJoinedTeams');
const myOwnedTeams = $('myOwnedTeams');
const createBtn = $('createBtn');
const openCreate = $('openCreate');
const modal = $('modal');
const modalCreate = $('modalCreate');
const modalCancel = $('modalCancel');
const newTeamName = $('newTeamName');
const newTeamDesc = $('newTeamDesc');

// 初始化狀態變數
let currentPreferences = window.AppPreferences?.getFallbackPreferences(Data.currentUserId) || [];
let expandedContestCategory = localStorage.getItem('expandedContestCategory') || '';
let currentAd = 0;

// 設定廣告橫幅的自動輪播（每 4 秒切換一次）
setInterval(() => {
  const inner = document.querySelector('.carousel-inner');
  if (!inner) return;
  currentAd = (currentAd + 1) % 3;
  inner.style.transform = `translateX(-${currentAd * 100}%)`;
}, 4000);

// 產生帶有 userId 參數的內部連結網址
function teamInfoHref(id) {
  return Data.withUserParam(`/team-info.html?teamId=${encodeURIComponent(id)}`);
}
function getCreateTeamHref() {
  return Data.withUserParam('/create-team.html');
}

// 核心渲染函式：負責讀取資料並驅動 UI 層去更新畫面
function render() {
  const teams = Data.loadTeams();
  const favs = Data.loadFavorites();
  const contestFavs = Data.loadContestFavorites();
  const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
  const selectedContest = Data.getSelectedContestId();
  const contests = Data.loadContests();

  // 通知系統連動
  window.AppNotifications?.ensureContestNotifications(contests);
  
  // 清空隊伍列表，準備重新渲染
  teamsGrid.innerHTML = '';

  // 呼叫 UI 模組渲染各個區塊
  UI.renderRecommendations(contests, currentPreferences);
  UI.renderContestOverview(contests, teams, selectedContest, contestFavs);
  expandedContestCategory = UI.renderContestCategoryList(contests, selectedContest, expandedContestCategory);

  // 渲染符合當前所選比賽條件的「隊伍卡片」
  teams.forEach(team => {
    if (selectedContest != null && Number(team.contestId || 0) !== Number(selectedContest)) return;
    const isFav = favs.includes(team.id);
    const isOwner = String(team.owner) === String(Data.currentUserId) || (String(Data.currentUserId) === String(Data.ME.id) && Number(team.owner) === Number(Data.ME.id));
    const pending = reqs.filter(request => request.teamId === team.id && request.status === 'pending').length;
    const contest = contests.find(item => Number(item.id) === Number(team.contestId));
    
    // 建立隊伍卡片 DOM 並附加到 teamsGrid 容器中
    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="display:flex;align-items:center;gap:8px"><h4 style="margin:0">${Data.escapeHtml(team.name)}</h4>${isOwner && pending ? `<span class="pending-count">${pending}</span>` : ''}</div>
        <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${team.id}" aria-pressed="${isFav}">${isFav ? '♥' : '♡'}</button>
      </div>
      <div class="team-meta">${Data.escapeHtml(team.desc || '')}</div>
      ${contest ? `<div class="team-contest">比賽：<strong>${Data.escapeHtml(contest.name)}</strong></div>` : ''}
      <div>成員 ${team.members} / ${team.slots}</div>
      <div style="margin-top:8px">
        <button class="btn" data-id="${team.id}">查看 / 加入</button>
        ${isOwner ? `<button class="btn outline manage-btn" data-team="${team.id}">管理</button>` : ''}
      </div>
    `;
    teamsGrid.appendChild(card);
  });

  // 收尾處理與其他側邊欄區塊渲染
  Data.cleanupLegacyMyTeams(teams);
  UI.renderSidebarTeams(teams);
  UI.renderContestInfo(contests, selectedContest);
  UI.renderFollowedContests(contests, contestFavs);
}

// 點擊事件：切換某個隊伍的收藏狀態
function toggleFavorite(id) {
  const favorites = Data.loadFavorites();
  const index = favorites.indexOf(id);
  if (index >= 0) favorites.splice(index, 1);
  else favorites.push(id);
  Data.saveFavorites(favorites);
  render();
}

// 點擊事件：切換某個比賽的收藏狀態
function toggleContestFavorite(id) {
  const favs = Data.loadContestFavorites();
  const index = favs.indexOf(Number(id));
  if (index >= 0) favs.splice(index, 1);
  else favs.push(Number(id));
  Data.saveContestFavorites(favs);
  render();
}

// 跳轉到單一隊伍的詳細資訊頁面
function openTeamDetail(id) {
  location.href = teamInfoHref(id);
}
window.openTeamDetail = openTeamDetail; // 暴露給全域搜尋的點擊事件使用


// --- 請求管理模態視窗邏輯區塊 ---
const requestsModal = $('requestsModal');
const requestsList = $('requestsList');
const closeReq = $('closeReq');

// 開啟某隊伍的「管理申請」視窗，驗證權限並載入申請資料
function openRequestsForTeam(teamId) {
  const teams = Data.loadTeams();
  const team = teams.find(item => item.id === teamId);
  if (!team) return alert('找不到隊伍');
  const isOwner = String(team.owner) === String(Data.currentUserId) || (String(Data.currentUserId) === String(Data.ME.id) && Number(team.owner) === Number(Data.ME.id));
  if (!isOwner) return alert('只有隊長可以管理本隊的加入請求');
  const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]').filter(request => request.teamId === teamId && request.status === 'pending');
  if (!reqs.length) { alert('目前沒有待審核申請'); return; }
  
  requestsList.innerHTML = UI.renderRequestsHtml(reqs);
  requestsModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}
window.AppReview = { openTeamRequests: openRequestsForTeam };

// 委派監聽：處理管理視窗內的「批准 (approve)」與「拒絕 (deny)」按鈕點擊邏輯
requestsList && requestsList.addEventListener('click', event => {
  const btn = event.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.act;
  const id = Number(btn.dataset.id);
  const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
  const idx = reqs.findIndex(request => request.id === id);
  if (idx < 0) return;

  if (act === 'approve') {
    const teams = Data.loadTeams();
    const teamIndex = teams.findIndex(team => team.id === reqs[idx].teamId);
    if (teamIndex < 0) return alert('隊伍不存在，無法批准');
    if ((teams[teamIndex].members || 0) >= (teams[teamIndex].slots || 0)) {
      reqs[idx].status = 'denied';
      localStorage.setItem('joinRequests', JSON.stringify(reqs));
      alert('隊伍已額滿，無法批准本申請（已自動拒絕）。');
    } else {
      reqs[idx].status = 'approved';
      teams[teamIndex].members = (teams[teamIndex].members || 0) + 1;
      Data.saveTeams(teams);
      const joined = JSON.parse(localStorage.getItem(`myTeams:${reqs[idx].user.id}`) || '[]');
      if (!joined.some(item => Number(item) === Number(reqs[idx].teamId))) {
        joined.push(reqs[idx].teamId);
        localStorage.setItem(`myTeams:${reqs[idx].user.id}`, JSON.stringify(joined));
      }
      localStorage.setItem('joinRequests', JSON.stringify(reqs));
      alert('已批准');
      render();
    }
  } else {
    reqs[idx].status = 'denied';
    localStorage.setItem('joinRequests', JSON.stringify(reqs));
    alert('已拒絕');
  }

  const pending = JSON.parse(localStorage.getItem('joinRequests') || '[]').filter(request => request.teamId === reqs[idx].teamId && request.status === 'pending');
  if (pending.length) requestsList.innerHTML = UI.renderRequestsHtml(pending);
  else {
    requestsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }
});

// 關閉管理視窗
closeReq && closeReq.addEventListener('click', () => {
  requestsModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
});


// --- 頁面全域事件委派 (Event Delegation) 區塊 ---

// 監聽隊伍列表的點擊，透過判斷點到的按鈕 className 決定要收藏、管理或是進入詳情
teamsGrid.addEventListener('click', event => {
  const btn = event.target.closest('button');
  if (!btn) return;
  const teamId = btn.dataset.id || btn.dataset.team;
  if (!teamId) return;
  if (btn.classList.contains('fav-btn')) { toggleFavorite(Number(teamId)); return; }
  if (btn.classList.contains('manage-btn')) { openRequestsForTeam(Number(teamId)); return; }
  openTeamDetail(Number(teamId));
});

// 監聽側邊欄「我管理的隊伍」區塊的管理按鈕點擊
myOwnedTeams.addEventListener('click', event => {
  const btn = event.target.closest('.manage-btn');
  if (btn) openRequestsForTeam(Number(btn.dataset.team));
});


// --- 建立隊伍視窗 (Create Team Modal) 邏輯 ---
function hideModal() {
  modal.classList.add('hidden');
  newTeamName.value = '';
  newTeamDesc.value = '';
}
function closeModal() {
  document.body.classList.remove('modal-open');
  hideModal();
}
const openCreateTeamPage = () => location.href = getCreateTeamHref();

// 綁定建立按鈕與取消按鈕的事件
// createBtn.addEventListener('click', openCreateTeamPage);
// if (openCreate) openCreate.addEventListener('click', openCreateTeamPage);
// modalCancel.addEventListener('click', closeModal);

// 綁定建立按鈕與取消按鈕的事件
createBtn.addEventListener('click', (e) => {
  // 🎯 1. 攔截點擊，先去口袋拿 Token
  const token = localStorage.getItem('token');

  // 🎯 2. 沒 Token 代表沒登入，直接彈窗擋人
  if (!token) {
    alert('【系統提示】請先登入才能創建隊伍喔！');
    window.location.href = '/auth.html'; // 💡 送去你們的前端登入頁（確認一下檔名喔）
    return;
  }
  // 🎯 3. 有 Token 才放行，跑你們原本的跳轉或開啟彈窗邏輯
  openCreateTeamPage();
});
// 如果頁面上還有另一個按鈕 openCreate，也順便一起保護起來：
if (openCreate) {
  openCreate.addEventListener('click', (e) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('【系統提示】請先登入才能創建隊伍喔！');
      window.location.href = '/auth.html';
      return;
    }
    openCreateTeamPage();
  });
}

// 處理 Modal 內的建立送出邏輯，驗證欄位並存入 localStorage 後重新 render()
modalCreate.addEventListener('click', () => {
  const name = newTeamName.value.trim();
  if (!name) return alert('請輸入隊名');
  const desc = newTeamDesc.value.trim();
  const teams = Data.loadTeams();
  const selectedContest = Data.getSelectedContestId();
  teams.unshift({ id: Date.now(), name, desc, members: 1, slots: 4, owner: Data.ME.id, contestId: selectedContest || undefined });
  Data.saveTeams(teams);
  closeModal();
  render();
});

// 點擊遮罩外圍或按 ESC 鍵關閉 Modal
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });


const homeLink = $('homeLink');
if (homeLink) homeLink.href = Data.withUserParam('/team.html');

// --- 導覽列與左側選單的互動監聽 ---

// 監聽左側選單點擊：展開/折疊分類，或者選中特定比賽並更新網址跳轉
document.addEventListener('click', event => {
  const categoryButton = event.target.closest('[data-contest-category]');
  if (categoryButton) {
    const key = categoryButton.dataset.contestCategory;
    expandedContestCategory = expandedContestCategory === key ? '' : key;
    if (expandedContestCategory) localStorage.setItem('expandedContestCategory', expandedContestCategory);
    else localStorage.removeItem('expandedContestCategory');
    render();
    return;
  }
  const contestButton = event.target.closest('#contestsList [data-cid]');
  if (!contestButton) return;
  const cid = Number(contestButton.dataset.cid);
  Data.setSelectedContestId(cid);
  location.href = Data.withUserParam(`/contest.html?id=${encodeURIComponent(cid)}`);
});

// 監聽上方比賽橫幅區塊的點擊：處理收藏或是點擊進入該比賽頁面
contestsGrid && contestsGrid.addEventListener('click', event => {
  const favBtn = event.target.closest('[data-contest-fav]');
  if (favBtn) {
    event.stopPropagation();
    toggleContestFavorite(Number(favBtn.dataset.contestFav));
    return;
  }
  if (event.target.closest('.and-more')) {
    location.href = Data.withUserParam('/contests.html');
    return;
  }
  const card = event.target.closest('[data-cid]');
  if (!card) return;
  const cid = Number(card.dataset.cid);
  Data.setSelectedContestId(cid);
  location.href = Data.withUserParam(`/contest.html?id=${encodeURIComponent(cid)}`);
});

recommendedContests && recommendedContests.addEventListener('click', event => {
  const card = event.target.closest('[data-cid]');
  if (!card) return;
  Data.setSelectedContestId(Number(card.dataset.cid));
  location.href = Data.withUserParam(`/contest.html?id=${encodeURIComponent(card.dataset.cid)}`);
});

// 處理側邊欄「我加入的隊伍 / 我建立的隊伍」頁籤切換
document.querySelectorAll('[data-my-team-tab]').forEach(button => {
  button.addEventListener('click', () => {
    const tab = button.dataset.myTeamTab;
    document.querySelectorAll('[data-my-team-tab]').forEach(item => item.classList.toggle('active', item === button));
    myJoinedTeams.hidden = tab !== 'joined';
    myOwnedTeams.hidden = tab !== 'owned';
  });
});


// --- 初始啟動流程 ---
// 1. 執行第一次畫面渲染
render();
// 2. 非同步載入使用者偏好，完成後再次渲染推薦區塊
window.AppPreferences?.loadUserPreferences(Data.currentUserId).then(preferences => {
  currentPreferences = preferences;
  render();
});
// 3. 檢查網址參數是否要求一進來就打開特定的管理視窗
const manageTeamId = new URLSearchParams(location.search).get('manageTeamId');
if (manageTeamId) setTimeout(() => openRequestsForTeam(Number(manageTeamId)), 0);


// --- 全域搜尋 (Global Search) 邏輯區塊 ---
const globalSearch = $('globalSearch');
const globalSearchOverlay = $('globalSearchOverlay');
const btnExitSearch = $('btnExitSearch');
const globalSearchResults = $('globalSearchResults');
const searchTabs = document.querySelectorAll('.s-tab');
let currentGlobalTab = 'team';
const mockUsers = ['張同學', '李學長 (後端)', '王大神', '陳學妹', '林教授'];

// 綁定搜尋框的 focus (打開遮罩) 與 input (執行搜尋) 事件
if (globalSearch && globalSearchOverlay) {
  globalSearch.addEventListener('focus', () => {
    globalSearchOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    runGlobalSearch();
  });
  globalSearch.addEventListener('input', runGlobalSearch);
}
if (btnExitSearch) btnExitSearch.addEventListener('click', closeGlobalSearch);

// 關閉搜尋遮罩的邏輯
function closeGlobalSearch() {
  globalSearchOverlay.classList.add('hidden');
  document.body.style.overflow = '';
  globalSearch.value = '';
}
window.closeGlobalSearch = closeGlobalSearch;

// 處理搜尋面板內的頁籤切換 (比賽、隊伍、用戶)
searchTabs.forEach(tab => {
  tab.addEventListener('click', event => {
    searchTabs.forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
    currentGlobalTab = event.currentTarget.dataset.tab;
    runGlobalSearch();
  });
});

// 執行文字比對並渲染搜尋結果列表 HTML
function runGlobalSearch() {
  const q = globalSearch.value.trim().toLowerCase();
  if (!q) {
    globalSearchResults.innerHTML = '<div style="padding:30px;text-align:center;color:#8a735e;">請輸入關鍵字開始搜尋...</div>';
    return;
  }
  const teams = Data.loadTeams();
  const contests = Data.loadContests();
  let html = '';

  if (currentGlobalTab === 'comp') {
    const results = contests.filter(contest => contest.name.toLowerCase().includes(q) || (contest.info && contest.info.toLowerCase().includes(q)));
    html = results.map(contest => `
      <div class="search-list-item" onclick="document.querySelector('#contestsList [data-cid=\\'${contest.id}\\']')?.click(); window.closeGlobalSearch();">
        <strong style="color:#4f3827;">競賽：${Data.escapeHtml(contest.name)}</strong>
        <span style="font-size:12px;color:#8a735e;margin-left:8px;">(${Data.escapeHtml(contest.date)})</span>
        <p style="margin:4px 0 0;font-size:13px;color:#666;">${Data.escapeHtml(contest.info)}</p>
      </div>
    `).join('');
  } else if (currentGlobalTab === 'team') {
    const results = teams.filter(team => team.name.toLowerCase().includes(q) || (team.desc && team.desc.toLowerCase().includes(q)));
    html = results.map(team => `
      <div class="search-list-item" onclick="window.closeGlobalSearch(); window.openTeamDetail(${team.id});">
        <strong style="color:#4f3827;">隊伍：${Data.escapeHtml(team.name)}</strong>
        <span style="font-size:12px;color:#8a735e;margin-left:8px;">(缺額: ${team.slots - team.members})</span>
        <p style="margin:4px 0 0;font-size:13px;color:#666;">${Data.escapeHtml(team.desc)}</p>
      </div>
    `).join('');
  } else if (currentGlobalTab === 'user') {
    const results = mockUsers.filter(user => user.toLowerCase().includes(q));
    html = results.map(user => `
      <div class="search-list-item">
        <strong style="color:#4f3827;">用戶：${Data.escapeHtml(user)}</strong>
      </div>
    `).join('');
  }
  globalSearchResults.innerHTML = html || '<div style="padding:20px;text-align:center;color:#8a735e;">沒有找到符合的結果</div>';
}
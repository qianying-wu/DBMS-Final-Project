import * as Data from '../team-data.js';

let activeToken = '';
let activeUserId = '';
let activeFilter = 'all';
let searchTimer = null;
let isComposing = false;
let teamCache = null;

export async function render(gridContainer, token, userId) {
  activeToken = token || '';
  activeUserId = userId || '';
  activeFilter = 'all';

  gridContainer.innerHTML = `
    <div class="talent-search-page">
      <div class="search-main-area">
        <p class="search-subtitle-full">輸入使用者名稱、用戶 ID、隊伍名稱或需求，找到後可前往評價頁或隊伍頁。</p>
        <div class="search-control-row">
          <input type="text" id="talentSearchInput" placeholder="搜尋用戶或隊伍...">
          <div class="search-filter-tabs" role="tablist" aria-label="搜尋類型">
            <button class="search-filter-btn active" data-search-filter="all" type="button">全部</button>
            <button class="search-filter-btn" data-search-filter="users" type="button">用戶</button>
            <button class="search-filter-btn" data-search-filter="teams" type="button">隊伍</button>
          </div>
        </div>
        <div id="talentSearchResults">
          <p id="searchStatusMsg" class="status-msg-no-wrap" style="display:none;"></p>
          <div id="resultsGrid" class="user-search-results"></div>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById('talentSearchInput');
  const filterTabs = document.querySelector('.search-filter-tabs');

  filterTabs?.addEventListener('click', event => {
    const button = event.target.closest('[data-search-filter]');
    if (!button) return;

    activeFilter = button.dataset.searchFilter || 'all';
    document.querySelectorAll('[data-search-filter]').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    scheduleTalentSearch(0);
  });

  input?.addEventListener('compositionstart', () => {
    isComposing = true;
  });
  input?.addEventListener('compositionend', () => {
    isComposing = false;
    scheduleTalentSearch();
  });
  input?.addEventListener('input', () => {
    if (!isComposing) scheduleTalentSearch();
  });
  input?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      clearTimeout(searchTimer);
      handleTalentSearchAction();
    }
  });
  input?.focus();
}

function scheduleTalentSearch(delay = 300) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(handleTalentSearchAction, delay);
}

async function handleTalentSearchAction() {
  const input = document.getElementById('talentSearchInput');
  const statusMsg = document.getElementById('searchStatusMsg');
  const resultGrid = document.getElementById('resultsGrid');

  if (!input || !statusMsg || !resultGrid) return;

  const query = input.value.trim();
  if (!query) {
    statusMsg.textContent = '請輸入要搜尋的用戶或隊伍。';
    statusMsg.style.display = 'block';
    resultGrid.innerHTML = '';
    return;
  }

  resultGrid.innerHTML = '';
  statusMsg.textContent = '搜尋中...';
  statusMsg.style.display = 'block';

  try {
    const [users, teams] = await Promise.all([
      activeFilter === 'teams' ? Promise.resolve([]) : searchUsers(query),
      activeFilter === 'users' ? Promise.resolve([]) : searchTeams(query)
    ]);

    const resultItems = [
      ...users.map(user => ({ type: 'user', data: user })),
      ...teams.map(team => ({ type: 'team', data: team }))
    ];

    if (!resultItems.length) {
      statusMsg.textContent = `找不到與「${query}」相關的結果。`;
      return;
    }

    statusMsg.style.display = 'none';
    resultGrid.innerHTML = resultItems.map(renderResultCard).join('');
  } catch (err) {
    statusMsg.textContent = err.message || '搜尋時發生錯誤，請稍後再試。';
  }
}

async function searchUsers(query) {
  const response = await fetch(`/api/auth/users/search?q=${encodeURIComponent(query)}`, {
    headers: activeToken ? { Authorization: activeToken } : {}
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    throw new Error(result.error || '搜尋使用者失敗');
  }

  return Array.isArray(result.users) ? result.users : [];
}

async function searchTeams(query) {
  const teams = await loadTeamsForSearch();
  const keyword = query.toLowerCase();

  return teams.filter(team => {
    const fields = [
      team.team_name,
      team.demand,
      team.team_intro,
      team.contestName,
      team.com_name,
      team.team_id
    ];
    return fields.some(value => String(value || '').toLowerCase().includes(keyword));
  }).slice(0, 20);
}

async function loadTeamsForSearch() {
  if (teamCache) return teamCache;

  const response = await fetch('/api/teams/all');
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || '搜尋隊伍失敗');
  }

  const rawTeams = Array.isArray(result.teams) ? result.teams : Array.isArray(result.data) ? result.data : [];
  teamCache = rawTeams.map(team => ({
    ...team,
    team_id: team.team_id || team.id,
    team_name: team.team_name || team.name || `隊伍 ${team.team_id || team.id}`,
    demand: team.demand || team.team_intro || '尚未填寫需求',
    current_member_count: team.current_member_count || 0,
    num_limit: team.num_limit || 0
  }));

  return teamCache;
}

function renderResultCard(item) {
  return item.type === 'team' ? renderTeamCard(item.data) : renderUserCard(item.data);
}

function renderUserCard(user) {
  const userId = user.userId || user.user_id || user.id;
  const userName = user.userName || user.name || `使用者 ${userId}`;
  const reviewCount = Number(user.reviewCount || 0);
  const averageStar = Number(user.averageStar || 0);
  const starText = reviewCount ? `${averageStar.toFixed(1)} / 5` : '尚無評價';
  const reviewUrl = buildReviewUrl(userId);

  return `
    <article class="user-result-card">
      <div class="user-result-main">
        <span class="role-badge member">用戶</span>
        <h3 class="team-title user-result-name">${Data.escapeHtml(userName)}</h3>
      </div>
      <div class="user-result-meta">
        <div class="info-row"><span class="label">用戶 ID</span><span class="val">${Data.escapeHtml(userId)}</span></div>
        <div class="info-row"><span class="label">評價</span><span class="val">${Data.escapeHtml(starText)} ｜ ${reviewCount} 則</span></div>
      </div>
      <a class="btn-manage-action review-link user-result-action" href="${reviewUrl}">查看評價</a>
    </article>
  `;
}

function renderTeamCard(team) {
  const teamId = team.team_id || team.id;
  const teamName = team.team_name || team.name || `隊伍 ${teamId}`;
  const contestName = team.contestName || team.com_name || '未指定比賽';
  const memberText = `${Number(team.current_member_count || 0)} / ${Number(team.num_limit || 0)}`;
  const teamUrl = buildTeamUrl(teamId);

  return `
    <article class="user-result-card team-result-card">
      <div class="user-result-main">
        <span class="role-badge creator">隊伍</span>
        <h3 class="team-title user-result-name">${Data.escapeHtml(teamName)}</h3>
      </div>
      <div class="info-row team-result-contest">
        <span class="label">比賽</span>
        <span class="val">${Data.escapeHtml(contestName)}</span>
      </div>
      <div class="info-row team-result-members">
        <span class="label">成員</span>
        <span class="val">${Data.escapeHtml(memberText)}</span>
      </div>
      <a class="btn-manage-action review-link user-result-action" href="${teamUrl}">查看隊伍</a>
    </article>
  `;
}

function buildReviewUrl(targetUserId) {
  const params = new URLSearchParams({ targetUserId: String(targetUserId) });
  if (activeUserId) params.set('userId', String(activeUserId));
  return `/review.html?${params.toString()}`;
}

function buildTeamUrl(teamId) {
  const params = new URLSearchParams({ teamId: String(teamId) });
  if (activeUserId) params.set('userId', String(activeUserId));
  return `/team-info.html?${params.toString()}`;
}

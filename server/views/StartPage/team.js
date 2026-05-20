(function () {
  const $ = id => document.getElementById(id);
  const teamsGrid = $('teamsGrid');
  const contestsGrid = $('contestsGrid');
  const recommendedContests = $('recommendedContests');
  const myJoinedTeams = $('myJoinedTeams');
  const myOwnedTeams = $('myOwnedTeams');
  const followed = $('followed');
  const createBtn = $('createBtn');
  const openCreate = $('openCreate');
  const modal = $('modal');
  const modalCreate = $('modalCreate');
  const modalCancel = $('modalCancel');
  const newTeamName = $('newTeamName');
  const newTeamDesc = $('newTeamDesc');

  // 本機測試用預設使用者；網址沒有 userId 時使用。
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const currentUserId = params.get('userId') && params.get('userId') !== 'unknown' ? params.get('userId') : String(ME.id);
  let currentPreferences = window.AppPreferences?.getFallbackPreferences(currentUserId) || [];
  let expandedContestCategory = localStorage.getItem('expandedContestCategory') || '';

  // 廣告輪播：每 4 秒切換一次橫幅。
  let currentAd = 0;
  setInterval(() => {
    const inner = document.querySelector('.carousel-inner');
    if (!inner) return;
    currentAd = (currentAd + 1) % 3;
    inner.style.transform = `translateX(-${currentAd * 100}%)`;
  }, 4000);

  function loadTeams() {
    const seed = [
      { id: 101, name: '機器學習實戰', desc: '徵求對影像辨識有經驗的隊友', members: 2, slots: 4, owner: 1, contestId: 10 },
      { id: 102, name: '醫療大數據分析', desc: '需要熟練 Pandas 的資料科學家', members: 1, slots: 3, owner: 2, contestId: 13 },
      { id: 103, name: 'FinTech 創新', desc: '目標是區塊鏈支付，缺前端', members: 3, slots: 5, owner: 3, contestId: 15 }
    ];
    const raw = localStorage.getItem('teams');
    if (!raw) {
      localStorage.setItem('teams', JSON.stringify(seed));
      return seed;
    }

    const defaultNames = ['AI 聯合隊', '機器人挑戰隊', '資料探勘小隊'];
    const teams = JSON.parse(raw).filter(team => !defaultNames.includes(team.name));
    if (!teams.length) teams.push(...seed);
    localStorage.setItem('teams', JSON.stringify(teams));
    return teams;
  }

  function loadContests() {
    const seed = [
      { id: 10, name: '全國資料科學競賽', date: '2026-07-20', info: '針對資料科學專題的校內外隊伍競賽', preferenceKeys: ['data', 'ai'] },
      { id: 11, name: '全國機器人盃', date: '2026-09-10', info: '機器人實作與競賽', preferenceKeys: ['robotics', 'ai'] },
      { id: 12, name: '校園創新黑客松', date: '2026-08-15', info: '48 小時產品原型、簡報與實作挑戰', preferenceKeys: ['web', 'app', 'startup', 'presentation'] },
      { id: 13, name: '智慧醫療應用競賽', date: '2026-10-02', info: '結合資料分析、AI 與醫療場景的跨域競賽', preferenceKeys: ['medical', 'ai', 'data'] },
      { id: 14, name: '永續科技提案賽', date: '2026-11-18', info: '以永續、能源與社會影響為主題的提案競賽', preferenceKeys: ['sustainability', 'startup', 'presentation'] },
      { id: 15, name: '金融科技創意賽', date: '2026-12-05', info: '金融資料、風控、支付與數位服務創新競賽', preferenceKeys: ['fintech', 'data', 'security'] },
      { id: 16, name: '區塊鏈創新應用賽', date: '2026-12-20', info: 'Web3 與智能合約應用開發', preferenceKeys: ['fintech', 'web', 'security'] },
      { id: 17, name: '智慧城市盃', date: '2027-01-10', info: '透過物聯網改善城市問題的實作賽', preferenceKeys: ['app', 'sustainability', 'data'] },
      { id: 18, name: 'AI 語音應用黑客松', date: '2027-02-15', info: '挑戰 AI 語音辨識與合成應用', preferenceKeys: ['ai', 'app'] },
      { id: 19, name: '資安防禦競賽', date: '2027-03-10', info: '實戰模擬網路攻擊與防禦', preferenceKeys: ['security'] }
    ];

    const raw = localStorage.getItem('contests');
    if (!raw) {
      localStorage.setItem('contests', JSON.stringify(seed));
      return seed;
    }

    const existing = JSON.parse(raw);
    const merged = existing.map(contest => {
      const defaults = seed.find(item => Number(item.id) === Number(contest.id));
      return defaults ? { ...defaults, ...contest, preferenceKeys: contest.preferenceKeys || defaults.preferenceKeys } : contest;
    });
    seed.forEach(contest => {
      if (!merged.some(item => Number(item.id) === Number(contest.id))) merged.push(contest);
    });
    localStorage.setItem('contests', JSON.stringify(merged));
    return merged;
  }

  function getSelectedContestId() {
    return localStorage.getItem('selectedContest') ? Number(localStorage.getItem('selectedContest')) : null;
  }

  function setSelectedContestId(id) {
    if (id == null) localStorage.removeItem('selectedContest');
    else localStorage.setItem('selectedContest', String(id));
  }

  function saveTeams(teams) {
    localStorage.setItem('teams', JSON.stringify(teams));
  }

  function withUserParam(path) {
    const userId = params.get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  function teamInfoHref(id) {
    return withUserParam(`/team-info.html?teamId=${encodeURIComponent(id)}`);
  }

  function getCreateTeamHref() {
    return withUserParam('/create-team.html');
  }

  function render() {
    const teams = loadTeams();
    const favs = loadFavorites();
    const contestFavs = loadContestFavorites();
    const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
    const selectedContest = getSelectedContestId();
    const contests = loadContests();

    window.AppNotifications?.ensureContestNotifications(contests);
    teamsGrid.innerHTML = '';

    renderRecommendations(contests);
    renderContestOverview(contests, teams, selectedContest, contestFavs);
    renderContestCategoryList(contests, selectedContest);

    teams.forEach(team => {
      if (selectedContest != null && Number(team.contestId || 0) !== Number(selectedContest)) return;
      const isFav = favs.includes(team.id);
      const card = document.createElement('div');
      const isOwner = String(team.owner) === String(currentUserId) || (String(currentUserId) === String(ME.id) && Number(team.owner) === Number(ME.id));
      const pending = reqs.filter(request => request.teamId === team.id && request.status === 'pending').length;
      const contest = contests.find(item => Number(item.id) === Number(team.contestId));
      card.className = 'team-card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="display:flex;align-items:center;gap:8px"><h4 style="margin:0">${escapeHtml(team.name)}</h4>${isOwner && pending ? `<span class="pending-count">${pending}</span>` : ''}</div>
          <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${team.id}" aria-pressed="${isFav}">${isFav ? '♥' : '♡'}</button>
        </div>
        <div class="team-meta">${escapeHtml(team.desc || '')}</div>
        ${contest ? `<div class="team-contest">比賽：<strong>${escapeHtml(contest.name)}</strong></div>` : ''}
        <div>成員 ${team.members} / ${team.slots}</div>
        <div style="margin-top:8px">
          <button class="btn" data-id="${team.id}">查看 / 加入</button>
          ${isOwner ? `<button class="btn outline manage-btn" data-team="${team.id}">管理</button>` : ''}
        </div>
      `;
      teamsGrid.appendChild(card);
    });

    cleanupLegacyMyTeams(teams);
    renderSidebarTeams(teams);
    renderContestInfo(contests, selectedContest);
    renderFollowedContests(contests, contestFavs);
  }

  function renderSidebarTeams(teams) {
    const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`) || '[]');
    const joined = joinedIds.map(id => teams.find(team => Number(team.id) === Number(id))).filter(Boolean);
    myJoinedTeams.innerHTML = joined.length ? `<ul class="managed-list">${joined.map(team => `<li><span>${escapeHtml(team.name)}</span></li>`).join('')}</ul>` : '尚未加入隊伍';

    const favs = loadFavorites();
    const favEls = favs.map(id => {
      const team = teams.find(item => item.id === id);
      return team ? `<li><strong>${escapeHtml(team.name)}</strong></li>` : null;
    }).filter(Boolean);
    document.getElementById('myFavs').innerHTML = favEls.length ? `<ul class="fav-list">${favEls.join('')}</ul>` : '尚無收藏';

    const owned = teams.filter(team => String(team.owner) === String(currentUserId) || (String(currentUserId) === String(ME.id) && Number(team.owner) === Number(ME.id)));
    if (!owned.length) {
      myOwnedTeams.textContent = '尚未建立隊伍';
      return;
    }

    const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
    myOwnedTeams.innerHTML = `<ul class="managed-list">${owned.map(team => {
      const pending = reqs.filter(request => request.teamId === team.id && request.status === 'pending').length;
      return `<li><span>${escapeHtml(team.name)}</span><span class="pending-count">${pending}</span> <button class="btn outline manage-btn" data-team="${team.id}">管理</button></li>`;
    }).join('')}</ul>`;
  }

  function renderContestInfo(contests, selectedContest) {
    const contestInfoWrapId = 'contestInfoWrap';
    let contestInfoWrap = document.getElementById(contestInfoWrapId);
    if (!contestInfoWrap) {
      contestInfoWrap = document.createElement('div');
      contestInfoWrap.id = contestInfoWrapId;
      contestInfoWrap.className = 'contest-info';
      document.querySelector('.content').insertBefore(contestInfoWrap, document.getElementById('teamsGrid'));
    }

    const selected = contests.find(item => Number(item.id) === Number(selectedContest));
    contestInfoWrap.innerHTML = selected
      ? `<h3>${escapeHtml(selected.name)}</h3><div>${escapeHtml(selected.date)}</div><p>${escapeHtml(selected.info)}</p>`
      : '<h3>全部隊伍</h3><div>顯示所有跨比賽隊伍</div>';
  }

  // 左側比賽欄：先顯示類別標籤，使用者點類別後才展開該類別的比賽。
  function renderContestCategoryList(contests, selectedContest) {
    const list = document.getElementById('contestsList');
    if (!list || !window.AppPreferences) return;

    const categories = window.AppPreferences.DEFAULT_TAGS
      .map(tag => ({
        ...tag,
        contests: contests.filter(contest => window.AppPreferences.inferContestTags(contest).includes(tag.key))
      }))
      .filter(category => category.contests.length);

    if (!expandedContestCategory && categories.length) expandedContestCategory = categories[0].key;
    list.innerHTML = categories.map(category => {
      const isOpen = category.key === expandedContestCategory;
      return `
        <li class="contest-category ${isOpen ? 'open' : ''}">
          <button class="contest-category-toggle" type="button" data-contest-category="${category.key}" aria-expanded="${isOpen}">
            <span>${escapeHtml(category.label)}</span>
            <span class="contest-category-count">${category.contests.length} 個</span>
          </button>
          <div class="contest-category-panel">
            ${category.contests.map(contest => `
              <button class="contest-child ${Number(selectedContest) === Number(contest.id) ? 'active' : ''}" type="button" data-cid="${contest.id}">
                <strong>${escapeHtml(contest.name)}</strong>
                <span>${escapeHtml(contest.date || '日期未定')}</span>
              </button>
            `).join('')}
          </div>
        </li>
      `;
    }).join('');
  }

  // 推薦區：依照使用者偏好標籤計算比賽匹配程度。
  function renderRecommendations(contests) {
    if (!recommendedContests || !window.AppPreferences) return;

    if (!currentPreferences.length) {
      recommendedContests.innerHTML = `
        <div class="recommend-empty">
          <strong>想看到更適合你的比賽嗎？</strong>
          <p>到帳號資訊設定個人化標籤後，這裡會依照你的興趣推薦比賽。</p>
          <a class="btn outline" href="${withUserParam('/account-info.html')}">設定偏好</a>
        </div>
      `;
      return;
    }

    const scored = contests
      .map(contest => ({ contest, ...window.AppPreferences.scoreContest(contest, currentPreferences) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    recommendedContests.innerHTML = scored.length ? `
      <div class="recommend-panel">
        <div class="recommend-head">
          <div>
            <h3>為你推薦的比賽</h3>
            <p>根據你的標籤：${currentPreferences.map(key => escapeHtml(window.AppPreferences.labelFor(key))).join('、')}</p>
          </div>
          <a class="btn outline" href="${withUserParam('/account-info.html')}">修改偏好</a>
        </div>
        <div class="recommend-list">
          ${scored.map(item => `
            <article class="recommend-card" data-cid="${item.contest.id}">
              <h4>${escapeHtml(item.contest.name)}</h4>
              <div class="recommend-reason">符合 ${item.score} 個偏好：${item.matches.map(key => escapeHtml(window.AppPreferences.labelFor(key))).join('、')}</div>
              <div class="tag-row">${item.matches.map(key => `<span class="match-tag">${escapeHtml(window.AppPreferences.labelFor(key))}</span>`).join('')}</div>
            </article>
          `).join('')}
        </div>
      </div>
    ` : '';
  }

  function renderContestOverview(contests, teams, selectedContest, contestFavs = loadContestFavorites()) {
    if (!contestsGrid) return;
    const displayContests = contests.slice(0, 7);
    contestsGrid.innerHTML = `${displayContests.map(contest => {
      const contestTeams = teams.filter(team => Number(team.contestId) === Number(contest.id));
      const isContestFav = contestFavs.includes(Number(contest.id));
      const contestTags = window.AppPreferences ? window.AppPreferences.inferContestTags(contest).slice(0, 3) : [];
      return `
        <article class="contest-card ${Number(selectedContest) === Number(contest.id) ? 'active' : ''}" data-cid="${contest.id}">
          <button class="contest-fav-btn ${isContestFav ? 'active' : ''}" data-contest-fav="${contest.id}" type="button" aria-pressed="${isContestFav}">${isContestFav ? '♥' : '♡'}</button>
          <h3>${escapeHtml(contest.name)}</h3>
          <div class="contest-date">${escapeHtml(contest.date || '日期未定')}</div>
          <p>${escapeHtml(contest.info || '尚未填寫比賽資訊')}</p>
          <div class="tag-row">${contestTags.map(key => `<span class="match-tag">${escapeHtml(window.AppPreferences.labelFor(key))}</span>`).join('')}</div>
          <div class="contest-stats"><span>${contestTeams.length} 隊</span></div>
        </article>
      `;
    }).join('')}
      <article class="contest-card and-more">
        <h3>And More...</h3>
      </article>
    `;
  }

  function cleanupLegacyMyTeams(teams) {
    const raw = JSON.parse(localStorage.getItem('myTeams') || '[]');
    if (!raw.length) return;
    const validIds = raw.map(item => item.id ?? item).filter(id => teams.some(team => Number(team.id) === Number(id)));
    localStorage.setItem(`myTeams:${currentUserId}`, JSON.stringify(validIds));
    localStorage.removeItem('myTeams');
  }

  function loadContestFavorites() {
    return JSON.parse(localStorage.getItem('favoriteContests') || '[]').map(Number);
  }

  function saveContestFavorites(favs) {
    localStorage.setItem('favoriteContests', JSON.stringify(favs));
  }

  function toggleContestFavorite(id) {
    const favs = loadContestFavorites();
    const index = favs.indexOf(Number(id));
    if (index >= 0) favs.splice(index, 1);
    else favs.push(Number(id));
    saveContestFavorites(favs);
    render();
  }

  function renderFollowedContests(contests, contestFavs) {
    const followedContests = contestFavs.map(id => contests.find(contest => Number(contest.id) === Number(id))).filter(Boolean);
    followed.textContent = followedContests.length ? followedContests.map(contest => `${contest.name}\n${contest.date}`).join('\n\n') : '尚無關注';
  }

  teamsGrid.addEventListener('click', event => {
    const btn = event.target.closest('button');
    if (!btn) return;
    const teamId = btn.dataset.id || btn.dataset.team;
    if (!teamId) return;
    if (btn.classList.contains('fav-btn')) { toggleFavorite(Number(teamId)); return; }
    if (btn.classList.contains('manage-btn')) { openRequestsForTeam(Number(teamId)); return; }
    openTeamDetail(Number(teamId));
  });

  myOwnedTeams.addEventListener('click', event => {
    const btn = event.target.closest('.manage-btn');
    if (btn) openRequestsForTeam(Number(btn.dataset.team));
  });

  function loadFavorites() {
    return JSON.parse(localStorage.getItem('favorites') || '[]');
  }

  function saveFavorites(favorites) {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }

  function toggleFavorite(id) {
    const favorites = loadFavorites();
    const index = favorites.indexOf(id);
    if (index >= 0) favorites.splice(index, 1);
    else favorites.push(id);
    saveFavorites(favorites);
    render();
  }

  function openTeamDetail(id) {
    location.href = teamInfoHref(id);
  }

  const requestsModal = document.getElementById('requestsModal');
  const requestsList = document.getElementById('requestsList');
  const closeReq = document.getElementById('closeReq');

  function openRequestsForTeam(teamId) {
    const teams = loadTeams();
    const team = teams.find(item => item.id === teamId);
    if (!team) return alert('找不到隊伍');
    const isOwner = String(team.owner) === String(currentUserId) || (String(currentUserId) === String(ME.id) && Number(team.owner) === Number(ME.id));
    if (!isOwner) return alert('只有隊長可以管理本隊的加入請求');
    const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]').filter(request => request.teamId === teamId && request.status === 'pending');
    if (!reqs.length) { alert('目前沒有待審核申請'); return; }
    requestsList.innerHTML = renderRequests(reqs, team);
    requestsModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function renderRequests(reqs) {
    return reqs.map(request => {
      const app = request.application || {};
      const resume = app.resume;
      return `<div class="req-item" data-req="${request.id}">
        <div><strong>${escapeHtml(app.applicantName || request.user.name)}</strong> 申請加入 <em>${escapeHtml(request.teamName)}</em></div>
        <div class="req-detail">
          <div>聯絡方式：${escapeHtml(app.applicantContact || '未填寫')}</div>
          <div>申請理由：${escapeHtml(app.applicantReason || '未填寫')}</div>
          ${resume ? `<div class="attached-resume"><strong>附上履歷：${escapeHtml(resume.name || resume.data?.name || '履歷')}</strong><br>
            學校：${escapeHtml(resume.data?.school || '未填寫')}　年級：${escapeHtml(resume.data?.grade || '未填寫')}<br>
            專長：${escapeHtml((resume.data?.tags || []).join('、') || '未填寫')}<br>
            經歷：${escapeHtml(resume.data?.experience || '未填寫')}<br>
            自我介紹：${escapeHtml(resume.data?.intro || '未填寫')}
          </div>` : ''}
        </div>
        <div class="req-actions">
          <button class="btn" data-act="approve" data-id="${request.id}">批准</button>
          <button class="btn outline" data-act="deny" data-id="${request.id}">拒絕</button>
        </div>
      </div>`;
    }).join('');
  }

  requestsList && requestsList.addEventListener('click', event => {
    const btn = event.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    const id = Number(btn.dataset.id);
    const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
    const idx = reqs.findIndex(request => request.id === id);
    if (idx < 0) return;

    if (act === 'approve') {
      const teams = loadTeams();
      const teamIndex = teams.findIndex(team => team.id === reqs[idx].teamId);
      if (teamIndex < 0) return alert('隊伍不存在，無法批准');
      if ((teams[teamIndex].members || 0) >= (teams[teamIndex].slots || 0)) {
        reqs[idx].status = 'denied';
        localStorage.setItem('joinRequests', JSON.stringify(reqs));
        alert('隊伍已額滿，無法批准本申請（已自動拒絕）。');
      } else {
        reqs[idx].status = 'approved';
        teams[teamIndex].members = (teams[teamIndex].members || 0) + 1;
        saveTeams(teams);
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
    if (pending.length) requestsList.innerHTML = renderRequests(pending);
    else {
      requestsModal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    }
  });

  closeReq && closeReq.addEventListener('click', () => {
    requestsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  });
  window.AppReview = { openTeamRequests: openRequestsForTeam };

  function openCreateTeamPage() {
    location.href = getCreateTeamHref();
  }

  function hideModal() {
    modal.classList.add('hidden');
    newTeamName.value = '';
    newTeamDesc.value = '';
  }

  function closeModal() {
    document.body.classList.remove('modal-open');
    hideModal();
  }

  createBtn.addEventListener('click', openCreateTeamPage);
  if (openCreate) openCreate.addEventListener('click', openCreateTeamPage);
  modalCancel.addEventListener('click', closeModal);

  modalCreate.addEventListener('click', () => {
    const name = newTeamName.value.trim();
    if (!name) return alert('請輸入隊名');
    const desc = newTeamDesc.value.trim();
    const teams = loadTeams();
    const id = Date.now();
    const selectedContest = getSelectedContestId();
    teams.unshift({ id, name, desc, members: 1, slots: 4, owner: ME.id, contestId: selectedContest || undefined });
    saveTeams(teams);
    closeModal();
    render();
  });

  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  const homeLink = document.getElementById('homeLink');
  if (homeLink) homeLink.href = withUserParam('/team.html');

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
    setSelectedContestId(cid);
    location.href = withUserParam(`/contest.html?id=${encodeURIComponent(cid)}`);
  });

  contestsGrid && contestsGrid.addEventListener('click', event => {
    const favBtn = event.target.closest('[data-contest-fav]');
    if (favBtn) {
      event.stopPropagation();
      toggleContestFavorite(Number(favBtn.dataset.contestFav));
      return;
    }

    if (event.target.closest('.and-more')) {
      location.href = withUserParam('/contests.html');
      return;
    }

    const card = event.target.closest('[data-cid]');
    if (!card) return;
    const cid = Number(card.dataset.cid);
    setSelectedContestId(cid);
    location.href = withUserParam(`/contest.html?id=${encodeURIComponent(cid)}`);
  });

  recommendedContests && recommendedContests.addEventListener('click', event => {
    const card = event.target.closest('[data-cid]');
    if (!card) return;
    const cid = Number(card.dataset.cid);
    setSelectedContestId(cid);
    location.href = withUserParam(`/contest.html?id=${encodeURIComponent(cid)}`);
  });

  document.querySelectorAll('[data-my-team-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.myTeamTab;
      document.querySelectorAll('[data-my-team-tab]').forEach(item => item.classList.toggle('active', item === button));
      myJoinedTeams.hidden = tab !== 'joined';
      myOwnedTeams.hidden = tab !== 'owned';
    });
  });

  function escapeHtml(value) {
    if (!value) return '';
    return String(value).replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match]));
  }

  window.openTeamDetail = openTeamDetail;
  render();
  window.AppPreferences?.loadUserPreferences(currentUserId).then(preferences => {
    currentPreferences = preferences;
    render();
  });

  const manageTeamId = params.get('manageTeamId');
  if (manageTeamId) setTimeout(() => openRequestsForTeam(Number(manageTeamId)), 0);

  // 全域搜尋：保留上方搜尋列功能。
  const globalSearch = $('globalSearch');
  const globalSearchOverlay = $('globalSearchOverlay');
  const btnExitSearch = $('btnExitSearch');
  const globalSearchResults = $('globalSearchResults');
  const searchTabs = document.querySelectorAll('.s-tab');
  let currentGlobalTab = 'team';
  const mockUsers = ['張同學', '李學長 (後端)', '王大神', '陳學妹', '林教授'];

  if (globalSearch && globalSearchOverlay) {
    globalSearch.addEventListener('focus', () => {
      globalSearchOverlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      runGlobalSearch();
    });
    globalSearch.addEventListener('input', runGlobalSearch);
  }

  if (btnExitSearch) btnExitSearch.addEventListener('click', closeGlobalSearch);

  function closeGlobalSearch() {
    globalSearchOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    globalSearch.value = '';
  }

  searchTabs.forEach(tab => {
    tab.addEventListener('click', event => {
      searchTabs.forEach(item => item.classList.remove('active'));
      event.currentTarget.classList.add('active');
      currentGlobalTab = event.currentTarget.dataset.tab;
      runGlobalSearch();
    });
  });

  function runGlobalSearch() {
    const q = globalSearch.value.trim().toLowerCase();
    if (!q) {
      globalSearchResults.innerHTML = '<div style="padding:30px;text-align:center;color:#8a735e;">請輸入關鍵字開始搜尋...</div>';
      return;
    }

    const teams = loadTeams();
    const contests = loadContests();
    let html = '';

    if (currentGlobalTab === 'comp') {
      const results = contests.filter(contest => contest.name.toLowerCase().includes(q) || (contest.info && contest.info.toLowerCase().includes(q)));
      html = results.map(contest => `
        <div class="search-list-item" onclick="document.querySelector('#contestsList [data-cid=\\'${contest.id}\\']')?.click(); closeGlobalSearch();">
          <strong style="color:#4f3827;">競賽：${escapeHtml(contest.name)}</strong>
          <span style="font-size:12px;color:#8a735e;margin-left:8px;">(${escapeHtml(contest.date)})</span>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">${escapeHtml(contest.info)}</p>
        </div>
      `).join('');
    } else if (currentGlobalTab === 'team') {
      const results = teams.filter(team => team.name.toLowerCase().includes(q) || (team.desc && team.desc.toLowerCase().includes(q)));
      html = results.map(team => `
        <div class="search-list-item" onclick="closeGlobalSearch(); openTeamDetail(${team.id});">
          <strong style="color:#4f3827;">隊伍：${escapeHtml(team.name)}</strong>
          <span style="font-size:12px;color:#8a735e;margin-left:8px;">(缺額: ${team.slots - team.members})</span>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">${escapeHtml(team.desc)}</p>
        </div>
      `).join('');
    } else if (currentGlobalTab === 'user') {
      const results = mockUsers.filter(user => user.toLowerCase().includes(q));
      html = results.map(user => `
        <div class="search-list-item">
          <strong style="color:#4f3827;">用戶：${escapeHtml(user)}</strong>
        </div>
      `).join('');
    }

    globalSearchResults.innerHTML = html || '<div style="padding:20px;text-align:center;color:#8a735e;">沒有找到符合的結果</div>';
  }

  window.closeGlobalSearch = closeGlobalSearch;
})();

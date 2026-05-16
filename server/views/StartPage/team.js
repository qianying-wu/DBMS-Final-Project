(function () {
  const $ = id => document.getElementById(id);
  const teamsGrid = $('teamsGrid');
  const contestsGrid = $('contestsGrid');
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
  const teamSearch = $('teamSearch');
  
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const currentUserId = params.get('userId') && params.get('userId') !== 'unknown' ? params.get('userId') : String(ME.id);

  // 廣告輪播邏輯
  let currentAd = 0;
  setInterval(() => {
    const inner = document.querySelector('.carousel-inner');
    if (!inner) return;
    currentAd = (currentAd + 1) % 3;
    inner.style.transform = `translateX(-${currentAd * 100}%)`;
  }, 4000);

  function loadTeams() {
    const raw = localStorage.getItem('teams');
    if (raw) {
      const defaultNames = ['AI 聯合隊', '機器人挑戰隊', '資料探勘小隊'];
      const teams = JSON.parse(raw).filter(team => !defaultNames.includes(team.name));
      if (teams.length === 0) {
        const fakeTeams = [
          { id: 101, name: "機器學習實戰", desc: "徵求對影像辨識有經驗的隊友", members: 2, slots: 4, owner: 1, contestId: 10 },
          { id: 102, name: "醫療大數據分析", desc: "需要熟練 Pandas 的資料科學家", members: 1, slots: 3, owner: 2, contestId: 13 },
          { id: 103, name: "FinTech 創新", desc: "目標是區塊鏈支付，缺前端", members: 3, slots: 5, owner: 3, contestId: 15 }
        ];
        fakeTeams.forEach(t => teams.push(t));
      }
      localStorage.setItem('teams', JSON.stringify(teams));
      return teams;
    }
    const seed = [
      { id: 101, name: "機器學習實戰", desc: "徵求對影像辨識有經驗的隊友", members: 2, slots: 4, owner: 1, contestId: 10 },
      { id: 102, name: "醫療大數據分析", desc: "需要熟練 Pandas 的資料科學家", members: 1, slots: 3, owner: 2, contestId: 13 },
      { id: 103, name: "FinTech 創新", desc: "目標是區塊鏈支付，缺前端", members: 3, slots: 5, owner: 3, contestId: 15 }
    ];
    localStorage.setItem('teams', JSON.stringify(seed));
    return seed;
  }
  
  function loadContests() {
    const raw = localStorage.getItem('contests');
    const seed = [
      { id: 10, name: '全國資料科學競賽', date: '2026-07-20', info: '針對資料科學專題的校內外隊伍競賽' },
      { id: 12, name: '校園創新黑客松', date: '2026-08-15', info: '48 小時產品原型、簡報與實作挑戰' },
      { id: 13, name: '智慧醫療應用競賽', date: '2026-10-02', info: '結合資料分析、AI 與醫療場景的跨域競賽' },
      { id: 14, name: '永續科技提案賽', date: '2026-11-18', info: '以永續、能源與社會影響為主題的提案競賽' },
      { id: 15, name: '金融科技創意賽', date: '2026-12-05', info: '金融資料、風控、支付與數位服務創新競賽' },
      { id: 16, name: '區塊鏈創新應用賽', date: '2026-12-20', info: 'Web3 與智能合約應用開發' },
      { id: 17, name: '智慧城市盃', date: '2027-01-10', info: '透過物聯網改善城市問題的實作賽' },
      { id: 18, name: 'AI 語音應用黑客松', date: '2027-02-15', info: '挑戰 AI 語音辨識與合成應用' },
      { id: 19, name: '資安防禦競賽', date: '2027-03-10', info: '實戰模擬網路攻擊與防禦' }
    ];
    if (raw) {
      let existing = JSON.parse(raw);
      let filteredExisting = existing.filter(item => Number(item.id) !== 11 && item.name !== '全國機器人盃');
      seed.forEach(contest => {
        if (!filteredExisting.some(item => Number(item.id) === Number(contest.id))) filteredExisting.push(contest);
      });
      localStorage.setItem('contests', JSON.stringify(filteredExisting));
      return filteredExisting;
    }
    localStorage.setItem('contests', JSON.stringify(seed));
    return seed;
  }

  function getSelectedContestId() { return localStorage.getItem('selectedContest') ? Number(localStorage.getItem('selectedContest')) : null; }
  function setSelectedContestId(id) { if (id == null) localStorage.removeItem('selectedContest'); else localStorage.setItem('selectedContest', String(id)); }
  function saveTeams(t) { localStorage.setItem('teams', JSON.stringify(t)); }

  function withUserParam(path) {
    const userId = params.get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  function teamInfoHref(id) {
    return withUserParam(`/team-info.html?teamId=${encodeURIComponent(id)}`);
  }

  function getCreateTeamHref() {
    const selectedContest = getSelectedContestId();
    const contestParam = selectedContest == null ? '' : `?contestId=${encodeURIComponent(selectedContest)}`;
    return withUserParam(`/create-team.html${contestParam}`);
  }

  function render() {
    const teams = loadTeams();
    const favs = loadFavorites();
    const contestFavs = loadContestFavorites();
    const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
    if (window.AppNotifications) window.AppNotifications.ensureContestNotifications(loadContests());
    teamsGrid.innerHTML = '';
    const selectedContest = getSelectedContestId();
    const contests = loadContests();
    renderContestOverview(contests, teams, selectedContest, contestFavs);
    
    teams.forEach(t => {
      if (selectedContest != null && Number(t.contestId || 0) !== Number(selectedContest)) return;
      const isFav = favs.includes(t.id);
      const card = document.createElement('div'); card.className = 'team-card';
      const isOwner = String(t.owner) === String(currentUserId) || (String(currentUserId) === String(ME.id) && Number(t.owner) === Number(ME.id));
      const pending = reqs.filter(r => r.teamId === t.id && r.status === 'pending').length;
      const contest = contests.find(c => c.id && Number(c.id) === Number(t.contestId));
      const contestName = contest ? contest.name : '';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="display:flex;align-items:center;gap:8px"><h4 style="margin:0">${escapeHtml(t.name)}</h4>${isOwner && pending ? `<span class="pending-count">${pending}</span>` : ''}</div>
          <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${t.id}" aria-pressed="${isFav}">${isFav ? '♥' : '♡'}</button>
        </div>
        <div class="team-meta">${escapeHtml(t.desc || '')}</div>
        ${contestName ? `<div class="team-contest">比賽：<strong>${escapeHtml(contestName)}</strong></div>` : ''}
        <div>成員 ${t.members} / ${t.slots}</div>
        <div style="margin-top:8px">
          <button class="btn" data-id="${t.id}">查看 / 加入</button>
          ${isOwner ? `<button class="btn outline manage-btn" data-team="${t.id}">管理</button>` : ''}
        </div>
      `;
      teamsGrid.appendChild(card);
    });

    cleanupLegacyMyTeams(teams);
    const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`) || '[]');
    const joined = joinedIds.map(id => teams.find(team => Number(team.id) === Number(id))).filter(Boolean);
    myJoinedTeams.innerHTML = joined.length ? `<ul class="managed-list">${joined.map(team => `<li><span>${escapeHtml(team.name)}</span></li>`).join('')}</ul>` : '尚未加入隊伍';

    const favEls = favs.map(id => {
      const t = teams.find(x => x.id === id); if (!t) return null;
      return `<li><strong>${escapeHtml(t.name)}</strong></li>`;
    }).filter(Boolean);
    document.getElementById('myFavs').innerHTML = favEls.length ? `<ul class="fav-list">${favEls.join('')}</ul>` : '尚無收藏';

    const managed = teams.filter(t => String(t.owner) === String(currentUserId) || (String(currentUserId) === String(ME.id) && Number(t.owner) === Number(ME.id)));
    if (managed.length) {
      const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
      const items = managed.map(t => {
        const pending = reqs.filter(r => r.teamId === t.id && r.status === 'pending').length;
        return `<li><span>${t.name}</span><span class="pending-count">${pending}</span> <button class="btn outline manage-btn" data-team="${t.id}">管理</button></li>`;
      });
      myOwnedTeams.innerHTML = `<ul class="managed-list">${items.join('')}</ul>`;
    } else {
      myOwnedTeams.textContent = '尚未建立隊伍';
    }

    const contestsListEl = document.getElementById('contestsList');
    if(contestsListEl) {
       contestsListEl.innerHTML = contests.map(c => `<li data-cid="${c.id}" class="contest-item" style="${selectedContest === c.id ? 'background:#f6efe6' : ''}"><strong>${escapeHtml(c.name)}</strong><div style="font-size:12px;color:#666">${escapeHtml(c.date)}</div></li>`).join('');
    }

    const contestInfoWrapId = 'contestInfoWrap';
    let contestInfoWrap = document.getElementById(contestInfoWrapId);
    if (!contestInfoWrap) { 
      contestInfoWrap = document.createElement('div'); 
      contestInfoWrap.id = contestInfoWrapId; 
      contestInfoWrap.className = 'contest-info'; 
      document.querySelector('.content').insertBefore(contestInfoWrap, document.getElementById('teamsGrid'));
    }
    const selected = contests.find(x => x.id === selectedContest);
    if (selected) contestInfoWrap.innerHTML = `<h3>${escapeHtml(selected.name)}</h3><div>${escapeHtml(selected.date)}</div><p>${escapeHtml(selected.info)}</p>`; 
    else contestInfoWrap.innerHTML = `<h3>全部隊伍</h3><div>顯示所有跨比賽隊伍</div>`;

    renderFollowedContests(contests, contestFavs);
  }

  // 移除行內 onclick，改用下方 event listener 統一代理
  function renderContestOverview(contests, teams, selectedContest, contestFavs = loadContestFavorites()) {
    if (!contestsGrid) return;
    const displayContests = contests.slice(0, 7);
    let html = displayContests.map(contest => {
      const contestTeams = teams.filter(team => Number(team.contestId) === Number(contest.id));
      const isContestFav = contestFavs.includes(Number(contest.id));
      return `
        <article class="contest-card ${Number(selectedContest) === Number(contest.id) ? 'active' : ''}" data-cid="${contest.id}">
          <button class="contest-fav-btn ${isContestFav ? 'active' : ''}" data-contest-fav="${contest.id}" type="button" aria-pressed="${isContestFav}">${isContestFav ? '♥' : '♡'}</button>
          <h3>${escapeHtml(contest.name)}</h3>
          <div class="contest-date">${escapeHtml(contest.date || '日期未定')}</div>
          <p style="flex:1;">${escapeHtml(contest.info || '尚未填寫比賽資訊')}</p>
          <div class="contest-stats">
            <span>${contestTeams.length} 隊</span>
          </div>
        </article>
      `;
    }).join('');

    html += `
      <article class="contest-card and-more">
        <h3>And More...</h3>
      </article>
    `;
    contestsGrid.innerHTML = html;
  }

  function cleanupLegacyMyTeams(teams) {
    const raw = JSON.parse(localStorage.getItem('myTeams') || '[]');
    if (!raw.length) return;
    const validIds = raw.map(item => item.id ?? item).filter(id => teams.some(team => Number(team.id) === Number(id)));
    localStorage.setItem(`myTeams:${currentUserId}`, JSON.stringify(validIds));
    localStorage.removeItem('myTeams');
  }

  function loadContestFavorites() { return JSON.parse(localStorage.getItem('favoriteContests') || '[]').map(Number); }
  function saveContestFavorites(favs) { localStorage.setItem('favoriteContests', JSON.stringify(favs)); }
  function toggleContestFavorite(id) {
    const favs = loadContestFavorites();
    const index = favs.indexOf(Number(id));
    if (index >= 0) favs.splice(index, 1); else favs.push(Number(id));
    saveContestFavorites(favs);
    render();
  }

  function renderFollowedContests(contests, contestFavs) {
    const followedContests = contestFavs.map(id => contests.find(contest => Number(contest.id) === Number(id))).filter(Boolean);
    followed.textContent = followedContests.length ? followedContests.map(contest => `${contest.name}\n${contest.date}`).join('\n\n') : '尚無關注';
  }

  teamsGrid.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const teamId = btn.dataset.id || btn.dataset.team; if (!teamId) return;
    if (btn.classList.contains('fav-btn')) { toggleFavorite(Number(teamId)); return; }
    if (btn.classList.contains('manage-btn')) { openRequestsForTeam(Number(teamId)); return; }
    openTeamDetail(Number(teamId));
  });

  myOwnedTeams.addEventListener('click', e => {
    const btn = e.target.closest('.manage-btn');
    if (!btn) return;
    openRequestsForTeam(Number(btn.dataset.team));
  });

  function loadFavorites() { return JSON.parse(localStorage.getItem('favorites') || '[]'); }
  function saveFavorites(f) { localStorage.setItem('favorites', JSON.stringify(f)); }
  function toggleFavorite(id) { const f = loadFavorites(); const idx = f.indexOf(id); if (idx >= 0) f.splice(idx, 1); else f.push(id); saveFavorites(f); render(); }

  function openTeamDetail(id) {
    location.href = teamInfoHref(id);
  }

  const requestsModal = document.getElementById('requestsModal');
  const requestsList = document.getElementById('requestsList');
  const closeReq = document.getElementById('closeReq');
  function openRequestsForTeam(teamId) {
    const teams = loadTeams(); const team = teams.find(t => t.id === teamId);
    if (!team) return alert('找不到隊伍');
    const isOwner = String(team.owner) === String(currentUserId) || (String(currentUserId) === String(ME.id) && Number(team.owner) === Number(ME.id));
    if (!isOwner) return alert('只有隊長可以管理本隊的加入請求');
    const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]').filter(r => r.teamId === teamId && r.status === 'pending');
    if (!reqs.length) { alert('目前沒有待審核申請'); return; }
    requestsList.innerHTML = renderRequests(reqs, team);
    requestsModal.classList.remove('hidden'); document.body.classList.add('modal-open');
  }

  function renderRequests(reqs, team = null) {
    return reqs.map(r => {
      const app = r.application || {};
      const answers = Array.isArray(app.answers) ? app.answers : [];
      const teamQuestions = team?.applicationQuestions || [];
      const resume = app.resume;
      return `<div class="req-item" data-req="${r.id}">
        <div><strong>${escapeHtml(app.applicantName || r.user.name)}</strong> 申請加入 <em>${escapeHtml(r.teamName)}</em></div>
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
        <div class="req-actions"><button class="btn" data-act="approve" data-id="${r.id}">批准</button><button class="btn outline" data-act="deny" data-id="${r.id}">拒絕</button></div>
      </div>`;
    }).join('');
  }

  requestsList && requestsList.addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return; const act = btn.dataset.act; const id = Number(btn.dataset.id);
    const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]'); const idx = reqs.findIndex(r => r.id === id); if (idx < 0) return;
    if (act === 'approve') {
      const teams = loadTeams(); const tIdx = teams.findIndex(x => x.id === reqs[idx].teamId);
      if (tIdx < 0) { alert('隊伍不存在，無法批准'); return; }
      if ((teams[tIdx].members || 0) >= (teams[tIdx].slots || 0)) {
        reqs[idx].status = 'denied';
        localStorage.setItem('joinRequests', JSON.stringify(reqs));
        alert('隊伍已額滿，無法批准本申請（已自動拒絕）。');
      } else {
        reqs[idx].status = 'approved';
        teams[tIdx].members = (teams[tIdx].members || 0) + 1; saveTeams(teams);
        const my = JSON.parse(localStorage.getItem(`myTeams:${reqs[idx].user.id}`) || '[]'); if (!my.some(id => Number(id) === Number(reqs[idx].teamId))) { my.push(reqs[idx].teamId); localStorage.setItem(`myTeams:${reqs[idx].user.id}`, JSON.stringify(my)); }
        localStorage.setItem('joinRequests', JSON.stringify(reqs));
        alert('已批准');
        render();
      }
    } else {
      reqs[idx].status = 'denied'; localStorage.setItem('joinRequests', JSON.stringify(reqs));
      alert('已拒絕');
    }
    const pending = JSON.parse(localStorage.getItem('joinRequests') || '[]').filter(r => r.teamId === reqs[idx].teamId && r.status === 'pending');
    if (pending.length) {
      const teams = loadTeams();
      const team = teams.find(t => Number(t.id) === Number(reqs[idx].teamId));
      requestsList.innerHTML = renderRequests(pending, team);
    } else { requestsModal.classList.add('hidden'); document.body.classList.remove('modal-open'); }
  });

  closeReq && closeReq.addEventListener('click', () => { requestsModal.classList.add('hidden'); document.body.classList.remove('modal-open'); });
  window.AppReview = { openTeamRequests: openRequestsForTeam };

  function openCreateTeamPage() { location.href = getCreateTeamHref(); }
  function hideModal() { modal.classList.add('hidden'); newTeamName.value = ''; newTeamDesc.value = ''; }
  function closeModal() { document.body.classList.remove('modal-open'); hideModal(); }
  
  createBtn.addEventListener('click', openCreateTeamPage);
  if(openCreate) openCreate.addEventListener('click', openCreateTeamPage);
  modalCancel.addEventListener('click', closeModal);

  modalCreate.addEventListener('click', () => {
    const name = newTeamName.value.trim(); if (!name) return alert('請輸入隊名');
    const desc = newTeamDesc.value.trim();
    const teams = loadTeams(); const id = Date.now();
    const selContest = getSelectedContestId();
    teams.unshift({ id, name, desc, members: 1, slots: 4, owner: ME.id, contestId: selContest || undefined }); saveTeams(teams);
    closeModal(); render();
  });

  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!modal.classList.contains('hidden')) closeModal(); } });

  if(teamSearch) {
    teamSearch.addEventListener('input', () => {
      const q = teamSearch.value.trim().toLowerCase();
      const teams = loadTeams();
      const filtered = teams.filter(t => t.name.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q));
      teamsGrid.innerHTML = '';
      filtered.forEach(t => {
        const card = document.createElement('div'); card.className = 'team-card';
        card.innerHTML = `<h4>${t.name}</h4><div class="team-meta">${t.desc}</div><div>成員 ${t.members} / ${t.slots}</div><div style="margin-top:8px"><button class="btn" data-id="${t.id}">查看 / 加入</button></div>`;
        teamsGrid.appendChild(card);
      });
    });
  }

  const notifyBtn = document.getElementById('notifyBtn');
  const homeLink = document.getElementById('homeLink');
  if (homeLink) homeLink.href = withUserParam('/team.html');

  document.addEventListener('click', (e) => {
    const li = e.target.closest('#contestsList li'); if (!li) return;
    const cid = Number(li.dataset.cid);
    setSelectedContestId(cid);
    location.href = withUserParam(`/contest.html?id=${encodeURIComponent(cid)}`);
  });

  contestsGrid && contestsGrid.addEventListener('click', e => {
    const favBtn = e.target.closest('[data-contest-fav]');
    if (favBtn) {
      e.stopPropagation();
      toggleContestFavorite(Number(favBtn.dataset.contestFav));
      return;
    }

    // 修正點擊問題：改用事件代理處理 And More 的點擊跳轉，確保閉包內的 withUserParam 可被正確讀取
    const andMoreCard = e.target.closest('.and-more');
    if (andMoreCard) {
      location.href = withUserParam('/contests.html');
      return;
    }

    const card = e.target.closest('[data-cid]');
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

  window.openTeamDetail = openTeamDetail;

  render();
  const manageTeamId = params.get('manageTeamId');
  if (manageTeamId) setTimeout(() => openRequestsForTeam(Number(manageTeamId)), 0);

  // 全域搜尋邏輯
  const globalSearch = $('globalSearch');
  const globalSearchOverlay = $('globalSearchOverlay');
  const btnExitSearch = $('btnExitSearch');
  const globalSearchResults = $('globalSearchResults');
  const searchTabs = document.querySelectorAll('.s-tab');

  let currentGlobalTab = 'team';
  const mockUsers = ['張同學', '李學長 (後端)', '王大神', '陳學妹', '林教授'];

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match]));
  }

  if (globalSearch && globalSearchOverlay) {
    globalSearch.addEventListener('focus', () => {
      globalSearchOverlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      runGlobalSearch();
    });
    globalSearch.addEventListener('input', runGlobalSearch);
  }

  if (btnExitSearch) {
    btnExitSearch.addEventListener('click', closeGlobalSearch);
  }

  function closeGlobalSearch() {
    globalSearchOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    globalSearch.value = '';
  }

  searchTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      searchTabs.forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentGlobalTab = e.currentTarget.dataset.tab;
      runGlobalSearch();
    });
  });

  function runGlobalSearch() {
    const q = globalSearch.value.trim().toLowerCase();

    if (q === '') {
      globalSearchResults.innerHTML = '<div style="padding: 30px; text-align: center; color: #8a735e;">請輸入關鍵字開始搜尋...</div>';
      return;
    }

    const teams = loadTeams();
    const contests = loadContests();
    let html = '';

    if (currentGlobalTab === 'comp') {
      const res = contests.filter(c => c.name.toLowerCase().includes(q) || (c.info && c.info.toLowerCase().includes(q)));
      html = res.map(c => `
        <div class="search-list-item" onclick="document.querySelector('#contestsList li[data-cid=\'${c.id}\']')?.click(); closeGlobalSearch();">
          <strong style="color: #4f3827;">🏆 競賽：${escapeHtml(c.name)}</strong>
          <span style="font-size:12px; color:#8a735e; margin-left:8px;">(${escapeHtml(c.date)})</span>
          <p style="margin: 4px 0 0; font-size: 13px; color: #666;">${escapeHtml(c.info)}</p>
        </div>`).join('');
    }
    else if (currentGlobalTab === 'team') {
      const res = teams.filter(t => t.name.toLowerCase().includes(q) || (t.desc && t.desc.toLowerCase().includes(q)));
      html = res.map(t => `
        <div class="search-list-item" onclick="closeGlobalSearch(); openTeamDetail(${t.id});">
          <strong style="color: #4f3827;">🚩 隊伍：${escapeHtml(t.name)}</strong>
          <span style="font-size:12px; color:#8a735e; margin-left:8px;">(缺額: ${t.slots - t.members})</span>
          <p style="margin: 4px 0 0; font-size: 13px; color: #666;">${escapeHtml(t.desc)}</p>
        </div>`).join('');
    }
    else if (currentGlobalTab === 'user') {
      const res = mockUsers.filter(u => u.toLowerCase().includes(q));
      html = res.map(u => `
        <div class="search-list-item">
          <strong style="color: #4f3827;">👤 用戶：${escapeHtml(u)}</strong>
        </div>`).join('');
    }

    globalSearchResults.innerHTML = html || '<div style="padding: 20px; text-align: center; color: #8a735e;">沒有找到符合的結果</div>';
  }

  window.closeGlobalSearch = closeGlobalSearch;

})();
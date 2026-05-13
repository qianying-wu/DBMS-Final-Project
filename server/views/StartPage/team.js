(function () {
  const $ = id => document.getElementById(id);
  const teamsGrid = $('teamsGrid');
  const contestsGrid = $('contestsGrid');
  const myTeams = $('myTeams');
  const followed = $('followed');
  const createBtn = $('createBtn');
  const openCreate = $('openCreate');
  const modal = $('modal');
  const modalCreate = $('modalCreate');
  const modalCancel = $('modalCancel');
  const newTeamName = $('newTeamName');
  const newTeamDesc = $('newTeamDesc');
  const teamSearch = $('teamSearch');
  // mock current user
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);

  function loadTeams() {
    const raw = localStorage.getItem('teams');
    if (raw) {
      const defaultNames = ['AI 聯合隊', '機器人挑戰隊', '資料探勘小隊'];
      const teams = JSON.parse(raw).filter(team => !defaultNames.includes(team.name));
      if (teams.length !== JSON.parse(raw).length) localStorage.setItem('teams', JSON.stringify(teams));
      return teams;
    }
    const seed = [];
    localStorage.setItem('teams', JSON.stringify(seed));
    return seed;
  }
  function loadContests() {
    const raw = localStorage.getItem('contests');
    const seed = [
      { id: 10, name: '全國資料科學競賽', date: '2026-07-20', info: '針對資料科學專題的校內外隊伍競賽' },
      { id: 11, name: '全國機器人盃', date: '2026-09-10', info: '機器人實作與競賽' },
      { id: 12, name: '校園創新黑客松', date: '2026-08-15', info: '48 小時產品原型、簡報與實作挑戰' },
      { id: 13, name: '智慧醫療應用競賽', date: '2026-10-02', info: '結合資料分析、AI 與醫療場景的跨域競賽' },
      { id: 14, name: '永續科技提案賽', date: '2026-11-18', info: '以永續、能源與社會影響為主題的提案競賽' },
      { id: 15, name: '金融科技創意賽', date: '2026-12-05', info: '金融資料、風控、支付與數位服務創新競賽' }
    ];
    if (raw) {
      const existing = JSON.parse(raw);
      const merged = [...existing];
      seed.forEach(contest => {
        if (!merged.some(item => Number(item.id) === Number(contest.id))) merged.push(contest);
      });
      if (merged.length !== existing.length) localStorage.setItem('contests', JSON.stringify(merged));
      return merged;
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

  function getCreateTeamHref() {
    const selectedContest = getSelectedContestId();
    const contestParam = selectedContest == null ? '' : `?contestId=${encodeURIComponent(selectedContest)}`;
    return withUserParam(`/create-team.html${contestParam}`);
  }

  function render() {
    const teams = loadTeams();
    const favs = loadFavorites();
    const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
    if (window.AppNotifications) window.AppNotifications.ensureContestNotifications(loadContests());
    teamsGrid.innerHTML = '';
    const selectedContest = getSelectedContestId();
    const contests = loadContests();
    renderContestOverview(contests, teams, selectedContest);
    teams.forEach(t => {
      // if a contest is selected, only show teams that belong to it
      if (selectedContest != null && Number(t.contestId || 0) !== Number(selectedContest)) return;
      const isFav = favs.includes(t.id);
      const card = document.createElement('div'); card.className = 'team-card';
      const isOwner = t.owner === ME.id;
      const pending = reqs.filter(r => r.teamId === t.id && r.status === 'pending').length;
      const contest = contests.find(c => c.id && Number(c.id) === Number(t.contestId));
      const contestName = contest ? contest.name : '';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="display:flex;align-items:center;gap:8px"><h4 style="margin:0">${t.name}</h4>${isOwner && pending ? `<span class="pending-count">${pending}</span>` : ''}</div>
          <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${t.id}" aria-pressed="${isFav}">${isFav ? '♥' : '♡'}</button>
        </div>
  <div class="team-meta">${t.desc}</div>
  ${contestName ? `<div class="team-contest">比賽：<strong>${contestName}</strong></div>` : ''}
        <div>成員 ${t.members} / ${t.slots}</div>
        <div style="margin-top:8px">
          <button class="btn" data-id="${t.id}">查看 / 加入</button>
      ${isOwner ? `<button class="btn outline manage-btn" data-team="${t.id}">管理</button>` : ''}
        </div>
      `;
      teamsGrid.appendChild(card);

    });

    // update myTeams (mock: none)
    const my = JSON.parse(localStorage.getItem('myTeams') || '[]');
    myTeams.textContent = my.length ? my.map(x => x.name).join('\n') : '尚未加入隊伍';

    // render favorites in right sidebar
    const favEls = favs.map(id => {
      const t = teams.find(x => x.id === id); if (!t) return null;
      return `<li><input type="checkbox" data-id="${t.id}" /> <strong>${t.name}</strong></li>`;
    }).filter(Boolean);
    document.getElementById('myFavs').innerHTML = favEls.length ? `<ul class="fav-list">${favEls.join('')}</ul>` : '尚無收藏';

    // render my managed teams (teams where I'm owner)
    const managed = teams.filter(t => t.owner === ME.id);
    if (managed.length) {
      const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
      const items = managed.map(t => {
        const pending = reqs.filter(r => r.teamId === t.id && r.status === 'pending').length;
        return `<li><span>${t.name}</span><span class="pending-count">${pending}</span> <button class="btn outline manage-btn" data-team="${t.id}">管理</button></li>`;
      });
      document.getElementById('myManaged').innerHTML = `<ul class="managed-list">${items.join('')}</ul>`;
    } else {
      document.getElementById('myManaged').textContent = '尚未管理任何隊伍';
    }
    // render contests list in left sidebar
    document.getElementById('contestsList').innerHTML = contests.map(c => `<li data-cid="${c.id}" class="contest-item" style="${selectedContest === c.id ? 'background:#f6efe6' : ''}"><strong>${c.name}</strong><div style="font-size:12px;color:#666">${c.date}</div></li>`).join('');

    // render contest info in content area (if selected)
    const contestInfoWrapId = 'contestInfoWrap';
    let contestInfoWrap = document.getElementById(contestInfoWrapId);
    if (!contestInfoWrap) { contestInfoWrap = document.createElement('div'); contestInfoWrap.id = contestInfoWrapId; contestInfoWrap.className = 'contest-info'; document.querySelector('.content').insertBefore(contestInfoWrap, document.getElementById('teamsGrid')) }
    const selected = contests.find(x => x.id === selectedContest);
    if (selected) contestInfoWrap.innerHTML = `<h3>${selected.name}</h3><div>${selected.date}</div><p>${selected.info}</p>`; else contestInfoWrap.innerHTML = `<h3>全部比賽</h3><div>顯示所有比賽與隊伍</div>`;
  }

  function renderContestOverview(contests, teams, selectedContest) {
    if (!contestsGrid) return;
    contestsGrid.innerHTML = contests.map(contest => {
      const contestTeams = teams.filter(team => Number(team.contestId) === Number(contest.id));
      const openings = contestTeams.reduce((sum, team) => sum + Math.max((team.slots || 0) - (team.members || 0), 0), 0);
      return `
        <article class="contest-card ${Number(selectedContest) === Number(contest.id) ? 'active' : ''}" data-cid="${contest.id}">
          <h3>${escapeHtml(contest.name)}</h3>
          <div class="contest-date">${escapeHtml(contest.date || '日期未定')}</div>
          <p>${escapeHtml(contest.info || '尚未填寫比賽資訊')}</p>
          <div class="contest-stats">
            <span>${contestTeams.length} 隊</span>
            <span>${openings} 缺額</span>
          </div>
        </article>
      `;
    }).join('');
  }

  teamsGrid.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const teamId = btn.dataset.id || btn.dataset.team; if (!teamId) return;
    // favorite button handling
    if (btn.classList.contains('fav-btn')) { toggleFavorite(Number(teamId)); return; }
    if (btn.classList.contains('manage-btn')) { openRequestsForTeam(Number(teamId)); return; }
    openTeamDetail(Number(teamId));
  });

  function loadFavorites() { return JSON.parse(localStorage.getItem('favorites') || '[]'); }
  function saveFavorites(f) { localStorage.setItem('favorites', JSON.stringify(f)); }
  function toggleFavorite(id) { const f = loadFavorites(); const idx = f.indexOf(id); if (idx >= 0) f.splice(idx, 1); else f.push(id); saveFavorites(f); render(); }

  function openTeamDetail(id) {
    const teams = loadTeams(); const t = teams.find(x => x.id === id); if (!t) return alert('找不到隊伍');
    const join = confirm(`隊伍：${t.name}\n${t.desc}\n成員 ${t.members}/${t.slots}\n\n要加入此隊伍嗎？`);
    if (join) {
      if (t.members >= t.slots) { alert('隊伍已額滿，無法加入'); return; }
      // create a join request (pending)
      const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
      const me = { id: 9999, name: '你自己' };
      const my = JSON.parse(localStorage.getItem('myTeams') || '[]');
      if (my.find(x => x.id === t.id)) return alert('你已在此隊伍');
      reqs.push({ id: Date.now(), teamId: t.id, teamName: t.name, user: me, status: 'pending' });
      localStorage.setItem('joinRequests', JSON.stringify(reqs));
      window.AppNotifications?.add({
        type: 'join-request',
        userId: t.owner,
        sourceId: `${t.id}:${me.id}`,
        sourceKey: `join-request:${t.id}:${me.id}`,
        message: `${me.name} 申請加入你的隊伍「${t.name}」`
      });
      alert('已送出加入申請，等待隊長審核');
    }
  }

  // Remove selected favorites
  const removeBtn = document.getElementById('removeSelectedFavs');
  removeBtn && removeBtn.addEventListener('click', () => {
    const boxes = Array.from(document.querySelectorAll('#myFavs input[type=checkbox]:checked'));
    if (!boxes.length) return alert('請先選取要移除的收藏');
    const ids = boxes.map(b => Number(b.dataset.id));
    let f = loadFavorites(); f = f.filter(id => !ids.includes(id)); saveFavorites(f); render();
  });

  // Requests modal handling
  const requestsModal = document.getElementById('requestsModal');
  const requestsList = document.getElementById('requestsList');
  const closeReq = document.getElementById('closeReq');
  function openRequestsForTeam(teamId) {
    const teams = loadTeams(); const team = teams.find(t => t.id === teamId);
    if (!team) return alert('找不到隊伍');
    if (team.owner !== ME.id) return alert('只有隊長可以管理本隊的加入請求');
    const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]').filter(r => r.teamId === teamId && r.status === 'pending');
    if (!reqs.length) { alert('目前沒有待審核申請'); return; }
    requestsList.innerHTML = reqs.map(r => {
      return `<div class="req-item" data-req="${r.id}"><div><strong>${r.user.name}</strong> 申請加入 <em>${r.teamName}</em></div><div class="req-actions"><button class="btn" data-act="approve" data-id="${r.id}">批准</button><button class="btn outline" data-act="deny" data-id="${r.id}">拒絕</button></div></div>`;
    }).join('');
    requestsModal.classList.remove('hidden'); document.body.classList.add('modal-open');
  }

  requestsList && requestsList.addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return; const act = btn.dataset.act; const id = Number(btn.dataset.id);
    const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]'); const idx = reqs.findIndex(r => r.id === id); if (idx < 0) return;
    if (act === 'approve') {
      const teams = loadTeams(); const tIdx = teams.findIndex(x => x.id === reqs[idx].teamId);
      if (tIdx < 0) { alert('隊伍不存在，無法批准'); return; }
      // check capacity before approving
      if ((teams[tIdx].members || 0) >= (teams[tIdx].slots || 0)) {
        // auto-deny when full
        reqs[idx].status = 'denied';
        localStorage.setItem('joinRequests', JSON.stringify(reqs));
        window.AppNotifications?.add({
          type: 'application-result',
          userId: reqs[idx].user.id,
          sourceId: reqs[idx].id,
          sourceKey: `application-result:${reqs[idx].id}:denied-full`,
          message: `你的加入申請未通過：${reqs[idx].teamName}（隊伍已額滿）`
        });
        alert('隊伍已額滿，無法批准本申請（已自動拒絕）。');
      } else {
        reqs[idx].status = 'approved';
        teams[tIdx].members = (teams[tIdx].members || 0) + 1; saveTeams(teams);
        const my = JSON.parse(localStorage.getItem('myTeams') || '[]'); if (!my.find(x => x.id === reqs[idx].teamId)) { my.push(teams[tIdx]); localStorage.setItem('myTeams', JSON.stringify(my)); }
        localStorage.setItem('joinRequests', JSON.stringify(reqs));
        window.AppNotifications?.add({
          type: 'application-result',
          userId: reqs[idx].user.id,
          sourceId: reqs[idx].id,
          sourceKey: `application-result:${reqs[idx].id}:approved`,
          message: `你的加入申請已通過：${teams[tIdx].name}`
        });
        alert('已批准');
        render();
      }
    } else {
      reqs[idx].status = 'denied'; localStorage.setItem('joinRequests', JSON.stringify(reqs));
      window.AppNotifications?.add({
        type: 'application-result',
        userId: reqs[idx].user.id,
        sourceId: reqs[idx].id,
        sourceKey: `application-result:${reqs[idx].id}:denied`,
        message: `你的加入申請未通過：${reqs[idx].teamName}`
      });
      alert('已拒絕');
    }
    // refresh modal list
    const pending = JSON.parse(localStorage.getItem('joinRequests') || '[]').filter(r => r.teamId === reqs[idx].teamId && r.status === 'pending');
    if (pending.length) {
      requestsList.innerHTML = pending.map(r => `<div class="req-item" data-req="${r.id}"><div><strong>${r.user.name}</strong> 申請加入 <em>${r.teamName}</em></div><div class="req-actions"><button class="btn" data-act="approve" data-id="${r.id}">批准</button><button class="btn outline" data-act="deny" data-id="${r.id}">拒絕</button></div></div>`).join('');
    } else { requestsModal.classList.add('hidden'); document.body.classList.remove('modal-open'); }
  });

  closeReq && closeReq.addEventListener('click', () => { requestsModal.classList.add('hidden'); document.body.classList.remove('modal-open'); });

  function openCreateTeamPage() { location.href = getCreateTeamHref(); }
  function hideModal() { modal.classList.add('hidden'); newTeamName.value = ''; newTeamDesc.value = ''; }
  function closeModal() { document.body.classList.remove('modal-open'); hideModal(); }
  createBtn.addEventListener('click', openCreateTeamPage);
  openCreate.addEventListener('click', openCreateTeamPage);
  modalCancel.addEventListener('click', closeModal);

  modalCreate.addEventListener('click', () => {
    const name = newTeamName.value.trim(); if (!name) return alert('請輸入隊名');
    const desc = newTeamDesc.value.trim();
    const teams = loadTeams(); const id = Date.now();
    const selContest = getSelectedContestId();
    teams.unshift({ id, name, desc, members: 1, slots: 4, owner: ME.id, contestId: selContest || undefined }); saveTeams(teams);
    closeModal(); render();
  });

  // click outside modal to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Esc to close
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!modal.classList.contains('hidden')) closeModal(); } });

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

  // notify / avatar handlers
  const notifyBtn = document.getElementById('notifyBtn');
  const avatarBtn = document.getElementById('avatarBtn');
  const homeLink = document.getElementById('homeLink');
  if (homeLink) homeLink.href = withUserParam('/user.html');
  if (avatarBtn) avatarBtn.addEventListener('click', () => { location.href = withUserParam('/profile.html'); });

  // contest selection handler (delegated)
  document.addEventListener('click', (e) => {
    const li = e.target.closest('#contestsList li'); if (!li) return;
    const cid = Number(li.dataset.cid);
    setSelectedContestId(cid);
    location.href = withUserParam(`/contest.html?id=${encodeURIComponent(cid)}`);
  });

  contestsGrid && contestsGrid.addEventListener('click', e => {
    const card = e.target.closest('[data-cid]');
    if (!card) return;
    const cid = Number(card.dataset.cid);
    setSelectedContestId(cid);
    location.href = withUserParam(`/contest.html?id=${encodeURIComponent(cid)}`);
  });

  render();

  // ==============================
  // 全域懸浮搜尋功能邏輯 (新增)
  // ==============================
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

    // 沒打字時的防呆提示
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
        <div class="search-list-item" onclick="document.querySelector('#contestsList li[data-cid=\\'${c.id}\\']')?.click(); closeGlobalSearch();">
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

})();

(function(){
  const $ = id => document.getElementById(id);
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const contestId = Number(params.get('contestId')) || Number(params.get('id')) || 10;

  function loadContests(){
    const raw = localStorage.getItem('contests');
    const seed = [
      { id: 10, name: '全國資料科學競賽', date:'2026-07-20', info:'針對資料科學專題的校內外隊伍競賽' },
      { id: 11, name: '全國機器人盃', date:'2026-09-10', info:'機器人實作與競賽' },
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

  function loadTeams(){
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

  function saveTeams(teams){ localStorage.setItem('teams', JSON.stringify(teams)); }
  function loadFavorites(){ return JSON.parse(localStorage.getItem('favorites')||'[]'); }
  function saveFavorites(favs){ localStorage.setItem('favorites', JSON.stringify(favs)); }

  function getContest(){
    const contests = loadContests();
    return contests.find(c => Number(c.id) === contestId) || contests[0];
  }

  function contestTeams(){
    return loadTeams().filter(team => Number(team.contestId) === Number(getContest().id));
  }

  function withUserParam(path){
    const userId = params.get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  function createTeamHref(){
    return withUserParam(`/create-team.html?contestId=${encodeURIComponent(getContest().id)}`);
  }

  function render(){
    const contest = getContest();
    const teams = contestTeams();
    const favs = loadFavorites();
    window.AppNotifications?.ensureContestNotifications(loadContests());
    document.title = `${contest.name} / 組隊`;

    $('contestSummary').innerHTML = `
      <h2>${contest.name}</h2>
      <div class="summary-grid">
        <div class="summary-item"><span>隊伍數量</span><strong>${teams.length}</strong></div>
        <div class="summary-item"><span>比賽日期</span><strong>${contest.date}</strong></div>
        <div class="summary-item"><span>招募需求</span><strong>${teams.reduce((sum,t)=>sum + Math.max((t.slots||0)-(t.members||0),0),0)} 人</strong></div>
      </div>
    `;

    $('contestInfo').innerHTML = `
      <p>${contest.info}</p>
      <p>可以在此查看目前正在招募的隊伍，也可以直接建立自己的隊伍並開始招募成員。</p>
    `;

    $('contestTeams').innerHTML = teams.length ? teams.map(team => `
      <li data-team="${team.id}">
        <strong>${team.name}</strong>
        <div>${team.members} / ${team.slots} 人</div>
      </li>
    `).join('') : '<li>目前沒有隊伍</li>';

    $('teamCards').innerHTML = teams.length ? teams.map(team => {
      const isFav = favs.includes(team.id);
      return `
        <article class="team-card">
          <h4>${team.name}</h4>
          <div class="team-meta">${team.desc || '尚未填寫說明'}</div>
          <div>成員 ${team.members} / ${team.slots}</div>
          <div class="team-actions">
            <button class="btn" data-id="${team.id}">查看 / 加入</button>
            <button class="fav-btn ${isFav ? 'active' : ''}" data-fav="${team.id}" aria-pressed="${isFav}">${isFav ? '♥ 已收藏' : '♡ 收藏'}</button>
          </div>
        </article>
      `;
    }).join('') : '<div class="box">目前還沒有隊伍，先創建自己的隊伍吧。</div>';

    const my = JSON.parse(localStorage.getItem('myTeams')||'[]').filter(team => Number(team.contestId) === Number(contest.id));
    $('myTeams').textContent = my.length ? my.map(team => team.name).join('\n') : '尚未加入隊伍';

    const followed = teams.filter(team => favs.includes(team.id));
    $('followed').textContent = followed.length ? followed.map(team => team.name).join('\n') : '尚無關注';
  }

  function toggleFavorite(id){
    const favs = loadFavorites();
    const index = favs.indexOf(id);
    if (index >= 0) favs.splice(index, 1); else favs.push(id);
    saveFavorites(favs);
    render();
  }

  function openTeamDetail(id){
    const team = loadTeams().find(item => item.id === id);
    if (!team) return alert('找不到隊伍');
    const join = confirm(`隊伍：${team.name}\n${team.desc}\n成員 ${team.members}/${team.slots}\n\n要加入此隊伍嗎？`);
    if (!join) return;
    if (team.members >= team.slots) return alert('隊伍已額滿，無法加入');

    const reqs = JSON.parse(localStorage.getItem('joinRequests')||'[]');
    reqs.push({ id: Date.now(), teamId: team.id, teamName: team.name, user: ME, status: 'pending' });
    localStorage.setItem('joinRequests', JSON.stringify(reqs));
    window.AppNotifications?.add({
      type: 'join-request',
      userId: team.owner,
      sourceId: `${team.id}:${ME.id}`,
      sourceKey: `join-request:${team.id}:${ME.id}`,
      message: `${ME.name} 申請加入你的隊伍「${team.name}」`
    });
    alert('已送出加入申請，等待隊長審核');
  }

  function openCreateTeamPage(){
    location.href = createTeamHref();
  }

  $('createBtn').addEventListener('click', openCreateTeamPage);
  $('openCreate').addEventListener('click', openCreateTeamPage);

  $('teamCards').addEventListener('click', e=>{
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) return toggleFavorite(Number(favBtn.dataset.fav));
    const joinBtn = e.target.closest('[data-id]');
    if (joinBtn) openTeamDetail(Number(joinBtn.dataset.id));
  });

  $('contestTeams').addEventListener('click', e=>{
    const item = e.target.closest('[data-team]');
    if (item) openTeamDetail(Number(item.dataset.team));
  });

  $('backBtn').addEventListener('click', ()=>{ location.href = withUserParam('/team.html'); });
  $('avatarBtn').addEventListener('click', ()=>{ location.href = withUserParam('/profile.html'); });
  document.querySelector('.logo-link')?.setAttribute('href', withUserParam('/user.html'));

  render();
})();

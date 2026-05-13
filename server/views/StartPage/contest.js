(function(){
  const $ = id => document.getElementById(id);
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const contestId = Number(params.get('contestId')) || Number(params.get('id')) || 10;

  function loadContests(){
    const raw = localStorage.getItem('contests');
    if (raw) return JSON.parse(raw);
    const seed = [
      { id: 10, name: '全國資料科學競賽', date:'2026-07-20', info:'針對資料科學專題的校內外隊伍競賽' },
      { id: 11, name: '全國機器人盃', date:'2026-09-10', info:'機器人實作與競賽' }
    ];
    localStorage.setItem('contests', JSON.stringify(seed));
    return seed;
  }

  function loadTeams(){
    const raw = localStorage.getItem('teams');
    if (raw) return JSON.parse(raw);
    const seed = [
      { id:1, name:'AI 聯合隊', desc:'需要前端與資料處理', members:2, slots:3, owner:1111, contestId:10 },
      { id:2, name:'機器人挑戰隊', desc:'尋找機構工程師', members:1, slots:4, owner:2222, contestId:11 },
      { id:3, name:'資料探勘小隊', desc:'統計/ML', members:3, slots:4, owner:ME.id, contestId:10 }
    ];
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
  $('notifyBtn').addEventListener('click', ()=>{ alert('目前無新通知'); });
  $('avatarBtn').addEventListener('click', ()=>{ location.href = withUserParam('/profile.html'); });

  render();
})();

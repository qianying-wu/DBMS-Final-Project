(function(){
  const $ = id => document.getElementById(id);
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const currentUserId = params.get('userId') && params.get('userId') !== 'unknown' ? params.get('userId') : String(ME.id);
  const contestId = Number(params.get('contestId')) || Number(params.get('id')) || 10;
  const questions = ['請簡單介紹你的背景和想加入的原因'];

  function loadContests(){
    const raw = localStorage.getItem('contests');
    const seed = [
      { id: 10, name: '全國資料科學競賽', date:'2026-07-20', info:'針對資料科學專題的校內外隊伍競賽', officialUrl: 'https://www.kaggle.com/competitions' },
      { id: 11, name: '全國機器人盃', date:'2026-09-10', info:'機器人實作與競賽', officialUrl: 'https://www.robocup.org/' },
      { id: 12, name: '校園創新黑客松', date: '2026-08-15', info: '48 小時產品原型、簡報與實作挑戰', officialUrl: 'https://devpost.com/hackathons' },
      { id: 13, name: '智慧醫療應用競賽', date: '2026-10-02', info: '結合資料分析、AI 與醫療場景的跨域競賽', officialUrl: 'https://www.drivendata.org/competitions/' },
      { id: 14, name: '永續科技提案賽', date: '2026-11-18', info: '以永續、能源與社會影響為主題的提案競賽', officialUrl: 'https://www.hultprize.org/' },
      { id: 15, name: '金融科技創意賽', date: '2026-12-05', info: '金融資料、風控、支付與數位服務創新競賽', officialUrl: 'https://www.fintechfestival.sg/' }
    ];
    if (raw) {
      const existing = JSON.parse(raw);
      const merged = existing.map(contest => {
        const defaults = seed.find(item => Number(item.id) === Number(contest.id));
        return defaults ? { ...defaults, ...contest, officialUrl: contest.officialUrl || defaults.officialUrl } : contest;
      });
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
  function loadContestFavorites(){ return JSON.parse(localStorage.getItem('favoriteContests')||'[]').map(Number); }

  function escapeAttr(value){
    return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function getContest(){
    const contests = loadContests();
    return contests.find(contest => Number(contest.id) === contestId) || contests[0];
  }

  function withUserParam(path){
    const userId = params.get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  function contestHref(){
    return withUserParam(`/contest.html?id=${encodeURIComponent(getContest().id)}`);
  }

  function getContestTeams(){
    const contest = getContest();
    return loadTeams().filter(team => Number(team.contestId) === Number(contest.id));
  }

  function render(){
    const contest = getContest();
    const teams = getContestTeams();
    window.AppNotifications?.ensureContestNotifications(loadContests());
    const openings = teams.reduce((sum,team) => sum + Math.max((team.slots || 0) - (team.members || 0), 0), 0);
    document.title = `創建新隊伍 / ${contest.name}`;

    $('contestSummary').innerHTML = `
      <h2>${contest.name}</h2>
      <div class="summary-grid">
        <div class="summary-item"><span>隊伍數量</span><strong>${teams.length}</strong></div>
        <div class="summary-item"><span>比賽日期</span><strong>${contest.date}</strong></div>
        <div class="summary-item"><span>招募缺額</span><strong>${openings} 人</strong></div>
      </div>
    `;

    $('contestLabel').textContent = `建立於：${contest.name}`;
    $('officialContestLink').href = contest.officialUrl || '#';
    $('contestTeams').innerHTML = teams.length ? teams.map(team => `
      <li>
        <strong>${team.name}</strong>
        <div>${team.members} / ${team.slots} 人</div>
      </li>
    `).join('') : '<li>目前沒有隊伍</li>';

    const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`)||'[]');
    const my = loadTeams().filter(team => joinedIds.some(id => Number(id) === Number(team.id)) && Number(team.contestId) === Number(contest.id));
    $('myTeams').textContent = my.length ? my.map(team => team.name).join('\n') : '尚未加入隊伍';

    const favs = loadFavorites();
    const followed = teams.filter(team => favs.includes(team.id));
    $('myFavs').textContent = followed.length ? followed.map(team => team.name).join('\n') : '尚無收藏';
    const favoriteContests = loadContestFavorites().map(id => loadContests().find(item => Number(item.id) === Number(id))).filter(Boolean);
    $('followed').textContent = favoriteContests.length ? favoriteContests.map(item => `${item.name}\n${item.date}`).join('\n\n') : '尚無關注';
  }

  function renderQuestions(){
    $('questionsList').innerHTML = questions.map((question, index) => `
      <div class="question-row">
        <input class="question-input" data-index="${index}" type="text" value="${escapeAttr(question)}" placeholder="輸入給申請人的問題">
        <button class="remove-question" data-remove="${index}" type="button" aria-label="刪除提問">×</button>
      </div>
    `).join('');
  }

  $('addQuestion').addEventListener('click', () => {
    questions.push('');
    renderQuestions();
    const inputs = document.querySelectorAll('.question-input');
    inputs[inputs.length - 1].focus();
  });

  $('questionsList').addEventListener('input', event => {
    const input = event.target.closest('.question-input');
    if (!input) return;
    questions[Number(input.dataset.index)] = input.value;
  });

  $('questionsList').addEventListener('click', event => {
    const button = event.target.closest('[data-remove]');
    if (!button) return;
    if (questions.length === 1) {
      questions[0] = '';
    } else {
      questions.splice(Number(button.dataset.remove), 1);
    }
    renderQuestions();
  });

  $('createForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('teamName').value.trim();
    if (!name) return alert('請輸入隊伍名稱');

    const descParts = [$('teamDesc').value.trim(), $('teamSkills').value.trim() ? `需求：${$('teamSkills').value.trim()}` : ''].filter(Boolean);
    const slots = Number($('teamSlots').value) || 4;
    const applicationQuestions = questions.map(question => question.trim()).filter(Boolean);
    const teams = loadTeams();
    teams.unshift({
      id: Date.now(),
      name,
      desc: descParts.join('\n'),
      members: 1,
      slots,
      owner: currentUserId,
      contestId: getContest().id,
      applicationQuestions,
      requireResume: $('requireResume').checked
    });
    saveTeams(teams);
    alert('已建立隊伍');
    location.href = contestHref();
  });

  $('cancelBtn').addEventListener('click', () => { location.href = contestHref(); });
  $('backBtn').addEventListener('click', () => { location.href = contestHref(); });
  document.querySelector('.logo-link')?.setAttribute('href', withUserParam('/user.html'));

  render();
  renderQuestions();
})();

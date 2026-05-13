(function(){
  const $ = id => document.getElementById(id);
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const contestId = Number(params.get('contestId')) || Number(params.get('id')) || 10;
  const questions = ['請簡單介紹你的背景和想加入的原因'];

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
    $('contestTeams').innerHTML = teams.length ? teams.map(team => `
      <li>
        <strong>${team.name}</strong>
        <div>${team.members} / ${team.slots} 人</div>
      </li>
    `).join('') : '<li>目前沒有隊伍</li>';

    const my = JSON.parse(localStorage.getItem('myTeams')||'[]').filter(team => Number(team.contestId) === Number(contest.id));
    $('myTeams').textContent = my.length ? my.map(team => team.name).join('\n') : '尚未加入隊伍';

    const favs = JSON.parse(localStorage.getItem('favorites')||'[]');
    const followed = teams.filter(team => favs.includes(team.id));
    $('followed').textContent = followed.length ? followed.map(team => team.name).join('\n') : '尚無關注';
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
      owner: ME.id,
      contestId: getContest().id,
      applicationQuestions
    });
    saveTeams(teams);
    alert('已建立隊伍');
    location.href = contestHref();
  });

  $('cancelBtn').addEventListener('click', () => { location.href = contestHref(); });
  $('backBtn').addEventListener('click', () => { location.href = contestHref(); });
  $('notifyBtn').addEventListener('click', () => { alert('目前無新通知'); });
  $('avatarBtn').addEventListener('click', () => { location.href = withUserParam('/profile.html'); });

  render();
  renderQuestions();
})();

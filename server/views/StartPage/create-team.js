(function(){
  // 簡化 DOM 查找，後續用 $('id') 取得元素。
  const $ = id => document.getElementById(id);

  // 本機測試用預設使用者，網址沒有 userId 時使用。
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const currentUserId = params.get('userId') && params.get('userId') !== 'unknown' ? params.get('userId') : String(ME.id);
  const initialContestId = Number(params.get('contestId')) || Number(params.get('id')) || null;

  // 若雲端 API 暫時無法取得比賽，使用這組資料讓頁面仍可展示與測試。
  const fallbackContests = [
    { id: 10, name: '全國資料科學競賽', date:'2026-07-20', info:'針對資料科學專題的校內外隊伍競賽', officialUrl: 'https://www.kaggle.com/competitions', preferenceKeys: ['data', 'ai'] },
    { id: 11, name: '全國機器人盃', date:'2026-09-10', info:'機器人實作與競賽', officialUrl: 'https://www.robocup.org/', preferenceKeys: ['robotics', 'ai'] },
    { id: 12, name: '校園創新黑客松', date: '2026-08-15', info: '48 小時產品原型、簡報與實作挑戰', officialUrl: 'https://devpost.com/hackathons', preferenceKeys: ['web', 'app', 'startup', 'presentation'] },
    { id: 13, name: '智慧醫療應用競賽', date: '2026-10-02', info: '結合資料分析、AI 與醫療場景的跨域競賽', officialUrl: 'https://www.drivendata.org/competitions/', preferenceKeys: ['medical', 'ai', 'data'] },
    { id: 14, name: '永續科技提案賽', date: '2026-11-18', info: '以永續、能源與社會影響為主題的提案競賽', officialUrl: 'https://www.hultprize.org/', preferenceKeys: ['sustainability', 'startup', 'presentation'] },
    { id: 15, name: '金融科技創意賽', date: '2026-12-05', info: '金融資料、風控、支付與數位服務創新競賽', officialUrl: 'https://www.fintechfestival.sg/', preferenceKeys: ['fintech', 'data', 'security'] }
  ];

  let contests = [];
  let selectedContestId = initialContestId || null;
  const questions = ['請簡單介紹你的背景和想加入的原因'];

  // 將使用者輸入轉成安全文字，避免插入 HTML 時破壞畫面。
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  // 將資料放進 HTML attribute 前先轉義。
  function escapeAttr(value){
    return String(value ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // 從後端讀取雲端資料庫 Competition 表；失敗時使用 localStorage 或 fallback。
  async function loadContests(){
    try {
      const response = await fetch('/competitions');
      const json = await response.json();
      if (response.ok && Array.isArray(json.competitions)) {
        localStorage.setItem('contests', JSON.stringify(json.competitions));
        return json.competitions;
      }
    } catch (err) {
      console.warn('無法從資料庫取得比賽，改用本機資料：', err.message || err);
    }

    const local = JSON.parse(localStorage.getItem('contests') || '[]');
    return local.length ? local : fallbackContests;
  }

  function loadTeams(){
    return JSON.parse(localStorage.getItem('teams') || '[]');
  }

  function saveTeams(teams){
    localStorage.setItem('teams', JSON.stringify(teams));
  }

  function withUserParam(path){
    const userId = params.get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  function getSelectedContest(){
    return contests.find(contest => Number(contest.id) === Number(selectedContestId)) || null;
  }

  // 依搜尋字串更新比賽清單；只讓使用者從既有比賽中選擇。
  function renderContestResults(){
    const keyword = $('contestSearch').value.trim().toLowerCase();
    const filtered = contests.filter(contest => {
      const text = `${contest.name || ''} ${contest.date || ''}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });

    $('contestResults').innerHTML = filtered.length ? filtered.map(contest => {
      const isSelected = Number(contest.id) === Number(selectedContestId);
      return `
        <button class="contest-option ${isSelected ? 'selected' : ''}" type="button" data-contest="${contest.id}">
          <strong>${escapeHtml(contest.name)}</strong>
          <span>${escapeHtml(contest.date || '日期未定')}</span>
        </button>
      `;
    }).join('') : '<div class="empty-note">找不到符合的比賽，請換個關鍵字試試。</div>';

    $('contestSelect').value = selectedContestId ? String(selectedContestId) : '';
  }

  function selectContest(id){
    selectedContestId = Number(id);
    const contest = getSelectedContest();
    if (contest) $('contestSearch').value = contest.name;
    renderContestResults();
  }

  // 渲染「給申請人的提問」列表。
  function renderQuestions(){
    $('questionsList').innerHTML = questions.map((question, index) => `
      <div class="question-row">
        <input class="question-input" data-index="${index}" type="text" value="${escapeAttr(question)}" placeholder="輸入給申請人的問題">
        <button class="remove-question" data-remove="${index}" type="button" aria-label="刪除提問">×</button>
      </div>
    `).join('');
  }

  $('contestSearch').addEventListener('input', () => {
    selectedContestId = null;
    renderContestResults();
  });

  $('contestResults').addEventListener('click', event => {
    const option = event.target.closest('[data-contest]');
    if (!option) return;
    selectContest(option.dataset.contest);
  });

  $('addQuestion').addEventListener('click', () => {
    questions.push('');
    renderQuestions();
    document.querySelectorAll('.question-input').item(questions.length - 1)?.focus();
  });

  $('questionsList').addEventListener('input', event => {
    const input = event.target.closest('.question-input');
    if (!input) return;
    questions[Number(input.dataset.index)] = input.value;
  });

  $('questionsList').addEventListener('click', event => {
    const button = event.target.closest('[data-remove]');
    if (!button) return;
    if (questions.length === 1) questions[0] = '';
    else questions.splice(Number(button.dataset.remove), 1);
    renderQuestions();
  });

  // 表單送出：建立隊伍並導回所選比賽頁。
  $('createForm').addEventListener('submit', event => {
    event.preventDefault();
    const contest = getSelectedContest();
    const name = $('teamName').value.trim();
    if (!contest) return alert('請先搜尋並選擇一個比賽');
    if (!name) return alert('請輸入隊伍名稱');

    const descParts = [
      $('teamDesc').value.trim(),
      $('teamSkills').value.trim() ? `需求：${$('teamSkills').value.trim()}` : ''
    ].filter(Boolean);

    const teams = loadTeams();
    teams.unshift({
      id: Date.now(),
      name,
      desc: descParts.join('\n'),
      members: 1,
      slots: Number($('teamSlots').value) || 4,
      owner: currentUserId,
      contestId: contest.id,
      applicationQuestions: questions.map(question => question.trim()).filter(Boolean),
      requireResume: $('requireResume').checked
    });
    saveTeams(teams);
    alert('已建立隊伍');
    location.href = withUserParam(`/contest.html?id=${encodeURIComponent(contest.id)}`);
  });

  $('cancelBtn').addEventListener('click', () => { location.href = withUserParam('/team.html'); });
  $('backBtn').addEventListener('click', () => { location.href = withUserParam('/team.html'); });
  document.querySelector('.logo-link')?.setAttribute('href', withUserParam('/team.html'));

  async function init(){
    contests = await loadContests();
    if (selectedContestId && !getSelectedContest()) selectedContestId = null;
    if (selectedContestId) {
      const contest = getSelectedContest();
      if (contest) $('contestSearch').value = contest.name;
    }
    renderContestResults();
    renderQuestions();
  }

  init();
})();

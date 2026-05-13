(function(){
  const $ = id => document.getElementById(id);
  // 模擬當前使用者
  const ME = { id: 9999, name: '你自己' }; 
  
  // 從網址列取得要查看的隊伍 ID (例如：team-info.html?teamId=1)
  const params = new URLSearchParams(location.search);
  const currentTeamId = Number(params.get('teamId')) || 1; // 預設抓 ID 為 1 的隊伍測試

  // 沿用共用的讀取資料邏輯
  function loadContests(){
    const raw = localStorage.getItem('contests');
    const seed = [
      { id: 10, name: '全國資料科學競賽', date: '2026-07-20', info: '針對資料科學專題的校內外隊伍競賽' },
      { id: 11, name: '全國機器人盃', date: '2026-09-10', info: '機器人實作與競賽' },
      { id: 12, name: '校園創新黑客松', date: '2026-08-15', info: '48 小時產品原型、簡報與實作挑戰' },
      { id: 13, name: '智慧醫療應用競賽', date: '2026-10-02', info: '結合資料分析、AI 與醫療場景的跨域競賽' },
      { id: 14, name: '永續科技提案賽', date: '2026-11-18', info: '以永續、能源與社會影響為主題的提案競賽' },
      { id: 15, name: '金融科技創意賽', date: '2026-12-05', info: '金融資料、風控、支付與數位服務創新競賽' }
    ];
    if (!raw) {
      localStorage.setItem('contests', JSON.stringify(seed));
      return seed;
    }
    const existing = JSON.parse(raw);
    const merged = [...existing];
    seed.forEach(contest => {
      if (!merged.some(item => Number(item.id) === Number(contest.id))) merged.push(contest);
    });
    if (merged.length !== existing.length) localStorage.setItem('contests', JSON.stringify(merged));
    return merged;
  }

  function loadTeams(){
    const raw = localStorage.getItem('teams');
    if (!raw) {
      localStorage.setItem('teams', '[]');
      return [];
    }
    const defaultNames = ['AI 聯合隊', '機器人挑戰隊', '資料探勘小隊'];
    const teams = JSON.parse(raw).filter(team => !defaultNames.includes(team.name));
    if (teams.length !== JSON.parse(raw).length) localStorage.setItem('teams', JSON.stringify(teams));
    return teams;
  }

  function escapeAttr(value){
    return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // 1. 核心渲染函式：將隊伍資料填入 HTML
  function renderTeamInfo() {
    const teams = loadTeams();
    const contests = loadContests();
    
    // 找出當前隊伍
    const team = teams.find(t => Number(t.id) === currentTeamId);
    if (!team) {
      alert('找不到該隊伍資訊');
      location.href = '/team.html';
      return;
    }

    // 找出所屬比賽
    const contest = contests.find(c => Number(c.id) === Number(team.contestId)) || { name: '未知比賽' };

    // 填入基本資訊
    document.title = `${team.name} - 隊伍資訊`;
    $('displayTeamName').textContent = team.name;
    $('displayContestLabel').textContent = contest.name;
    $('displayMemberCount').textContent = team.members;
    $('displayMaxSlots').textContent = team.slots;
    
    // 處理說明與技能 (因為在 create-team 是合併存在 desc 裡)
    $('displayDesc').textContent = team.desc || '這支隊伍還沒有填寫詳細說明。';
    
    // 簡單判斷是否有包含「需求：」字眼來分離技能標籤
    if (team.desc && team.desc.includes('需求：')) {
      const skillsMatch = team.desc.match(/需求：(.*)/);
      $('displaySkills').textContent = skillsMatch ? skillsMatch[1] : '詳見說明';
    } else {
      $('displaySkills').textContent = '不限';
    }

    // 渲染成員列表 (這裡先寫死隊長，實務上會從 team.memberList 陣列去 map)
    const isOwner = team.owner === ME.id;
    $('memberList').innerHTML = `
      <li>👑 ${isOwner ? ME.name : '隊長 (ID: '+team.owner+')'}</li>
      ${Array.from({length: team.members - 1}).map((_, i) => `<li>👤 隊員 ${i+1}</li>`).join('')}
    `;

    // 準備申請表單的提問
    const questions = team.applicationQuestions || [];
    if (questions.length > 0) {
      $('applicationQuestions').innerHTML = questions.map((q, index) => `
        <div class="application-question-item">
          <p>Q${index + 1}: ${escapeAttr(q)}</p>
          <textarea rows="3" placeholder="請輸入你的回答" required></textarea>
        </div>
      `).join('');
    } else {
      $('applicationQuestions').innerHTML = '<p>隊長沒有設定特別的提問，請直接送出申請即可。</p>';
    }

    // 渲染左側：本比賽的其他隊伍
    const otherTeams = teams.filter(t => Number(t.contestId) === Number(contest.id) && Number(t.id) !== currentTeamId);
    $('otherTeams').innerHTML = otherTeams.length ? otherTeams.map(t => `
      <li>
        <a href="/team-info.html?teamId=${t.id}" style="text-decoration:none; color:inherit;">
          <strong>${t.name}</strong>
          <div>${t.members} / ${t.slots} 人</div>
        </a>
      </li>
    `).join('') : '<li>無其他隊伍</li>';

    // 渲染右側：我的隊伍與關注 (沿用舊邏輯)
    const my = JSON.parse(localStorage.getItem('myTeams')||'[]').filter(t => Number(t.contestId) === Number(contest.id));
    $('myTeams').textContent = my.length ? my.map(t => t.name).join('\n') : '尚未加入隊伍';

    const favs = JSON.parse(localStorage.getItem('favorites')||'[]');
    const followed = teams.filter(t => favs.includes(t.id));
    $('followed').textContent = followed.length ? followed.map(t => t.name).join('\n') : '尚無關注';
    
    // 如果自己是隊長，隱藏申請按鈕
    if (isOwner) {
      $('actionButtons').style.display = 'none';
    }
  }

  // 2. 設定按鈕的互動事件
  function setupEventListeners() {
    // 申請按鈕：隱藏一般按鈕，顯示申請表單
    $('applyBtn').addEventListener('click', () => {
      $('actionButtons').style.display = 'none';
      $('applyForm').style.display = 'block';
    });

    // 取消申請：隱藏表單，恢復一般按鈕
    $('cancelApplyBtn').addEventListener('click', () => {
      $('applyForm').style.display = 'none';
      $('actionButtons').style.display = 'flex';
    });

    // 送出申請表單
    $('applyForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const teams = loadTeams();
      const team = teams.find(t => Number(t.id) === currentTeamId);
      if (team) {
        const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
        reqs.push({ id: Date.now(), teamId: team.id, teamName: team.name, user: ME, status: 'pending' });
        localStorage.setItem('joinRequests', JSON.stringify(reqs));
        window.AppNotifications?.add({
          type: 'join-request',
          userId: team.owner,
          sourceId: `${team.id}:${ME.id}`,
          sourceKey: `join-request:${team.id}:${ME.id}`,
          message: `${ME.name} 申請加入你的隊伍「${team.name}」`
        });
      }
      alert('已送出加入申請！隊長審核後會發送通知。');
      // 實務上這裡要把答案存進資料庫
      $('applyForm').style.display = 'none';
      $('actionButtons').style.display = 'flex';
      $('applyBtn').textContent = '審核中...';
      $('applyBtn').disabled = true;
    });

    // 其他導覽按鈕
    $('contactBtn').addEventListener('click', () => { alert('測試中'); });
    $('backBtn').addEventListener('click', () => { history.back(); });
    const userId = params.get('userId');
    const userSuffix = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    $('avatarBtn').addEventListener('click', () => { location.href = `/profile.html${userSuffix}`; });
    document.querySelector('.logo-link')?.setAttribute('href', `/user.html${userSuffix}`);
  }

  // 3. 執行初始化
  renderTeamInfo();
  setupEventListeners();

})();

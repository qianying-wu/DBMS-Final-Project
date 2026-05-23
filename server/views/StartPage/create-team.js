(function(){
  // 簡化 DOM 查找，後續用 $('id') 取得元素。
  const $ = id => document.getElementById(id);

  // 本機測試用預設使用者，網址沒有 userId 時使用。
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const currentUserId = params.get('userId') && params.get('userId') !== 'unknown' ? params.get('userId') : String(ME.id);
  const initialContestId = Number(params.get('contestId')) || Number(params.get('id')) || null;
  let selectedContestId = initialContestId || null;

  // 預設給申請人的問題。
  const questions = ['請簡單介紹你的背景和想加入的原因'];


  // 讀取比賽資料，並補齊預設比賽與官方連結。
  async function loadContests(){
    try {
      const path = '/contests';
      const response = await fetch(path);
      if (!response.ok) throw new Error('伺服器回應錯誤');
      
      const contests = await response.json();
      return contests; // 這會是一個從資料庫撈出來的陣列
    } catch (error) {
      console.error('❌ 無法從資料庫載入比賽:', error);
      // alert('載入比賽列表失敗，請檢查網路連線或後端伺服器');
      return [];
    }
  }

  // 讀取隊伍資料，並移除展示用預設隊伍。
  function loadTeams(){
    const raw = localStorage.getItem('teams');
    if (raw) {
      const defaultNames = ['AI 聯合隊', '機器人挑戰隊', '資料探勘小隊'];
      const teams = JSON.parse(raw).filter(team => !defaultNames.includes(team.team_name));
      if (teams.length !== JSON.parse(raw).length) localStorage.setItem('teams', JSON.stringify(teams));
      return teams;
    }

  }

  // 讀取各種本機狀態資料。
  function loadFavorites(){ return JSON.parse(localStorage.getItem('favorites')||'[]'); }
  function loadContestFavorites(){ return JSON.parse(localStorage.getItem('favoriteContests')||'[]').map(Number); }

  // 將資料放進 HTML attribute 前先轉義。
  function escapeAttr(value){
    return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // 🚀 簡化後的版本：單純記錄使用者切換下拉選單時選擇的比賽 com_id
  function toggleNewContestFields(){
    selectedContestId = $('contestSelect').value ? Number($('contestSelect').value) : null;
    
    // 如果你後面還有其他連帶的畫面渲染，再執行 render()
    if (typeof render === 'function') render();
  }

  // 取得目前選擇的比賽；若使用新增比賽模式則回傳 null。
  async function getContest(){
    const contests = await loadContests();
    if ($('contestSelect')?.value === 'new') return null;
    return contests.find(contest => Number(contest.com_id) === Number(selectedContestId)) || contests[0];
  }

  // 將 userId 保留在跨頁連結中。這個感覺可以整合
  function withUserParam(path){
    const userId = params.get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  // 取得目前比賽底下的隊伍。
  async function getContestTeams(){
    const contest = await getContest();
    if (!contest) return [];
    return loadTeams().filter(team => Number(team.com_id) === Number(contest.com_id));
  }

  // 更新頁面摘要、左右側狀態與通知。
  async function render(){
    const contest = await getContest();
    const teams = await getContestTeams();
    window.AppNotifications?.ensureContestNotifications(loadContests());
    const openings = teams.reduce((sum,team) => sum + Math.max((team.num_limit || 0) - (team.members || 0), 0), 0);
    document.title = '發起招募';

    $('contestSummary').innerHTML = `
      <h2>發起招募</h2>
      <div class="summary-grid">
        <div class="summary-item"><span>比賽模式</span><strong>${contest ? '既有比賽' : '新增比賽'}</strong></div>
        <div class="summary-item"><span>比賽日期</span><strong>${contest?.date || '建立後顯示'}</strong></div>
        <div class="summary-item"><span>本比賽隊伍</span><strong>${contest ? `${teams.length} 隊` : '送出後建立'}</strong></div>
      </div>
    `;

    $('contestLabel').textContent = contest ? `使用既有比賽：${contest.com_name}` : '新增比賽並建立隊伍';
    const officialContestLink = $('officialContestLink');
    if (officialContestLink) {
      officialContestLink.href = contest?.officialUrl || '#';
      officialContestLink.ariaDisabled = contest?.officialUrl ? 'false' : 'true';
    }

    $('contestTeams').innerHTML = teams.length ? teams.map(team => `
      <li>
        <strong>${team.team_name}</strong>
        <div>${team.current_member_count} / ${team.num_limit} 人</div>
      </li>
    `).join('') : '<li>目前沒有隊伍</li>';

    const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`)||'[]');
    const my = loadTeams().filter(team => joinedIds.some(id => Number(id) === Number(team.team_id)) && (!contest || Number(team.com_id) === Number(contest.com_id)));

    $('myTeams').textContent = my.length ? my.map(team => team.team_name).join('\n') : '尚未加入隊伍';

    const favs = loadFavorites();
    const followed = teams.filter(team => favs.includes(team.team_id));

    $('myFavs').textContent = followed.length ? followed.map(team => team.team_name).join('\n') : '尚無收藏';
    const favoriteContests = loadContestFavorites().map(id => loadContests().find(item => Number(item.team_id) === Number(id))).filter(Boolean);

    // 檢查這邊item是什麼
    $('followed').textContent = favoriteContests.length ? favoriteContests.map(item => `${item.name}\n${item.date}`).join('\n\n') : '尚無關注';
  }

  // 渲染比賽下拉選單
  async function renderContestSelect(){
    let contests = await loadContests(); 
  
    // 2. 決定預設選中的值
    const selectedValue = selectedContestId && contests.some(c => Number(c.com_id) === Number(selectedContestId)) ? String(selectedContestId) : '';
    
    // 3. 開始渲染 Options
    $('contestSelect').innerHTML = `
      ${contests.map(contest => `
        <option value="${contest.com_id}">
          ${escapeAttr(contest.com_name)}（${escapeAttr(contest.com_date || '日期未定')}）
        </option>
      `).join('')}
    `;
    
    $('contestSelect').value = selectedValue;
  }

  // 送出表單時取得比賽；若是新增比賽模式，會先建立比賽資料。
  function resolveContestForSubmit() {
    const selectedComId = $('contestSelect').value;

    // 防呆：如果使用者選到預設的空白選項、或者是空的
    if (!selectedComId || selectedComId === 'new') {
      throw new Error('請選擇一個比賽');
    }

    // 直接回傳包含 id 的物件，讓後續建立隊伍的程式碼（contest.id）可以無縫接軌
    return {
      id: Number(selectedComId)
    };
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

  // 新增一個申請問題。
  $('addQuestion').addEventListener('click', () => {
    questions.push('');
    renderQuestions();
    const inputs = document.querySelectorAll('.question-input');
    inputs[inputs.length - 1].focus();
  });

  // 使用者編輯問題文字時，同步回 questions 陣列。
  $('questionsList').addEventListener('input', event => {
    const input = event.target.closest('.question-input');
    if (!input) return;
    questions[Number(input.dataset.index)] = input.value;
  });

  // 刪除問題；至少保留一個空白問題欄位。
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

  // 表單送出：建立隊伍並導回對應比賽頁。
  $('createForm').addEventListener('submit', async event => { // 💡 注意：這裡加上了 async
    event.preventDefault();
    const name = $('teamName').value.trim();
    if (!name) return alert('請輸入隊伍名稱');
    
    let contest;
    try {
      contest = resolveContestForSubmit();
    } catch (error) {
      return alert(error.message || error);
    }
  
    // ----------檢查這邊的邏輯------------
    const descParts = [$('teamDesc').value.trim(), $('teamSkills').value.trim() ? `需求：${$('teamSkills').value.trim()}` : ''].filter(Boolean);
    const slots = Number($('teamSlots').value) || 4;
    
    // 這裡打包要丟給資料庫的欄位資料
    const teamData = {
      com_id: contest.id,                // 資料庫: com_id
      teamStatus: 'active',              // 資料庫: teamStatus (預設啟用)
      num_limit: slots,                  // 資料庫: num_limit
      demand: descParts.join('\n'),      // 資料庫: demand
      team_name: name,                   // 資料庫: team_name
      current_member_count: 1,          // 資料庫: current_member_count (建立時預設 1 人，代表隊長)
    };
  
    try {
      
      const path = '/teams';
    
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData) // 把資料變成字串送過去
      });
  
      console.log(teamData);
      const result = await response.json();
  
      if (response.ok && result.success) {
        alert('🎉 隊伍建立成功！');
        
        // 成功後看你要導頁回到哪裡，例如：
        // window.location.href = `/contest/${contest.id}`;
      } else {
        alert('建立隊伍失敗：' + (result.message || '未知錯誤'));
      }
    } catch (error) {
      console.error('網路錯誤:', error);
      alert('無法連接到伺服器，請稍後再試');
    }
  });

  // 導頁按鈕與表單初始化。
  $('cancelBtn').addEventListener('click', () => { location.href = withUserParam('/team.html'); });
  $('backBtn').addEventListener('click', () => { location.href = withUserParam('/team.html'); });
  document.querySelector('.logo-link')?.setAttribute('href', withUserParam('/team.html'));
  $('contestSelect').addEventListener('change', toggleNewContestFields);

  // 🚀 2. 負責網頁載入啟動的監聽器，回呼函式要加上 async
  document.addEventListener('DOMContentLoaded', async () => {
    
    await renderContestSelect(); 
    
    const contests = await loadContests();
    
    const select = document.getElementById('contestSelect');
    if (!select) return;

    // 清空舊的選項（保留請選擇或建立新比賽的預設選項）
    select.innerHTML = '<option value="">-- 請選擇比賽 --</option><option value="new">建立新比賽...</option>';

    // 2. 根據資料庫欄位渲染選項
    contests.forEach(contest => {
      const option = document.createElement('option');
      
      // 🔔 注意：這裡的欄位名稱必須跟你的 MySQL 欄位一模一樣！
      // 假設你的比賽 Table 主鍵叫 com_id，名字叫 name
      option.value = contest.com_id; 
      option.textContent = contest.com_name; 
      
      select.appendChild(option);
    });
  });  
  toggleNewContestFields();
  render();
  renderQuestions();
})();

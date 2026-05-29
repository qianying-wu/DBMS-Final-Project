// import { currentUserId, withUserParam, escapeHtml } from './team-data.js';

// 使用立即執行函式 (IIFE) 包裝，避免內部的變數污染到全域環境
(function(){
  const $ = id => document.getElementById(id);
  
  // 從網址列取得要查看的隊伍 ID (例如：team-info.html?teamId=1)
  const params = new URLSearchParams(location.search);
  const currentTeamId = Number(params.get('teamId') || params.get('id'));
  const userIdParam = params.get('userId') || localStorage.getItem('userId'); // 🚀 優先整合可靠的本地儲存 ID
  const ME = { id: userIdParam && userIdParam !== 'unknown' ? userIdParam : '9999', name: '你自己' };

  // --- 資料讀寫輔助函式區塊 (轉正為連線真實資料庫) ---

  // 🚀 轉正版：從後端真實資料庫讀取全部比賽
  async function loadContests() {
    try {
      const res = await fetch('/api/contests/competitions'); 
      if (!res.ok) throw new Error('無法取得資料庫比賽資料');
      
      const result = await res.json();
      const dbContests = result.competitions || result; 

      const mappedContests = dbContests.map(contest => ({
        id: contest.com_id,                             
        name: contest.com_name,                       
        com_date: contest.com_date || '日期未定',     
        com_intro: contest.com_intro || '尚未填寫說明', 
        officialUrl: contest.com_link || '#'    
      }));
      return mappedContests;
    } catch (err) {
      console.error('❌ 讀取比賽資料庫失敗:', err);
      return [];
    }
  }

  // 🚀 轉正版：從後端真實資料庫讀取全部隊伍
  async function loadTeams() {
    try {
      const res = await fetch('/api/teams/all'); 
      if (!res.ok) throw new Error('無法取得資料庫隊伍資料');

      const result = await res.json();
      const dbTeams = result.data || result.teams || result;

      const mappedTeams = dbTeams.map(team => ({
        id: team.team_id || team.id,                  
        team_id: team.team_id,                        
        team_name: team.team_name,                    
        com_id: team.com_id,                          
        demand: team.team_intro || team.demand || '尚未填寫說明', 
        current_member_count: team.current_member_count || 0,     
        num_limit: team.num_limit || 0,
        owner_id: team.owner_id || team.leader_id || 9999, // 補上對齊擁有者 ID 欄位
        requireResume: team.require_resume || team.requireResume || false,
        applicationQuestions: team.application_questions ? JSON.parse(team.application_questions) : []
      }));
      return mappedTeams;
    } catch (err) {
      console.error('❌ 讀取隊伍資料庫失敗:', err);
      return [];
    }
  }

  function escapeAttr(value){
    return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function loadProfiles(){
    return JSON.parse(localStorage.getItem('profiles') || '[]');
  }

  function withUserParam(path){
    const userId = localStorage.getItem('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  // 1. 🚀 核心渲染函式：轉正為 async 確保資料庫讀取完畢才渲染
  async function renderTeamInfo() {
    const teams = await loadTeams();
    const contests = await loadContests();
    
    // 找出當前隊伍 (使用 team_id 對齊)
    const team = teams.find(t => Number(t.team_id) === currentTeamId);
    if (!team) {
      alert('找不到該隊伍資訊！');
      history.back();
      return;
    }

    // 找出所屬比賽 (使用 com_id 對齊)
    const contest = contests.find(c => Number(c.id) === Number(team.com_id)) || { name: '未知比賽', com_date: '日期未定', com_intro: '尚未填寫比賽資訊。', officialUrl: '#' };

    // 填入基本資訊 (全變數對齊)
    document.title = `${team.team_name} - 隊伍資訊`;
    $('displayTeamName').textContent = team.team_name;
    $('displayContestLabel').textContent = contest.name;
    $('displayContestName').textContent = contest.name;
    $('displayContestDate').textContent = contest.com_date || '日期未定';
    $('displayContestInfo').textContent = contest.com_intro || '尚未填寫比賽資訊。';
    $('displayMemberCount').textContent = team.current_member_count;
    $('displayMaxSlots').textContent = team.num_limit;
    
    // 🚀 需求字眼自動換行偵測：偵測「需求：」並在前面加上換行，且維持 white-space 特性
    const formattedDemand = team.demand ? team.demand.replace(/(需求：)/g, '\n$1') : '這支隊伍還沒有填寫詳細說明。';
    $('displayDesc').style.whiteSpace = 'pre-line';
    $('displayDesc').textContent = formattedDemand;

    // 🚀 判定是否已申请或滿員（localStorage 舊邏輯暫留作保險，後面會透過真實 API 覆蓋）
    const userTeamIds = JSON.parse(localStorage.getItem(`myTeams:${ME.id}`) || '[]');
    const alreadyJoinedLocal = userTeamIds.some(id => Number(id) === Number(team.team_id));
    const pending = JSON.parse(localStorage.getItem('joinRequests') || '[]').some(req => Number(req.teamId) === Number(team.team_id) && String(req.user?.id) === String(ME.id) && req.status === 'pending');
    
    if (alreadyJoinedLocal || pending || Number(team.current_member_count) >= Number(team.num_limit)) {
      $('applyBtn').textContent = alreadyJoinedLocal ? '已在隊伍中' : pending ? '審核中...' : '隊伍已額滿';
      if (alreadyJoinedLocal) {
        if ($('applyBtn')) $('applyBtn').style.display = 'none';
        if ($('contactBtn')) $('contactBtn').style.display = 'none';
      }
    }

    // 🚀 執行真實資料庫的角色與成員關係檢查
    await checkUserRoleAndRender();
  }

  // 2. 綁定事件處理器
  function setupEventListeners() {
    // 申請按鈕
    $('applyBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      
      try {
        const res = await fetch('/api/teams/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: ME.id,       // 目前登入的使用者 ID
            team_id: currentTeamId // 目前頁面的隊伍 ID
          })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || '申請失敗');

        alert('申請成功！目前狀態：審核中。');
        $('applyBtn').textContent = '審核中...';
        $('applyBtn').disabled = true;

      } catch (err) {
        alert(err.message);
      }
    });

    // 其他導覽按鈕
    $('contactBtn').addEventListener('click', () => { alert('聯絡功能整合中...'); });
  }

  /**
   * 👑 核心身分權限與加入狀態檢查
   */
  async function checkUserRoleAndRender() {
    try {
      // 🚀 對齊變數來源，確保撈到正確隊伍的詳細資料
      const res = await fetch(`/api/teams/detail?teamId=${currentTeamId}`);
      if (!res.ok) return;
      
      const result = await res.json();
      const team = result.team;
      const members = result.members || []; // 後端傳回來的目前隊員清單陣列

      const currentUserId = localStorage.getItem('userId');

      // 1. 👑 判斷當前登入者是不是這個隊伍的 Owner (建立者)
      const isCreator = String(team.owner_id) === String(currentUserId);

      // 2. 👥 判斷目前登入者是否「已經在這個隊伍裡」（遍歷隊員名單的 user_id）
      const isAlreadyMember = members.some(m => String(m.user_id) === String(currentUserId));

      // 🚀 核心新增：如果已經在隊伍裡（身分是建立者或一般成員），直接拔除「申請」與「聯絡」按鈕
      if (isCreator || isAlreadyMember) {
        if ($('applyBtn')) $('applyBtn').style.display = 'none';
        if ($('contactBtn')) $('contactBtn').style.display = 'none';
      } else {
        // 如果不在隊伍裡，確保按鈕正常顯示（避免被上面舊的 local 狀態誤卡）
        if ($('applyBtn') && $('applyBtn').textContent !== '審核中...' && $('applyBtn').textContent !== '隊伍已額滿') {
          $('applyBtn').style.display = 'block';
        }
        if ($('contactBtn')) $('contactBtn').style.display = 'block';
      }

      // 3. 根據身分切換控制台的 UI 欄位（建立者可修改，其餘人唯讀）
      if (isCreator) {
        // 🔓 建立者角色：解放所有「修改欄位、儲存按鈕」以及「顯示審核申請名單區塊」
        document.querySelectorAll('.creator-only-fields').forEach(el => el.removeAttribute('disabled'));
        if ($('editTeamBtn')) $('editTeamBtn').classList.remove('hidden');
        if ($('reviewApplicationsSection')) $('reviewApplicationsSection').classList.remove('hidden');
        
        // 如果有審核名單渲染函式，在這邊驅動
        if (typeof renderReviewList === 'function') {
          renderReviewList(currentTeamId);
        }
      } else {
        // 🔒 一般成員或訪客角色：全部唯讀，隱藏審核區
        document.querySelectorAll('.creator-only-fields').forEach(el => el.setAttribute('disabled', 'true'));
        if ($('editTeamBtn')) $('editTeamBtn').classList.add('hidden');
        if ($('reviewApplicationsSection')) $('reviewApplicationsSection').classList.add('hidden');
      }
    } catch (err) {
      console.error('❌ 檢查使用者角色狀態時出錯:', err);
    }
  }
  
  const homeLink = $('homeLink');
  if (homeLink) homeLink.href = withUserParam('/contests.html');

  // 3. 🚀 執行初始化：呼叫 async 渲染
  renderTeamInfo();
  setupEventListeners();
})();
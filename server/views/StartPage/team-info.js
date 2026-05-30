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

  // 將要放進 innerHTML 的文字做轉義，避免使用者填的名字或技能破壞頁面結構。
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  // 目前先用 localStorage 的履歷資料推估使用者名稱與技能；之後接後端時可替換這裡。
  function getActiveProfile() {
    const profiles = loadProfiles();
    const activeProfileId = localStorage.getItem('activeProfileId');
    return profiles.find(item => String(item.id) === String(activeProfileId)) || profiles[0] || null;
  }

  // 從履歷物件中取出「人的名字」。注意：profile.name 通常是履歷名稱，不拿來當成員姓名。
  function getProfileName(profile, fallback) {
    return profile?.data?.name || profile?.data?.user_pv_name || profile?.user_pv_name || fallback;
  }

  // 從履歷物件中取出技能標籤，支援目前 profile.js 可能存放的幾種格式。
  function getProfileSkills(profile) {
    const skills = profile?.tags || profile?.data?.tags || profile?.skills || profile?.data?.skills || [];
    return Array.isArray(skills) && skills.length ? skills.join('、') : '';
  }

  // myTeam 審核同意後，會把隊友暫存在 teamMembers:v1:{teamId}，這裡讀出來顯示。
  function getLocalMembers(teamId) {
    return JSON.parse(localStorage.getItem(`teamMembers:v1:${teamId}`) || '[]');
  }

  function saveLocalApplication(teamId) {
    const applications = JSON.parse(localStorage.getItem('teamApplications:v1') || '[]');
    const profile = getActiveProfile();
    const applicantName = getProfileName(profile, `使用者 ${ME.id}`);

    const exists = applications.some(app =>
      Number(app.teamId) === Number(teamId) &&
      String(app.userId) === String(ME.id) &&
      app.status === 'pending'
    );
    if (exists) return;

    applications.unshift({
      id: `${teamId}-${ME.id}-${Date.now()}`,
      teamId: Number(teamId),
      userId: String(ME.id),
      applicantName,
      applicantContact: profile?.email || profile?.userEmail || '尚未填寫',
      applicantReason: '想加入這個隊伍，一起完成比賽。',
      resume: profile,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    localStorage.setItem('teamApplications:v1', JSON.stringify(applications));
  }

  // 用既有的「我建立的隊伍」API 判斷目前使用者是不是這支隊伍的建立者。
  // 這樣不需要新增後端路由，也比用 team.owner_id 猜測更可靠。
  async function isOwnedByCurrentUser(teamId) {
    try {
      const res = await fetch(`/api/teams/my-owned?userId=${encodeURIComponent(ME.id)}`);
      if (!res.ok) return false;
      const result = await res.json();
      const teams = result.data || result.teams || [];
      return teams.some(team => Number(team.team_id || team.id) === Number(teamId));
    } catch (err) {
      console.error('❌ 判斷隊伍建立者失敗:', err);
      return false;
    }
  }

  // 渲染「目前成員」區塊：先顯示隊長，再顯示 myTeam 審核通過後存在 localStorage 的隊友。
  function renderMemberList(team, isCreator) {
    const memberList = $('memberList');
    if (!memberList) return;

    const creatorProfile = getActiveProfile();
    const localMembers = getLocalMembers(team.team_id);
    const members = [
      {
        name: isCreator ? getProfileName(creatorProfile, `隊長 ${ME.id}`) : '隊伍建立者',
        role: '建立人',
        skills: isCreator ? getProfileSkills(creatorProfile) : '隊伍管理'
      },
      ...localMembers.map(member => {
        const resume = member.resume?.data || member.resume || {};
        const skills = member.resume?.tags || resume.tags || member.tags || [];
        return {
          name: member.applicantName || resume.user_pv_name || resume.name || `使用者 ${member.userId}`,
          role: member.role || '組員',
          skills: Array.isArray(skills) && skills.length ? skills.join('、') : ''
        };
      })
    ];

    // localStorage 成員可能比資料庫 current_member_count 更新，所以取較大的數字顯示。
    $('displayMemberCount').textContent = Math.max(Number(team.current_member_count) || 0, members.length);

    memberList.innerHTML = members.map(member => `
      <li class="member-card">
        <div class="member-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        <div class="member-info">
          <strong>${escapeHtml(member.name)}</strong>
          <span>${escapeHtml(member.role)}</span>
          ${member.skills ? `<p>專長：${escapeHtml(member.skills)}</p>` : ''}
        </div>
      </li>
    `).join('');
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
      $('applyBtn').disabled = true;
      if (alreadyJoinedLocal) {
        if ($('applicationBlock')) $('applicationBlock').style.display = 'none';
      }
    }

    // 🚀 執行角色與成員關係檢查，決定要不要顯示申請按鈕，並渲染目前成員。
    await checkUserRoleAndRender(team);
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
        saveLocalApplication(currentTeamId);
        $('applyBtn').textContent = '審核中...';
        $('applyBtn').disabled = true;

      } catch (err) {
        alert(err.message);
      }
    });
  }

  /**
   * 👑 核心身分權限與加入狀態檢查
   */
  async function checkUserRoleAndRender(team) {
    try {
      // 1. 👑 判斷當前登入者是不是這個隊伍的建立者。
      const isCreator = await isOwnedByCurrentUser(currentTeamId);

      // 2. 👥 判斷目前登入者是否已經被本機審核通過為隊員。
      const isAlreadyMember = getLocalMembers(currentTeamId).some(member => String(member.userId) === String(ME.id));

      // 3. 🕒 判斷目前登入者是否已有待審核申請，避免重複送出。
      const hasPendingApplication = JSON.parse(localStorage.getItem('teamApplications:v1') || '[]').some(app =>
        Number(app.teamId) === Number(currentTeamId) &&
        String(app.userId) === String(ME.id) &&
        app.status === 'pending'
      );

      // 4. 🧾 不管是否顯示申請按鈕，都先把目前成員列表畫出來。
      renderMemberList(team, isCreator);

      // 🚀 核心新增：如果已經在隊伍裡（身分是建立者或一般成員），直接拔除「申請」與「聯絡」按鈕
      if (isCreator || isAlreadyMember) {
        if ($('applicationBlock')) $('applicationBlock').style.display = 'none';
      } else if (hasPendingApplication) {
        if ($('applicationBlock')) $('applicationBlock').style.display = 'flex';
        if ($('applyBtn')) {
          $('applyBtn').textContent = '審核中...';
          $('applyBtn').disabled = true;
        }
      } else {
        // 如果不在隊伍裡，確保按鈕正常顯示（避免被上面舊的 local 狀態誤卡）
        if ($('applyBtn') && $('applyBtn').textContent !== '審核中...' && $('applyBtn').textContent !== '隊伍已額滿') {
          $('applyBtn').style.display = 'inline-flex';
          $('applyBtn').disabled = false;
        }
        if ($('applicationBlock')) $('applicationBlock').style.display = 'flex';
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

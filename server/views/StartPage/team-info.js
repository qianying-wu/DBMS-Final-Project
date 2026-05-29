// import { currentUserId, withUserParam, escapeHtml } from './team-data.js';

// 使用立即執行函式 (IIFE) 包裝，避免內部的變數污染到全域環境
(function(){
  const $ = id => document.getElementById(id);
  
  // 從網址列取得要查看的隊伍 ID (例如：team-info.html?teamId=1)
  const params = new URLSearchParams(location.search);
  const currentTeamId = Number(params.get('teamId') || params.get('id'));
  const userIdParam = params.get('userId');
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
        // owner: team.leader_id || team.owner || 9999, // 預留隊長/擁有者 ID
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
    const userId = params.get('userId');
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
    
    // 分離技能標籤顯示
    // if (team.demand && (team.demand.includes('需求：') || team.demand.includes('需求:'))) {
    //   const skillsMatch = team.demand.match(/(需求：)(.*)/);
    //   $('displaySkills').textContent = skillsMatch ? skillsMatch[2] : '詳見說明';
    // } else {
    //   $('displaySkills').textContent = '不限';
    // }

    // 渲染成員列表 ------等memership串好再用---------
    // $('memberList').innerHTML = `
    //   ${Array.from({length: Math.max(team.current_member_count, 0)}).map((_, i) => `<li>👤 隊員 ${i+1} </li>`).join('')}
    // `;

    // 準備申請表單的提問
    // const questions = team.applicationQuestions || [];
    // const profiles = loadProfiles();
    // if (team.requireResume) {
    //   $('resumeSelectWrap').style.display = 'flex';
    //   $('resumeSelect').required = true;
    //   $('resumeSelect').innerHTML = profiles.length
    //     ? profiles.map(profile => `<option value="${escapeAttr(profile.id)}">${escapeAttr(profile.name || profile.data?.name || '履歷')}</option>`).join('')
    //     : '<option value="">尚未建立履歷</option>';
    // } else {
    //   $('resumeSelectWrap').style.display = 'none';
    //   $('resumeSelect').required = false;
    // }

    // if (questions.length > 0) {
    //   $('applicationQuestions').innerHTML = questions.map((q, index) => `
    //     <div class="application-question-item">
    //       <p>Q${index + 1}: ${escapeAttr(q)}</p>
    //       <textarea rows="3" data-question="${escapeAttr(q)}" placeholder="請輸入你的回答" required></textarea>
    //     </div>
    //   `).join('');
    // } else {
    //   $('applicationQuestions').innerHTML = '<p>隊長沒有設定特別的提問，請直接送出申請即可。</p>';
    // }

    // 🚀 判定是否已申请或滿員（串接 API 前的初步前端按鈕防護狀態）
    const userTeamIds = JSON.parse(localStorage.getItem(`myTeams:${ME.id}`) || '[]');
    const alreadyJoined = userTeamIds.some(id => Number(id) === Number(team.team_id));
    const pending = JSON.parse(localStorage.getItem('joinRequests') || '[]').some(req => Number(req.teamId) === Number(team.team_id) && String(req.user?.id) === String(ME.id) && req.status === 'pending');
    
    if (alreadyJoined || pending || Number(team.current_member_count) >= Number(team.num_limit)) {
      $('applyBtn').textContent = alreadyJoined ? '已在隊伍中' : pending ? '審核中...' : '隊伍已額滿';
    }
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

      } catch (err) {
        alert(err.message);
      }
    });


    // 其他導覽按鈕
    $('contactBtn').addEventListener('click', () => { alert('聯絡功能整合中...'); });
    document.querySelector('.logo-link')?.setAttribute('href', withUserParam('/team.html'));
  }

  // 3. 🚀 執行初始化：呼叫 async 渲染
  renderTeamInfo();
  setupEventListeners();
})();
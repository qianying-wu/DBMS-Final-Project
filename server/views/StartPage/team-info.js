// 使用立即執行函式 (IIFE) 包裝，避免內部的變數污染到全域環境
(function(){
  const $ = id => document.getElementById(id);
  
  // 從網址列取得要查看的隊伍 ID (例如：team-info.html?teamId=1)
  const params = new URLSearchParams(location.search);
  const currentTeamId = Number(params.get('teamId') || params.get('id'));
  const userIdParam = params.get('userId') || localStorage.getItem('userId');
  const ME = { id: userIdParam && userIdParam !== 'unknown' ? userIdParam : '9999', name: '你自己' };
  let applyLocked = false;

  function setApplicationAvailability({ visible = true, disabled = false, text = '加入隊伍', lock = false, tone = 'default' } = {}) {
    const block = $('applicationBlock');
    const applyBtn = $('applyBtn');
    applyLocked = lock;

    if (block) block.style.display = visible ? 'flex' : 'none';
    if (!applyBtn) return;

    applyBtn.textContent = text;
    applyBtn.disabled = disabled;
    applyBtn.classList.toggle('is-muted', tone === 'muted');
    applyBtn.classList.toggle('is-member', tone === 'member');
  }
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
        owner_id: team.owner_id || team.leader_id || 9999, 
        requireResume: team.require_resume || team.requireResume || false,
        applicationQuestions: team.application_questions ? JSON.parse(team.application_questions) : []
      }));
      return mappedTeams;
    } catch (err) {
      console.error('❌ 讀取隊伍資料庫失敗:', err);
      return [];
    }
  }

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function getLocalMembers(teamId) {
    return JSON.parse(localStorage.getItem(`teamMembers:v1:${teamId}`) || '[]');
  }

  async function checkAndRenderApplyButton(teamId, userId) {
    const applyBtn = $('applyBtn');
    if (!applyBtn || !userId || userId === 'unknown') return;

    try {
      const res = await fetch(`/api/teams/apply-status?userId=${encodeURIComponent(userId)}&teamId=${encodeURIComponent(teamId)}`);
      if (!res.ok) throw new Error();
      
      const result = await res.json();
      const status = result.status; 

      if (status === '申請中') {
        setApplicationAvailability({ disabled: true, text: '審核中...', lock: true, tone: 'muted' });
      } else if (status === '通過') {
        setApplicationAvailability({ visible: false, disabled: true, text: '您已是隊員', lock: true, tone: 'member' });
      } else {
        if (!applyLocked) setApplicationAvailability({ disabled: false, text: '加入隊伍', lock: false });
      }
    } catch (err) {
      console.error("❌ 無法取得資料庫 Membership 狀態:", err);
    }
  }

  if (currentTeamId && ME?.id) {
    checkAndRenderApplyButton(currentTeamId, ME.id);
  }

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

  async function renderMemberList(team, isCreator) {
    const memberList = $('memberList');
    if (!memberList) return;

    let realMembers = [];
    try {
      let res = await fetch(`/api/teams/members?teamId=${team.team_id}`);
      if (!res.ok) {
         res = await fetch(`/api/teams/detail?teamId=${team.team_id}`);
      }
      
      if (res.ok) {
        const result = await res.json();
        const membersArray = result.members || result.data || [];
        
        realMembers = membersArray.filter(m => m.mem_status === '通過' || m.status === '通過' || m.role === '建立人').map(m => ({
          id: m.user_id,
          name: m.userName || m.name || m.user_name || `使用者 ${m.user_id}`,
          role: m.role || '組員'
        }));
      }
    } catch (err) {
      console.error('❌ 無法取得資料庫成員名單:', err);
    }

    if (realMembers.length === 0) {
      realMembers = [{
        id: team.owner_id || ME.id,
        name: isCreator ? '隊伍建立者 (你)' : '隊伍建立者',
        role: '建立人'
      }];
    }

    const countEl = $('displayMemberCount');
    if(countEl) countEl.textContent = realMembers.length;

    // 簡化卡片內容，移除履歷和評價提示，保留點擊跳轉功能
    memberList.innerHTML = realMembers.map(member => `
      <li style="padding: 0; overflow: hidden; border: 1px solid #e6ddd3; border-radius: 8px;">
        <a href="/review.html?targetUserId=${member.id}&teamId=${team.team_id}" 
           class="member-card" 
           style="text-decoration: none; display: flex; padding: 14px; color: inherit; transition: background 0.2s ease;"
           onmouseover="this.style.backgroundColor='#f4eee6'" 
           onmouseout="this.style.backgroundColor='#faf7f2'">
          
          <div class="member-avatar" aria-hidden="true" style="margin-right: 12px;">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          
          <div class="member-info" style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
            <strong>${escapeHtml(member.name)}</strong>
            <span>${escapeHtml(member.role)}</span>
          </div>

        </a>
      </li>
    `).join('');
  }

  function withUserParam(path){
    const userId = localStorage.getItem('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  async function renderTeamInfo() {
    const teams = await loadTeams();
    const contests = await loadContests();
    
    const team = teams.find(t => Number(t.team_id) === currentTeamId);
    if (!team) {
      alert('找不到該隊伍資訊！');
      history.back();
      return;
    }

    const contest = contests.find(c => Number(c.id) === Number(team.com_id)) || { name: '未知比賽', com_date: '日期未定', com_intro: '尚未填寫比賽資訊。', officialUrl: '#' };

    document.title = `${team.team_name} - 隊伍資訊`;
    $('displayTeamName').textContent = team.team_name;
    $('displayContestLabel').textContent = contest.name;
    $('displayContestName').textContent = contest.name;
    $('displayContestDate').textContent = (contest.com_date) ? contest.com_date.split('T')[0] : '日期未定';
    $('displayContestInfo').textContent = contest.com_intro || '尚未填寫比賽資訊。';
    $('displayMemberCount').textContent = team.current_member_count;
    $('displayMaxSlots').textContent = team.num_limit;
    
    const formattedDemand = team.demand ? team.demand.replace(/(需求：)/g, '\n$1') : '這支隊伍還沒有填寫詳細說明。';
    $('displayDesc').style.whiteSpace = 'pre-line';
    $('displayDesc').textContent = formattedDemand;

    const userTeamIds = JSON.parse(localStorage.getItem(`myTeams:${ME.id}`) || '[]');
    const alreadyJoinedLocal = userTeamIds.some(id => Number(id) === Number(team.team_id));
    const pending = JSON.parse(localStorage.getItem('joinRequests') || '[]').some(req => Number(req.teamId) === Number(team.team_id) && String(req.user?.id) === String(ME.id) && req.status === 'pending');
    
    if (alreadyJoinedLocal || pending || Number(team.current_member_count) >= Number(team.num_limit)) {
      setApplicationAvailability({
        visible: !alreadyJoinedLocal,
        disabled: true,
        text: alreadyJoinedLocal ? '已在隊伍中' : pending ? '審核中...' : '隊伍已額滿',
        lock: true,
        tone: alreadyJoinedLocal ? 'member' : 'muted'
      });
    }

    await checkUserRoleAndRender(team);
  }

  function setupEventListeners() {
    const modal = document.getElementById('resumeModal');
    function openResumeModal() { 
      if (modal) modal.style.display = 'flex'; 
    }
    function closeResumeModal() { 
      if (modal) modal.style.display = 'none'; 
    }
    document.getElementById('closeModalBtn')?.addEventListener('click', closeResumeModal);
    document.getElementById('cancelModalBtn')?.addEventListener('click', closeResumeModal);
    modal?.addEventListener('click', (e) => { 
      if (e.target === modal) closeResumeModal(); 
    });

    $('applyBtn')?.addEventListener('click', async (e) => {
      e.preventDefault();

      if (applyLocked || $('applyBtn')?.disabled) return;
    
      if (!ME || !ME.id) {
        alert('請先登入後再進行申請！');
        return;
      }
    
      $('applyBtn').disabled = true;
      $('applyBtn').textContent = '讀取履歷清單...';
    
      try {
        const res = await fetch(`/api/pv/getMyResumeList?userId=${encodeURIComponent(ME.id)}`);
        
        if (res.status === 404) {
          alert('您目前尚未建立任何履歷！請先前往「個人檔案」新增履歷後再行申請。');
          resetApplyButton();
          return;
        }
        if (!res.ok) throw new Error('無法取得您的履歷列表');
        
        const result = await res.json();
        const resumeList = result.data || [];
    
        document.getElementById('hiddenResumeId').value = '';
        document.getElementById('confirmApplyBtn').disabled = true;
    
        const listContainer = document.getElementById('resumeListContainer');
        if (listContainer) {
          listContainer.innerHTML = resumeList.map(resume => `
            <button type="button" class="resume-item-btn" data-id="${resume.id}">
              📄 ${escapeHtml(resume.name)}
            </button>
          `).join('');
    
          const resumeButtons = listContainer.querySelectorAll('.resume-item-btn');
          resumeButtons.forEach(btn => {
            btn.addEventListener('click', (event) => {
              resumeButtons.forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
              
              const targetId = btn.getAttribute('data-id');
              document.getElementById('hiddenResumeId').value = targetId;
              document.getElementById('confirmApplyBtn').disabled = false;
            });
          });

          const confirmBtn = document.getElementById('confirmApplyBtn');
          const newConfirmBtn = confirmBtn.cloneNode(true);
          confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

          newConfirmBtn.addEventListener('click', async () => {
            const selectedResumeId = document.getElementById('hiddenResumeId').value;
            
            if (!selectedResumeId) {
              alert('偵測不到履歷識別碼，請重新選擇一份履歷！');
              return;
            }

            closeResumeModal();
            $('applyBtn').disabled = true;
            $('applyBtn').textContent = '申請傳送中...';

            try {
              const res = await fetch('/api/teams/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: ME.id,
                  team_id: currentTeamId,       
                  resume_id: selectedResumeId   
                })
              });

              const result = await res.json();
              
              if (!res.ok) throw new Error(result.message || '申請失敗');

              alert('申請成功！目前狀態：審核中。');
              
              if (typeof checkAndRenderApplyButton === 'function') {
                await checkAndRenderApplyButton(currentTeamId, ME.id);
              } else {
                $('applyBtn').textContent = '審核中...';
                $('applyBtn').disabled = true;
              }

            } catch (err) {
              alert(err.message);
              resetApplyButton();
            }
          });
        }
    
        resetApplyButton();
        openResumeModal();
    
      } catch (err) {
        alert(err.message);
        resetApplyButton();
      }
    });
    
    function resetApplyButton() {
      if (applyLocked) return;
      setApplicationAvailability({ disabled: false, text: '加入隊伍', lock: false });
    }
  }

  async function checkUserRoleAndRender(team) {
    try {
      const isCreator = await isOwnedByCurrentUser(currentTeamId);
      const isAlreadyMember = getLocalMembers(currentTeamId).some(member => String(member.userId) === String(ME.id));
      const hasPendingApplication = JSON.parse(localStorage.getItem('teamApplications:v1') || '[]').some(app =>
        Number(app.teamId) === Number(currentTeamId) &&
        String(app.userId) === String(ME.id) &&
        app.status === 'pending'
      );

      await renderMemberList(team, isCreator);

      if (isCreator || isAlreadyMember) {
        setApplicationAvailability({ visible: false, disabled: true, text: '已在隊伍中', lock: true, tone: 'member' });
      } else if (hasPendingApplication) {
        setApplicationAvailability({ disabled: true, text: '審核中...', lock: true, tone: 'muted' });
      } else {
        if (!applyLocked) setApplicationAvailability({ disabled: false, text: '加入隊伍', lock: false });
      }

      if (isCreator) {
        document.querySelectorAll('.creator-only-fields').forEach(el => el.removeAttribute('disabled'));
        if ($('editTeamBtn')) $('editTeamBtn').classList.remove('hidden');
        if ($('reviewApplicationsSection')) $('reviewApplicationsSection').classList.remove('hidden');
        
        if (typeof renderReviewList === 'function') {
          renderReviewList(currentTeamId);
        }
      } else {
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

  renderTeamInfo();
  setupEventListeners();
})();

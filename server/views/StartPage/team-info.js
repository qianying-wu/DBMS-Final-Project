// 使用立即執行函式 (IIFE) 包裝，避免內部的變數污染到全域環境
(function(){
  const $ = id => document.getElementById(id);
  
  // 從網址列取得要查看的隊伍 ID (例如：team-info.html?teamId=1)
  const params = new URLSearchParams(location.search);
  const currentTeamId = Number(params.get('teamId') || params.get('id'));
  const userIdParam = params.get('userId') || localStorage.getItem('userId');
  const ME = { id: userIdParam && userIdParam !== 'unknown' ? userIdParam : '9999', name: '你自己' };
  let applyLocked = false;
  let currentTeam = null;
  let currentContest = null;

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

  function getResumeField(resume, keys) {
    for (const key of keys) {
      const value = key.split('.').reduce((obj, part) => obj?.[part], resume);
      if (String(value ?? '').trim()) return String(value).trim();
    }
    return '';
  }

  function validateResumeComplete(resume) {
    const missing = [];
    if (!getResumeField(resume, ['name', 'resume_name', 'data.resume_name'])) missing.push('履歷名稱');
    if (!getResumeField(resume, ['user_pv_name', 'applicantName', 'data.user_pv_name'])) missing.push('姓名');
    if (!getResumeField(resume, ['user_school', 'school', 'data.school'])) missing.push('學校');
    if (!getResumeField(resume, ['user_intro', 'intro', 'data.intro'])) missing.push('自我介紹');
    return { ok: missing.length === 0, missing };
  }

  async function loadCompleteResumeListForApply() {
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': token } : {};
    let res = await fetch('/api/pv/loadPV', { headers });
    if (!res.ok && token && !String(token).startsWith('Bearer ')) {
      res = await fetch('/api/pv/loadPV', { headers: { 'Authorization': `Bearer ${token}` } });
    }
    if (!res.ok) throw new Error('無法取得您的完整履歷資料');
    return await res.json();
  }

  function showTeamInfoAlert(message, type = 'success', onClose) {
    const existingModal = document.getElementById('teamInfoAlertModal');
    if (existingModal) existingModal.remove();

    const isError = type === 'error';
    const modal = document.createElement('div');
    modal.id = 'teamInfoAlertModal';
    modal.className = 'modal';
    modal.style.zIndex = '9999';
    modal.innerHTML = `
      <div class="modal-card team-info-alert-card" role="dialog" aria-modal="true">
        <div class="team-info-alert-icon ${isError ? 'error' : 'success'}">${isError ? '!' : 'OK'}</div>
        <h3>${isError ? '操作失敗' : '操作完成'}</h3>
        <p>${escapeHtml(message)}</p>
        <button id="closeTeamInfoAlertBtn" class="btn primary" type="button">我知道了</button>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('closeTeamInfoAlertBtn')?.addEventListener('click', () => {
      modal.remove();
      if (typeof onClose === 'function') onClose();
    });
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
          role: m.role || '組員',
          resumeId: m.resume_id || ''
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
    memberList.innerHTML = realMembers.map(member => {
      const reviewParams = new URLSearchParams({
        targetUserId: String(member.id),
        teamId: String(team.team_id)
      });
      if (member.resumeId) reviewParams.set('resumeId', String(member.resumeId));

      return `
      <li style="padding: 0; overflow: hidden; border: 1px solid #e6ddd3; border-radius: 8px;">
        <a href="/review.html?${reviewParams.toString()}" 
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
    `;
    }).join('');
  }

  function withUserParam(path){
    const userId = localStorage.getItem('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  function renderTeamDetails(team, contest) {
    currentTeam = team;
    currentContest = contest;

    document.title = `${team.team_name} - 隊伍資料`;
    $('displayTeamName').textContent = team.team_name;
    $('displayContestLabel').textContent = contest.name;
    $('displayContestName').textContent = contest.name;
    $('displayContestDate').textContent = (contest.com_date) ? contest.com_date.split('T')[0] : '日期未定';
    $('displayContestInfo').textContent = contest.com_intro || '尚未提供競賽資料';
    $('displayMemberCount').textContent = team.current_member_count;
    $('displayMaxSlots').textContent = team.num_limit;

    const formattedDemand = team.demand ? team.demand.replace(/(需求|說明|招募)/g, '\n$1') : '尚未填寫隊伍需求。';
    $('displayDesc').style.whiteSpace = 'pre-line';
    $('displayDesc').textContent = formattedDemand;
  }

  function splitTeamDemand(demand) {
    const text = String(demand || '').trim();
    const match = text.match(/(?:^|\n)需求：(.*)$/s);
    if (!match) return { desc: text, skills: '' };

    return {
      desc: text.slice(0, match.index).trim(),
      skills: match[1].trim()
    };
  }

  function fillEditTeamForm(team) {
    const { desc, skills } = splitTeamDemand(team.demand);
    $('editTeamName').value = team.team_name || '';
    $('editTeamSlots').value = team.num_limit || 1;
    $('editTeamSkills').value = skills;
    $('editTeamDesc').value = desc;
    $('editTeamSlots').min = Math.max(Number(team.current_member_count) || 1, 1);
  }

  function openEditTeamModal() {
    if (!currentTeam) return;
    fillEditTeamForm(currentTeam);
    const modal = $('editTeamModal');
    if (modal) modal.style.display = 'flex';
  }

  function closeEditTeamModal() {
    const modal = $('editTeamModal');
    if (modal) modal.style.display = 'none';
  }

  async function renderTeamInfo() {
    const teams = await loadTeams();
    const contests = await loadContests();
    
    const team = teams.find(t => Number(t.team_id) === currentTeamId);
    if (!team) {
      showTeamInfoAlert('找不到該隊伍資訊！', 'error', () => history.back());
      return;
    }

    const contest = contests.find(c => Number(c.id) === Number(team.com_id)) || { name: '未知比賽', com_date: '日期未定', com_intro: '尚未填寫比賽資訊。', officialUrl: '#' };
    renderTeamDetails(team, contest);

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

    if (Number(team.current_member_count) >= Number(team.num_limit)) {
      setApplicationAvailability({
        visible: true,
        disabled: true,
        text: '隊伍已額滿',
        lock: true,
        tone: 'muted'
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

    $('editTeamBtn')?.addEventListener('click', openEditTeamModal);
    $('closeEditTeamModalBtn')?.addEventListener('click', closeEditTeamModal);
    $('cancelEditTeamBtn')?.addEventListener('click', closeEditTeamModal);
    const editTeamModal = $('editTeamModal');
    let editModalMouseDownOnBackdrop = false;
    editTeamModal?.addEventListener('mousedown', (e) => {
      editModalMouseDownOnBackdrop = e.target === editTeamModal;
    });
    editTeamModal?.addEventListener('click', (e) => {
      if (editModalMouseDownOnBackdrop && e.target === editTeamModal) closeEditTeamModal();
      editModalMouseDownOnBackdrop = false;
    });

    $('editTeamForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentTeam) return;

      const teamName = $('editTeamName').value.trim();
      const numLimit = Number($('editTeamSlots').value);
      const skills = $('editTeamSkills').value.trim();
      const desc = $('editTeamDesc').value.trim();
      const currentCount = Number(currentTeam.current_member_count) || 1;

      if (!teamName) {
        showTeamInfoAlert('請輸入隊伍名稱', 'error');
        return;
      }
      if (!skills) {
        showTeamInfoAlert('請輸入「招募需求」', 'error');
        return;
      }
      if (!desc) {
        showTeamInfoAlert('請輸入「主題/說明」', 'error');
        return;
      }
      if (!Number.isInteger(numLimit) || numLimit < currentCount || numLimit > 12) {
        showTeamInfoAlert(`隊伍人數上限需介於 ${currentCount} 到 12 人之間`, 'error');
        return;
      }

      const demand = [desc, `需求：${skills}`].join('\n');

      const saveBtn = $('saveEditTeamBtn');
      const originalText = saveBtn?.textContent;
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '儲存中...';
      }

      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/teams/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': ` ${token || ''}`
          },
          body: JSON.stringify({
            team_id: currentTeamId,
            user_id: ME.id,
            team_name: teamName,
            demand,
            num_limit: numLimit
          })
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.message || '更新隊伍資料失敗');

        const updatedTeam = {
          ...currentTeam,
          ...(result.data || {}),
          demand,
          num_limit: numLimit,
          team_name: teamName
        };
        renderTeamDetails(updatedTeam, currentContest || {});
        await renderMemberList(updatedTeam, true);
        closeEditTeamModal();
        showTeamInfoAlert('隊伍資料已更新');
      } catch (err) {
        showTeamInfoAlert(err.message, 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = originalText || '儲存變更';
        }
      }
    });

    $('applyBtn')?.addEventListener('click', async (e) => {
      e.preventDefault();

      if (applyLocked || $('applyBtn')?.disabled) return;
    
      if (!ME || !ME.id) {
        showTeamInfoAlert('請先登入後再進行申請！', 'error');
        return;
      }
    
      $('applyBtn').disabled = true;
      $('applyBtn').textContent = '讀取履歷清單...';
    
      try {
        const resumeList = await loadCompleteResumeListForApply();

        if (resumeList.length === 0) {
          showTeamInfoAlert('您目前尚未建立任何履歷！請先前往「個人檔案」新增履歷後再行申請。', 'error');
          resetApplyButton();
          return;
        }

        document.getElementById('hiddenResumeId').value = '';
        document.getElementById('confirmApplyBtn').disabled = true;
    
        const listContainer = document.getElementById('resumeListContainer');
        if (listContainer) {
          const decoratedResumes = resumeList.map(resume => ({
            resume,
            validation: validateResumeComplete(resume)
          }));
          const completeResumes = decoratedResumes.filter(item => item.validation.ok);

          listContainer.innerHTML = decoratedResumes.map(({ resume, validation }) => `
            <button type="button" class="resume-item-btn ${validation.ok ? '' : 'is-incomplete'}" data-id="${resume.id}" ${validation.ok ? '' : 'disabled'}>
              <span>📄 ${escapeHtml(resume.name || resume.resume_name || '未命名履歷')}</span>
              ${validation.ok ? '' : `<small>未完成：${escapeHtml(validation.missing.join('、'))}</small>`}
            </button>
          `).join('');

          if (completeResumes.length === 0) {
            listContainer.insertAdjacentHTML('beforeend', '<div class="resume-incomplete-note">目前沒有可送出的完整履歷，請先回個人履歷補齊必填項目。</div>');
          }
    
          const resumeButtons = listContainer.querySelectorAll('.resume-item-btn:not(.is-incomplete)');
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
              showTeamInfoAlert('偵測不到履歷識別碼，請重新選擇一份履歷！', 'error');
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

              showTeamInfoAlert('申請成功！目前狀態：審核中。');
              
              if (typeof checkAndRenderApplyButton === 'function') {
                await checkAndRenderApplyButton(currentTeamId, ME.id);
              } else {
                $('applyBtn').textContent = '審核中...';
                $('applyBtn').disabled = true;
              }

            } catch (err) {
              showTeamInfoAlert(err.message, 'error');
              resetApplyButton();
            }
          });
        }
    
        resetApplyButton();
        openResumeModal();
    
      } catch (err) {
        showTeamInfoAlert(err.message, 'error');
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

      await renderMemberList(team, isCreator);

      if (isCreator) {
        setApplicationAvailability({ visible: false, disabled: true, text: '已在隊伍中', lock: true, tone: 'member' });
      } else {
        await checkAndRenderApplyButton(currentTeamId, ME.id);
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

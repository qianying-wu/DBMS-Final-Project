import * as Data from '../team-data.js';
function showTeamAlert(message, type = 'success') {
  const existingModal = document.getElementById('teamAlertModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'teamAlertModal';
  modal.className = 'team-dialog';

  const isError = type === 'error';
  modal.innerHTML = `
    <div class="team-dialog-card" role="dialog" aria-modal="true">
      <div class="team-dialog-icon ${isError ? 'error' : 'success'}">${isError ? '!' : 'OK'}</div>
      <h3>${isError ? '操作失敗' : '操作完成'}</h3>
      <p>${Data.escapeHtml(message)}</p>
      <button type="button" class="team-dialog-primary" data-dialog-close>我知道了</button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('[data-dialog-close]')?.addEventListener('click', () => modal.remove());
}

function showTeamConfirm(message, { title = '確認操作', okText = '確認', danger = false } = {}) {
  const existingModal = document.getElementById('teamConfirmModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'teamConfirmModal';
  modal.className = 'team-dialog';
  modal.innerHTML = `
    <div class="team-dialog-card" role="dialog" aria-modal="true">
      <div class="team-dialog-icon ${danger ? 'error' : 'warning'}">${danger ? '!' : '?'}</div>
      <h3>${Data.escapeHtml(title)}</h3>
      <p>${Data.escapeHtml(message)}</p>
      <div class="team-dialog-actions">
        <button type="button" class="team-dialog-secondary" data-dialog-cancel>取消</button>
        <button type="button" class="team-dialog-primary ${danger ? 'danger' : ''}" data-dialog-ok>${Data.escapeHtml(okText)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  return new Promise(resolve => {
    const close = value => {
      modal.remove();
      resolve(value);
    };
    modal.querySelector('[data-dialog-cancel]')?.addEventListener('click', () => close(false));
    modal.querySelector('[data-dialog-ok]')?.addEventListener('click', () => close(true));
    modal.addEventListener('click', event => {
      if (event.target === modal) close(false);
    });
  });
}

/**
 * 🚀 主渲染函式：驅動網格卡片與面板外殼
 */
export async function render(gridContainer, token, userId) {
  const joinedUrl = `/api/teams/my-joined?userId=${encodeURIComponent(userId)}`;
  const ownedUrl = `/api/teams/my-owned?userId=${encodeURIComponent(userId)}`;

  const [resJoined, resOwned] = await Promise.all([
    fetch(joinedUrl, { headers: { 'Authorization': ` ${token}` } }),
    fetch(ownedUrl, { headers: { 'Authorization': ` ${token}` } })
  ]);

  const dataJoined = resJoined.ok ? await resJoined.json() : [];
  const dataOwned = resOwned.ok ? await resOwned.json() : [];

  const listJoined = dataJoined.data || dataJoined.teams || (Array.isArray(dataJoined) ? dataJoined : []);
  const listOwned = dataOwned.data || dataOwned.teams || (Array.isArray(dataOwned) ? dataOwned : []);

  const processedOwned = listOwned.map(item => ({ ...item, isApiOwner: true }));
  const processedJoined = listJoined.map(item => ({ ...item, isApiOwner: false }));

  const mergedMap = new Map();
  processedJoined.forEach(item => { const id = item.team_id || item.id; if (id) mergedMap.set(id, item); });
  processedOwned.forEach(item => { const id = item.team_id || item.id; if (id) mergedMap.set(id, item); });

  // 👑 修正點三：拔除所有 LocalStorage 判斷，直接 100% 信任資料庫的 team_status
  // 只顯示正常運作中（通常為 active 或啟用）的隊伍，排除已解散(disbanded)或已完賽(completed)的隊伍
  const teams = Array.from(mergedMap.values()).filter(t => {
    const status = t.team_status || t.teamStatus || t.status;
    return status !== 'disbanded' && status !== 'completed';
  });

  if (teams.length === 0) {
    gridContainer.innerHTML = `<div class="empty-text">目前您尚未加入或建立任何作用中的隊伍。</div>`;
    return;
  }

  const cardsHtml = teams.map(t => {
    const teamId = t.team_id || t.id;
    
    // 👑 修正點二：競賽名稱相容性防禦，防止後端欄位吐出 contest_name 而非 com_name
    const contestName = t.com_name || t.contest_name || t.contestName || '未指定特定競賽';
    
    const currentCount = t.current_member_count ?? t.current_members ?? t.member_count ?? 1;
    const maxCount = t.num_limit ?? t.max_members ?? 5;
    const isCreator = t.isApiOwner || String(t.leader_id) === String(userId);
    const pendingCount = t.pending_count || 0;

    return `
      <div class="team-manage-card" id="team-card-${teamId}">
          <div class="card-top"><h3 class="team-title" style="margin-top: 5px;">${Data.escapeHtml(t.team_name)}</h3></div>
          <div class="card-mid">
              <div class="info-row"><span class="label">競賽項目：</span><span class="val">${Data.escapeHtml(contestName)}</span></div>
              <div class="info-row"><span class="label">目前人數：</span><span class="val">${currentCount} / ${maxCount} 人</span></div>
          </div>
          <div class="card-bottom">
              <button class="btn-manage-action" data-team-id="${teamId}">管理隊伍</button>
              ${isCreator ? `
                <div class="owned-action-row" style="margin-top:8px; display:flex; gap:4px; flex-wrap: wrap;">
                  <button class="btn-secondary-action" data-owned-action="applications" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}">申請審核${pendingCount ? ` (${pendingCount})` : ''}</button>
                  <button class="btn-secondary-action" data-owned-action="members" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}">隊友名單</button>
                  <button class="btn-secondary-action btn-disband-team" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}" data-contest-name="${Data.escapeHtml(contestName)}">解散/完賽</button>
                </div>
              ` : ''}
          </div>
      </div>
    `;
  }).join('');

  gridContainer.innerHTML = `
    <section id="ownedTeamPanel" class="owned-team-panel">
      <div class="empty-text">選擇一支由您建立的隊伍，查看申請審核或隊友名單。</div>
    </section>
    ${cardsHtml}

    <div id="disbandModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(79, 56, 39, 0.4); backdrop-filter: blur(4px); z-index:9999; align-items:center; justify-content:center;">
      <div style="background:#ffffff; padding:32px; border-radius:16px; width:90%; max-width:440px; box-shadow:0 12px 32px rgba(79, 56, 39, 0.15); color:#4f3827; border: 1px solid #eadfd2; box-sizing: border-box;">
        <h3 style="margin-top:0; margin-bottom:12px; border-bottom:1px solid #f0ebe5; padding-bottom:16px; font-size:20px; font-weight:800; color:#4f3827; display:flex; align-items:center; gap:8px;">請選擇變更原因</h3>
        <p style="font-size:14px; color:#8a735e; line-height:1.6; margin-bottom:24px; margin-top:0;">這將會直接變更資料庫中的隊伍狀態。</p>
        <div style="display:flex; flex-direction:column; gap:14px; margin:24px 0;">
          <label style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:#fdfbf9; border:2px solid #caa77a; border-radius:10px; cursor:pointer; font-weight:700; font-size:15px;">
            <input type="radio" name="disbandReason" value="completed" checked style="accent-color:#caa77a; width:18px; height:18px; margin:0;"> 
            順利完賽 <span style="font-weight:normal; font-size:13px; color:#8a735e; margin-left:auto;">（變更狀態為 completed）</span>
          </label>
          <label style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:#fbf9f6; border:2px solid #eadfd2; border-radius:10px; cursor:pointer; font-weight:700; font-size:15px;">
            <input type="radio" name="disbandReason" value="disbanded" style="accent-color:#caa77a; width:18px; height:18px; margin:0;"> 
            解散隊伍 <span style="font-weight:normal; font-size:13px; color:#8a735e; margin-left:auto;">（變更狀態為 disbanded）</span>
          </label>
        </div>
        <div style="display:flex; justify-content:end; gap:10px; margin-top:28px;">
          <button id="btnCancelDisband" type="button" style="padding:10px 22px; background:#ffffff; border:1px solid #d6c2ad; border-radius:8px; color:#7b6a59; cursor:pointer; font-weight:700; font-size:14px;">取消</button>
          <button id="btnConfirmDisband" type="button" style="padding:10px 22px; background:#caa77a; color:#ffffff; border:none; border-radius:8px; cursor:pointer; font-weight:700; font-size:14px;">確認送出</button>
        </div>
      </div>
    </div>
  `;

  // 綁定基本管理跳轉
  gridContainer.querySelectorAll('.btn-manage-action').forEach(btn => {
    btn.addEventListener('click', () => {
      location.href = Data.withUserParam(`/team-info.html?teamId=${btn.dataset.teamId}`);
    });
  });

  // 綁定解散與完賽控制邏輯 (向後端更新狀態)
  const modal = gridContainer.querySelector('#disbandModal');
  let selectedTeamId = null;
  let selectedTeam = null;

  gridContainer.querySelectorAll('.btn-disband-team').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedTeamId = btn.dataset.teamId;
      selectedTeam = teams.find(t => String(t.team_id || t.id) === String(selectedTeamId)) || null;
      modal.style.display = 'flex';
    });
  });

  gridContainer.querySelector('#btnCancelDisband').addEventListener('click', () => { modal.style.display = 'none'; });

  gridContainer.querySelector('#btnConfirmDisband').addEventListener('click', async () => {
    const statusAction = modal.querySelector('input[name="disbandReason"]:checked').value; // 'completed' 或 'disbanded'
    modal.style.display = 'none';

    try {
      // 👑 修正點三：改為發送 POST 請求至後端更新真正的隊伍狀態，不依賴本地快取
      const res = await fetch('/api/teams/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': ` ${token}` },
        body: JSON.stringify({ team_id: selectedTeamId, status: statusAction, user_id: userId })
      });

      if (!res.ok) throw new Error('更新隊伍狀態失敗');

      showTeamAlert(statusAction === 'completed' ? '隊伍已成功標記為順利完賽！' : '隊伍已成功解散。');
      render(gridContainer, token, userId); // 刷新最新網格狀態

    } catch (err) {
      showTeamAlert(err.message, 'error');
    }
  });

  initViewModalEvents();
}

/**
 * 🚀 右側審核面板動態事件代理
 */
export function setupReviewPanelDelegation(refreshCallback) {
  const gridContainer = document.getElementById('teamsGrid');
  if (!gridContainer) return;

  gridContainer.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-owned-action]');
    if (!btn) return;

    const action = btn.dataset.ownedAction;
    const teamId = btn.dataset.teamId;
    const teamName = btn.dataset.teamName;
    const token = localStorage.getItem('token');
    const panel = document.getElementById('ownedTeamPanel');

    if (!panel) return;
    panel.innerHTML = `<div class="loading-placeholder" style="padding:20px; text-align:center; color:#caa77a;">🔍 正在連線讀取【${Data.escapeHtml(teamName)}】...</div>`;

    try {
      const res = await fetch(`/api/teams/detail?teamId=${teamId}`, { headers: { 'Authorization': ` ${token}` } });
      if (!res.ok) throw new Error();
      const result = await res.json();
      const members = result.members || [];

      if (action === 'applications') {
        const applicants = members.filter(m => m.mem_status === '申請中' || m.status === '申請中');
        if (applicants.length === 0) {
          panel.innerHTML = `<div class="panel-header"><h3>👋 申請審核中心：${Data.escapeHtml(teamName)}</h3></div><div class="empty-text">🎉 目前沒有任何待審核的加入申請。</div>`;
          return;
        }

        let html = `<div class="panel-header" style="display:flex; justify-content:space-between;"><h3>👋 申請審核中心：${Data.escapeHtml(teamName)}</h3><span class="role-badge creator">${applicants.length} 筆待處理</span></div><div style="display:grid; gap:12px; margin-top:10px;">`;
        applicants.forEach(a => {
          html += `
            <div class="applicant-card">
              <div><strong>${Data.escapeHtml(a.userName || '未知名稱')}</strong><small style="display:block; color:#8a735e; margin-top:4px;">附帶履歷：${Data.escapeHtml(a.resume_name || '預設履歷')}</small></div>
              <div class="review-action-row">
                <button class="btn-review-action btn-review-view" data-uid="${a.user_id}" type="button">檢視履歷</button>
                <button class="btn-review-action btn-review-pass" data-uid="${a.user_id}" data-team-id="${teamId}" type="button">通過</button>
                <button class="btn-review-action btn-review-reject" data-uid="${a.user_id}" data-team-id="${teamId}" type="button">拒絕</button>
              </div>
            </div>`;
        });
        panel.innerHTML = html + '</div>';
        
        bindReviewActionButtons(panel, refreshCallback);
      }

      if (action === 'members') {
        const activeMembers = members.filter(m => m.mem_status === '通過' || m.status === '通過');
        let html = `<div class="panel-header"><h3>👥 正式隊友名單：${Data.escapeHtml(teamName)}</h3></div><div style="display:grid; gap:8px; margin-top:10px;">`;
        activeMembers.forEach(m => {
          const isLeader = m.role === '建立人';
          html += `<div style="background:#fbfbfb; border:1px solid #eee; padding:12px; border-radius:6px; display:flex; justify-content:space-between;"><strong>${Data.escapeHtml(m.userName || '隊員')}</strong><span class="role-badge">${isLeader ? '建立人' : '組員'}</span></div>`;
        });
        panel.innerHTML = html + '</div>';
      }
    } catch (err) {
      panel.innerHTML = `<div class="empty-text" style="color:red;">載入失敗，請確認伺服器連線。</div>`;
    }
  });
}

/**
 * 👑 審核按鈕控制範範疇
 */
function bindReviewActionButtons(panelContainer, refreshCallback) {
  const token = localStorage.getItem('token');
  const viewCard = document.getElementById('viewResumeDetailCard');

  // 1. 檢視詳細履歷彈窗
  panelContainer.querySelectorAll('.btn-review-view').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetUid = btn.dataset.uid;
      if (!targetUid) {
        showTeamAlert('無法取得該用戶的識別碼', 'error');
        return;
      }

      if (viewCard) viewCard.innerHTML = `<p style="text-align: center; color: #caa77a; font-weight: bold;">⏳ 正在連線資料庫讀取履歷...</p>`;
      
      const viewModal = document.getElementById('viewResumeModal');
      if (viewModal) viewModal.style.display = 'flex';

      try {
        const res = await fetch(`/api/pv/getTargetResume?userId=${encodeURIComponent(targetUid)}`);
        if (res.status === 404) {
          if (viewCard) viewCard.innerHTML = `<p style="text-align: center; color: #cc0000; padding: 20px 0;">❌ 找不到該用戶的履歷資料。</p>`;
          return;
        }
        if (!res.ok) throw new Error();

        const resume = await res.json();
        const tagsHtml = resume.tags && resume.tags.length > 0
          ? `<div class="resume-tags-wrapper">${resume.tags.map(tag => `<span class="resume-tag-badge"># ${Data.escapeHtml(tag)}</span>`).join('')}</div>`
          : `<p style="color:#aaa; font-style:italic; font-size:12px;">(該用戶暫無設定專長標籤)</p>`;

        if (viewCard) {
          viewCard.innerHTML = `
            <h4>📄 ${Data.escapeHtml(resume.name || '未命名履歷')}</h4>
            <p><strong>申請人姓名：</strong>${Data.escapeHtml(resume.applicantName)}</p>
            <p><strong>學校科系：</strong>${Data.escapeHtml(resume.school || '未填寫')}</p>
            <p><strong>年級班別：</strong>${Data.escapeHtml(resume.grade || '未填寫')}</p>
            <p><strong>自我介紹：</strong></p>
            <div style="background:#fff; border:1px solid #eee; padding:10px; border-radius:4px; font-size:13px; max-height:150px; overflow-y:auto; color:#666; white-space: pre-line;">
              ${Data.escapeHtml(resume.intro || '這位夥伴很神秘，尚未填寫自我介紹。')}
            </div>
            <p style="margin-top:10px; margin-bottom:2px;"><strong>專長標籤：</strong></p>
            ${tagsHtml}
          `;
        }
      } catch (err) {
        if (viewCard) viewCard.innerHTML = `<p style="text-align: center; color: #cc0000; padding: 20px 0;">❌ 讀取失敗。</p>`;
      }
    });
  });

  // 2. 👑 修正點一：核准通過按鈕
  panelContainer.querySelectorAll('.btn-review-pass').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await showTeamConfirm('確定要核准此成員加入隊伍嗎？', {
        title: '核准申請',
        okText: '核准加入'
      });
      if (!confirmed) return;
      try {
        const res = await fetch('/api/teams/review', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json', 'Authorization': ` ${token}` }, 
          body: JSON.stringify({ team_id: btn.dataset.teamId, user_id: btn.dataset.uid, action: 'pass' }) 
        });
        
        if (res.ok) { 
          showTeamAlert('已成功核准加入！');
          // 💡 通過成功後，立刻執行 refreshCallback 觸發外部的「主控台網格重渲染」
          // 這將會重新打後端 API，獲取更新後(加 1 人)的最新 current_member_count 欄位！
          if (typeof refreshCallback === 'function') refreshCallback(); 
        }
      } catch (err) { showTeamAlert('運作失敗', 'error'); }
    });
  });

  // 3. 拒絕加入按鈕
  panelContainer.querySelectorAll('.btn-review-reject').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await showTeamConfirm('確定要拒絕此申請嗎？', {
        title: '拒絕申請',
        okText: '拒絕',
        danger: true
      });
      if (!confirmed) return;
      try {
        const res = await fetch('/api/teams/review', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': ` ${token}` }, body: JSON.stringify({ team_id: btn.dataset.teamId, user_id: btn.dataset.uid, action: 'reject' }) });
        if (res.ok) { 
          showTeamAlert('已成功駁回申請。');
          if (typeof refreshCallback === 'function') refreshCallback(); 
        }
      } catch (err) { showTeamAlert('運作失敗', 'error'); }
    });
  });
}

/**
 * 👑 控制檢視視窗關閉事件
 */
function initViewModalEvents() {
  const viewModal = document.getElementById('viewResumeModal');
  if (!viewModal || viewModal.dataset.isBound === 'true') return;

  const closeViewModal = () => { viewModal.style.display = 'none'; };

  document.getElementById('closeViewModalBtn')?.addEventListener('click', closeViewModal);
  document.getElementById('closeViewModalBottomBtn')?.addEventListener('click', closeViewModal);
  viewModal.addEventListener('click', (e) => { if (e.target === viewModal) closeViewModal(); });
  
  viewModal.dataset.isBound = 'true';
}

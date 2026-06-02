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

// 從隊伍詳細資料重新計算目前人數，避免列表 API 的 current_member_count 沒有即時同步。
function countAcceptedMembers(members = []) {
  return members.filter(member => {
    const status = String(member.mem_status || member.status || '').trim();
    const role = String(member.role || '').trim();
    return status === '通過' || role === '建立人';
  }).length;
}

// 卡片顯示前補抓隊伍 detail，讓「目前人數」與「待審核數」都以最新成員資料為準。
async function enrichTeamsWithLiveMemberCounts(teams, token) {
  const enrichedTeams = await Promise.all(teams.map(async team => {
    const teamId = team.team_id || team.id;
    if (!teamId) return team;

    try {
      const res = await fetch(`/api/teams/detail?teamId=${encodeURIComponent(teamId)}`, {
        headers: { 'Authorization': ` ${token}` }
      });
      if (!res.ok) throw new Error('讀取隊伍詳細資料失敗');

      const result = await res.json();
      const members = result.members || [];
      const acceptedCount = countAcceptedMembers(members);
      const pendingCount = members.filter(member => {
        const status = String(member.mem_status || member.status || '').trim();
        return status === '申請中';
      }).length;

      return {
        ...team,
        current_member_count: acceptedCount || team.current_member_count || team.current_members || team.member_count || 1,
        pending_count: pendingCount
      };
    } catch (err) {
      console.warn('隊伍人數重新計算失敗，暫用原本列表資料:', teamId, err);
      return team;
    }
  }));

  return enrichedTeams;
}

/**
 * 🚀 主渲染函式：驅動網格卡片與面板外殼
 */
export async function render(gridContainer, token, userId) {
  // 將 userId 存起來，後續面板操作會用到
  gridContainer.dataset.currentUserId = userId; 

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

  // 只顯示正常運作中的隊伍
  const activeTeams = Array.from(mergedMap.values()).filter(t => {
    const status = t.team_status || t.teamStatus || t.status;
    return status !== 'disbanded' && status !== 'completed';
  });
  const teams = await enrichTeamsWithLiveMemberCounts(activeTeams, token);

  if (teams.length === 0) {
    gridContainer.innerHTML = `<div class="empty-text">目前您尚未加入或建立任何作用中的隊伍。</div>`;
    return;
  }

  // 判斷某支隊伍是否由目前使用者建立，通知區與隊長功能都會用到。
  const isTeamCreator = team => team.isApiOwner || String(team.leader_id) === String(userId);

  // 統整待審核申請，讓隊長一進「我的隊伍」就知道哪個比賽的哪支隊伍有人申請。
  const pendingTeams = teams
    .filter(team => isTeamCreator(team) && Number(team.pending_count || 0) > 0)
    .map(team => ({
      teamId: team.team_id || team.id,
      teamName: team.team_name,
      contestName: team.com_name || team.contest_name || team.contestName || '未指定特定競賽',
      pendingCount: Number(team.pending_count || 0)
    }));

  const noticeHtml = pendingTeams.length > 0 ? `
    <section class="team-application-notice" aria-label="待審核申請提醒">
      <div class="notice-copy">
        <span class="notice-kicker">待處理申請</span>
        <h3>有 ${pendingTeams.reduce((sum, team) => sum + team.pendingCount, 0)} 位使用者想加入你的隊伍</h3>
        <p>點擊下方提醒可以直接查看對應比賽與隊伍的申請審核。</p>
      </div>
      <div class="notice-list">
        ${pendingTeams.map(team => `
          <button class="notice-item" type="button" data-open-applications data-team-id="${team.teamId}" data-team-name="${Data.escapeHtml(team.teamName)}">
            <span class="notice-team">${Data.escapeHtml(team.teamName)}</span>
            <span class="notice-contest">${Data.escapeHtml(team.contestName)}</span>
            <strong>${team.pendingCount} 筆</strong>
          </button>
        `).join('')}
      </div>
    </section>
  ` : '';

  const cardsHtml = teams.map(t => {
    const teamId = t.team_id || t.id;
    const contestName = t.com_name || t.contest_name || t.contestName || '未指定特定競賽';
    const currentCount = t.current_member_count ?? t.current_members ?? t.member_count ?? 1;
    const maxCount = t.num_limit ?? t.max_members ?? 5;
    const isCreator = isTeamCreator(t);
    const pendingCount = t.pending_count || 0;

    return `
      <div class="team-manage-card ${pendingCount && isCreator ? 'has-pending-applications' : ''}" id="team-card-${teamId}">
      <div class="card-top">
        ${pendingCount && isCreator ? `<span class="pending-badge">${pendingCount} 筆待審核</span>` : ''}
        <h3 class="team-title" style="margin-top: 5px;">${Data.escapeHtml(t.team_name)}</h3>
      </div>
      <div class="card-mid">
          <div class="info-row"><span class="label">競賽項目：</span><span class="val">${Data.escapeHtml(contestName)}</span></div>
          <div class="info-row"><span class="label">目前人數：</span><span class="val">${currentCount} / ${maxCount} 人</span></div>
      </div>
      <div class="card-bottom">
          <button class="btn-manage-action ${isCreator ? '' : 'btn-view-only'}" 
                  data-team-id="${teamId}">
              ${isCreator ? '管理隊伍' : '查看隊伍'}
          </button>

          ${isCreator ? `
            <div class="owned-action-row" style="margin-top:8px; display:flex; gap:4px; flex-wrap: wrap;">
              <button class="btn-secondary-action" data-owned-action="members" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}">隊友名單</button>
              <button class="btn-secondary-action ${pendingCount ? 'has-pending' : ''}" data-owned-action="applications" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}">申請審核${pendingCount ? `<span class="button-count">${pendingCount}</span>` : ''}</button>
              <button class="btn-secondary-action btn-disband-team" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}" data-contest-name="${Data.escapeHtml(contestName)}">解散/完賽</button>
            </div>
          ` : `
             <div class="owned-action-row" style="margin-top:8px; display:flex; gap:4px; flex-wrap: wrap; justify-content:left;">
                <button class="btn-secondary-action" data-owned-action="members" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}">隊友名單</button>
                <div style="margin-top: auto; padding-top: 12px;">
                  <span style="font-size: 13px; color: #a89a8e; font-style: italic; display: block;"> ※非隊長無法審核申請或解散隊伍 </span>
                </div>
             </div>
          `}
      </div>
  </div>
    `;
  }).join('');

  gridContainer.innerHTML = `
    ${noticeHtml}
    <section id="ownedTeamPanel" class="owned-team-panel">
      <div class="empty-text">選擇一支隊伍，查看申請審核或隊友名單。</div>
    </section>
    ${cardsHtml}

    <div id="disbandModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(79, 56, 39, 0.4); backdrop-filter: blur(4px); z-index:9999; align-items:center; justify-content:center;">
      <div style="background:#ffffff; padding:32px; border-radius:16px; width:90%; max-width:440px; box-shadow:0 12px 32px rgba(79, 56, 39, 0.15); color:#4f3827; border: 1px solid #eadfd2; box-sizing: border-box;">
        <h3 style="margin-top:0; margin-bottom:12px; border-bottom:1px solid #f0ebe5; padding-bottom:16px; font-size:20px; font-weight:800; color:#4f3827; display:flex; align-items:center; gap:8px;">請選擇變更原因</h3>
        <p style="font-size:14px; color:#8a735e; line-height:1.6; margin-bottom:24px; margin-top:0;">順利完賽的隊伍會在歷史紀錄中留存且可互相評價。</p>
        <div style="display:flex; flex-direction:column; gap:14px; margin:24px 0;">
          <label style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:#fdfbf9; border:2px solid #caa77a; border-radius:10px; cursor:pointer; font-weight:700; font-size:15px;">
            <input type="radio" name="disbandReason" value="completed" checked style="accent-color:#caa77a; width:18px; height:18px; margin:0;"> 
            順利完賽 <span style="font-weight:normal; font-size:13px; color:#8a735e; margin-left:auto;">（移至歷史紀錄隊伍）</span>
          </label>
          <label style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:#fbf9f6; border:2px solid #eadfd2; border-radius:10px; cursor:pointer; font-weight:700; font-size:15px;">
            <input type="radio" name="disbandReason" value="disbanded" style="accent-color:#caa77a; width:18px; height:18px; margin:0;"> 
            解散隊伍 <span style="font-weight:normal; font-size:13px; color:#8a735e; margin-left:auto;">（將會徹底刪除隊伍）</span>
          </label>
        </div>
        <div style="display:flex; justify-content:end; gap:10px; margin-top:28px;">
          <button id="btnCancelDisband" type="button" style="padding:10px 22px; background:#ffffff; border:1px solid #d6c2ad; border-radius:8px; color:#7b6a59; cursor:pointer; font-weight:700; font-size:14px;">取消</button>
          <button id="btnConfirmDisband" type="button" style="padding:10px 22px; background:#caa77a; color:#ffffff; border:none; border-radius:8px; cursor:pointer; font-weight:700; font-size:14px;">確認送出</button>
        </div>
      </div>
    </div>
  `;

  // 點擊上方提醒時，自動打開對應隊伍的申請審核面板。
  gridContainer.querySelectorAll('[data-open-applications]').forEach(btn => {
    btn.addEventListener('click', () => {
      const reviewButton = gridContainer.querySelector(`[data-owned-action="applications"][data-team-id="${btn.dataset.teamId}"]`);
      reviewButton?.click();
      document.getElementById('ownedTeamPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // 綁定基本管理跳轉
  gridContainer.querySelectorAll('.btn-manage-action').forEach(btn => {
    btn.addEventListener('click', () => {
      location.href = Data.withUserParam(`/team-info.html?teamId=${btn.dataset.teamId}`);
    });
  });

  // 綁定解散與完賽控制邏輯
  const modal = gridContainer.querySelector('#disbandModal');
  let selectedTeamId = null;

  gridContainer.querySelectorAll('.btn-disband-team').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedTeamId = btn.dataset.teamId;
      modal.style.display = 'flex';
    });
  });

  gridContainer.querySelector('#btnCancelDisband').addEventListener('click', () => { modal.style.display = 'none'; });

  gridContainer.querySelector('#btnConfirmDisband').addEventListener('click', async () => {
    const statusAction = modal.querySelector('input[name="disbandReason"]:checked').value;
    modal.style.display = 'none';

    try {
      const res = await fetch('/api/teams/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': ` ${token}` },
        body: JSON.stringify({ team_id: selectedTeamId, status: statusAction, user_id: userId })
      });

      if (!res.ok) throw new Error('更新隊伍狀態失敗');

      showTeamAlert(statusAction === 'completed' ? '隊伍已成功標記為順利完賽！' : '隊伍已成功解散。');
      render(gridContainer, token, userId); 

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
    const currentUserId = gridContainer.dataset.currentUserId; // 從主容器拿目前登入者的 ID

    if (!panel) return;
    panel.innerHTML = `<div class="loading-placeholder" style="padding:20px; text-align:center; color:#caa77a;">🔍 正在連線讀取【${Data.escapeHtml(teamName)}】...</div>`;

    try {
      const res = await fetch(`/api/teams/detail?teamId=${teamId}`, { headers: { 'Authorization': ` ${token}` } });
      if (!res.ok) throw new Error();
      const result = await res.json();
      const members = result.members || [];

      // 判斷當前使用者是不是這隊的隊長 (假設建立人 role 為 '建立人')
      const isCurrentUserOwner = members.some(m => String(m.user_id) === String(currentUserId) && m.role === '建立人');

      if (action === 'applications') {
        const applicants = members.filter(m => m.mem_status === '申請中' || m.status === '申請中');
        if (applicants.length === 0) {
          panel.innerHTML = `<div class="panel-header"><h3>👋隊伍【${Data.escapeHtml(teamName)}】的申請審核中心</h3></div><div class="empty-text">🎉 目前沒有任何待審核的加入申請。</div>`;
          return;
        }

        let html = `<div class="panel-header" style="display:flex; justify-content:space-between;"><h3>👋隊伍【${Data.escapeHtml(teamName)}】的申請審核中心</h3><span class="role-badge creator">${applicants.length} 筆待處理</span></div><div style="display:grid; gap:12px; margin-top:10px;">`;
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
        const activeMembers = members.filter(m => {
          const status = String(m.mem_status || m.status || '').trim();
          const role = String(m.role || '').trim();
          return status === '通過' || role === '建立人';
        });
        let html = `<div class="panel-header"><h3>👥隊伍【${Data.escapeHtml(teamName)}】的正式隊友名單</h3></div><div style="display:grid; gap:8px; margin-top:10px;">`;
        
        activeMembers.forEach(m => {
          const isLeader = m.role === '建立人';
          let actionButtonHtml = '';

          // 判斷要長出踢人還是退隊按鈕
          if (isCurrentUserOwner && String(m.user_id) !== String(currentUserId)) {
              // 隊長看別人 -> 踢出
              actionButtonHtml = `<button class="btn-member-action btn-kick" data-team-id="${teamId}" data-uid="${m.user_id}" style="padding:4px 8px; font-size:12px; border-radius:4px; border:1px solid #cc0000; background:#fff; color:#cc0000; cursor:pointer;">剔除</button>`;
          } else if (!isCurrentUserOwner && String(m.user_id) === String(currentUserId)) {
              // 成員看自己 -> 退出
              actionButtonHtml = `<button class="btn-member-action btn-leave" data-team-id="${teamId}" data-uid="${m.user_id}" style="padding:4px 8px; font-size:12px; border-radius:4px; border:1px solid #e68a00; background:#fff; color:#e68a00; cursor:pointer;">退出隊伍</button>`;
          }

          html += `
            <div style="background:#fbfbfb; border:1px solid #eee; padding:12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>${Data.escapeHtml(m.userName || '隊員')}</strong>
                <span class="role-badge" style="margin-left:8px;">${isLeader ? '建立人' : '組員'}</span>
              </div>
              <div>${actionButtonHtml}</div>
            </div>`;
        });
        panel.innerHTML = html + '</div>';
        
        // 綁定踢人/退隊按鈕事件
        bindMemberActionButtons(panel, currentUserId, refreshCallback);
      }
    } catch (err) {
      panel.innerHTML = `<div class="empty-text" style="color:red;">載入失敗，請確認伺服器連線。</div>`;
    }
  });
}

/**
 * 👑 綁定踢出/退出按鈕邏輯
 */
function bindMemberActionButtons(panelContainer, currentUserId, refreshCallback) {
    const token = localStorage.getItem('token');

    // 踢人按鈕 (隊長專屬)
    panelContainer.querySelectorAll('.btn-kick').forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetId = btn.dataset.uid;
            const teamId = btn.dataset.teamId;

            const confirmed = await showTeamConfirm('確定要將此成員剔除嗎？', {
                title: '剔除成員',
                okText: '確定剔除',
                danger: true
            });
            if (!confirmed) return;

            try {
                const res = await fetch('/api/teams/remove-member', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': ` ${token}` },
                    body: JSON.stringify({ team_id: teamId, target_user_id: targetId, requester_user_id: currentUserId })
                });

                const result = await res.json();
                if (res.ok && result.success) {
                    showTeamAlert(result.message);
                    if (typeof refreshCallback === 'function') refreshCallback();
                } else {
                    showTeamAlert(result.message || '操作失敗', 'error');
                }
            } catch (err) {
                showTeamAlert('運作失敗，請確認網路狀態', 'error');
            }
        });
    });

    // 退出按鈕 (組員專屬)
    panelContainer.querySelectorAll('.btn-leave').forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetId = btn.dataset.uid;
            const teamId = btn.dataset.teamId;

            const confirmed = await showTeamConfirm('確定要退出這個隊伍嗎？退出後需重新申請。', {
                title: '退出隊伍',
                okText: '確定退出',
                danger: true
            });
            if (!confirmed) return;

            try {
                const res = await fetch('/api/teams/remove-member', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': ` ${token}` },
                    body: JSON.stringify({ team_id: teamId, target_user_id: targetId, requester_user_id: currentUserId })
                });

                const result = await res.json();
                if (res.ok && result.success) {
                    showTeamAlert(result.message);
                    if (typeof refreshCallback === 'function') refreshCallback();
                } else {
                    showTeamAlert(result.message || '操作失敗', 'error');
                }
            } catch (err) {
                showTeamAlert('運作失敗，請確認網路狀態', 'error');
            }
        });
    });
}

/**
 * 👑 審核按鈕控制範疇
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
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': token } : {};
        const res = await fetch(`/api/pv/getTargetResume?userId=${encodeURIComponent(targetUid)}`, { headers });
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
            <p><strong>學校：</strong>${Data.escapeHtml(resume.school || '未填寫')}</p>
            <p><strong>系級：</strong>${Data.escapeHtml(resume.grade || '未填寫')}</p>
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

  // 2. 核准通過按鈕
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

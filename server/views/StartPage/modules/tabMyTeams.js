import * as Data from '../team-data.js';

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

  // 🚀 核心修改：從 localStorage 讀取已被本地解散或完賽的隊伍清單
  const localDisbandedStatus = JSON.parse(localStorage.getItem('local_team_status') || '{}');

  const teams = Array.from(mergedMap.values()).filter(t => {
    const teamId = t.team_id || t.id;
    // 如果後端本來就是 disbanded，或者前端本地紀錄它是 disbanded / completed，就過濾掉不顯示
    const isLocalRemoved = localDisbandedStatus[teamId] === 'disbanded' || localDisbandedStatus[teamId] === 'completed';
    return t.team_status !== 'disbanded' && t.status !== 'disbanded' && !isLocalRemoved;
  });

  if (teams.length === 0) {
    gridContainer.innerHTML = `<div class="empty-text">目前您尚未加入或建立任何作用中的隊伍。</div>`;
    return;
  }

  const cardsHtml = teams.map(t => {
    const teamId = t.team_id || t.id;
    const contestName = t.com_name || '未指定特定競賽';
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

    <div id="disbandModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(79, 56, 39, 0.4); backdrop-filter: blur(4px); z-index:9999; align-items:center; justify-content:center; animation: fadeIn 0.2s ease-out;">
      <div style="background:#ffffff; padding:32px; border-radius:16px; width:90%; max-width:440px; box-shadow:0 12px 32px rgba(79, 56, 39, 0.15); color:#4f3827; border: 1px solid #eadfd2; box-sizing: border-box;">
        
        <h3 style="margin-top:0; margin-bottom:12px; border-bottom:1px solid #f0ebe5; padding-bottom:16px; font-size:20px; font-weight:800; color:#4f3827; display:flex; align-items:center; gap:8px;">
          請選擇解散原因
        </h3>
        
        <p style="font-size:14px; color:#8a735e; line-height:1.6; margin-bottom:24px; margin-top:0;">
          原因將決定隊伍是否歸入「歷史紀錄」，並開啟隊友評價。
        </p>
        
        <div style="display:flex; flex-direction:column; gap:14px; margin:24px 0;">
          <label style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:#fdfbf9; border:2px solid #caa77a; border-radius:10px; cursor:pointer; transition: all 0.2s ease; font-weight:700; font-size:15px;">
            <input type="radio" name="disbandReason" value="completed" checked style="accent-color:#caa77a; width:18px; height:18px; margin:0;"> 
            <span style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; background:rgba(202, 167, 122, 0.15); color:#b08953; flex-shrink:0;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a5 5 0 0 1 5 5v4a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"/></svg>
            </span> 
            順利完賽 <span style="font-weight:normal; font-size:13px; color:#8a735e; margin-left:auto;">（移至歷史紀錄）</span>
          </label>
          
          <label style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:#fbf9f6; border:2px solid #eadfd2; border-radius:10px; cursor:pointer; transition: all 0.2s ease; font-weight:700; font-size:15px;">
            <input type="radio" name="disbandReason" value="other" style="accent-color:#caa77a; width:18px; height:18px; margin:0;"> 
            <span style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; background:rgba(186, 114, 91, 0.12); color:#a05a48; flex-shrink:0;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </span> 
            其他原因 <span style="font-weight:normal; font-size:13px; color:#8a735e; margin-left:auto;">（如中途取消）</span>
          </label>
        </div>
        
        <div style="display:flex; justify-content:end; gap:10px; margin-top:28px;">
          <button id="btnCancelDisband" type="button" style="padding:10px 22px; background:#ffffff; border:1px solid #d6c2ad; border-radius:8px; color:#7b6a59; cursor:pointer; font-weight:700; font-size:14px; transition:all 0.2s ease;" onmouseover="this.style.background='#fbf9f6'; this.style.borderColor='#caa77a';" onmouseout="this.style.background='#ffffff'; this.style.borderColor='#d6c2ad';">
            取消
          </button>
          <button id="btnConfirmDisband" type="button" style="padding:10px 22px; background:#caa77a; color:#ffffff; border:none; border-radius:8px; cursor:pointer; font-weight:700; font-size:14px; box-shadow: 0 4px 10px rgba(202, 167, 122, 0.25); transition:all 0.2s ease;" onmouseover="this.style.background='#4f3827'; this.style.boxShadow='0 4px 12px rgba(79, 56, 39, 0.2)';" onmouseout="this.style.background='#caa77a'; this.style.boxShadow='0 4px 10px rgba(202, 167, 122, 0.25)';">
            確認送出
          </button>
        </div>
        
      </div>
    </div>
  `;

  // 綁定基礎按鈕
  gridContainer.querySelectorAll('.btn-manage-action').forEach(btn => {
    btn.addEventListener('click', () => {
      location.href = Data.withUserParam(`/team-info.html?teamId=${btn.dataset.teamId}`);
    });
  });

  const modal = gridContainer.querySelector('#disbandModal');
  let selectedTeamId = null;
  let selectedTeamObj = null;

  gridContainer.querySelectorAll('.btn-disband-team').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedTeamId = btn.dataset.teamId;
      // 把基本資訊也記下來，到時候塞進歷史紀錄用，就不用再重新呼叫 API 撈取
      selectedTeamObj = {
        team_id: selectedTeamId,
        team_name: btn.dataset.teamName,
        com_name: btn.dataset.contestName
      };
      modal.style.display = 'flex';
    });
  });

  gridContainer.querySelector('#btnCancelDisband').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  gridContainer.querySelector('#btnConfirmDisband').addEventListener('click', () => {
    const reasonType = modal.querySelector('input[name="disbandReason"]:checked').value;
    modal.style.display = 'none';

    // 🚀 核心修改 2：純前端紀錄狀態到 localStorage 
    const localStatus = JSON.parse(localStorage.getItem('local_team_status') || '{}');
    localStatus[selectedTeamId] = reasonType; // 可能是 'completed' 或 'other'
    localStorage.setItem('local_team_status', JSON.stringify(localStatus));

    // 如果是順利完賽，我們把隊伍的卡片快取存起來，方便歷史分頁抓取
    if (reasonType === 'completed') {
      const localHistoryList = JSON.parse(localStorage.getItem('local_history_teams') || '[]');
      // 避免重複加入
      if (!localHistoryList.some(item => item.team_id === selectedTeamId)) {
        localHistoryList.push(selectedTeamObj);
        localStorage.setItem('local_history_teams', JSON.stringify(localHistoryList));
      }
      alert('隊伍已標記為順利完賽！可至歷史紀錄查看。');
    } else {
      alert('隊伍已成功解散。');
    }

    render(gridContainer, token, userId); // 重新刷新當前畫面
  });
}
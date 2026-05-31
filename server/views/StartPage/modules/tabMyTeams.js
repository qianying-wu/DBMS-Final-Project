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

  const teams = Array.from(mergedMap.values());

  if (teams.length === 0) {
    gridContainer.innerHTML = `<div class="empty-text">目前您尚未建立或加入任何隊伍。</div>`;
    return;
  }

  // 渲染
  const cardsHtml = teams.map(t => {
    const isCreator = t.isApiOwner === true || String(t.owner_id) === String(userId);
    const teamId = t.team_id || t.id;
    const pendingCount = getLocalApplications(teamId).filter(app => app.status === 'pending').length;
    const badgeHtml = isCreator ? `<span class="role-badge creator">我創立</span>` : `<span class="role-badge member">已加入</span>`;

    const contestName = t.com_name || '未指定特定競賽';
    const currentCount = t.current_member_count ?? t.current_members ?? t.member_count ?? 1;
    const maxCount = t.num_limit ?? t.max_members ?? 5;

    return `
      <div class="team-manage-card">
          <div class="card-top">${badgeHtml}<h3 class="team-title">${Data.escapeHtml(t.team_name)}</h3></div>
          <div class="card-mid">
              <div class="info-row"><span class="label">競賽項目：</span><span class="val">${Data.escapeHtml(contestName)}</span></div>
              <div class="info-row"><span class="label">目前人數：</span><span class="val">${currentCount} / ${maxCount} 人</span></div>
          </div>
          <div class="card-bottom">
              <button class="btn-manage-action" data-team-id="${teamId}">管理隊伍</button>
              ${isCreator ? `
                <div class="owned-action-row" style="margin-top:8px; display:flex; gap:4px;">
                  <button class="btn-secondary-action" data-owned-action="applications" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}">申請審核${pendingCount ? ` (${pendingCount})` : ''}</button>
                  <button class="btn-secondary-action" data-owned-action="members" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(t.team_name)}">隊友名單</button>
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
  `;

  // 綁定基礎按手
  gridContainer.querySelectorAll('.btn-manage-action').forEach(btn => {
    btn.addEventListener('click', () => {
      location.href = Data.withUserParam(`/team-info.html?teamId=${btn.dataset.teamId}`);
    });
  });
}

// 內部輔助 LocalStorage 函式
function getLocalApplications(teamId) {
  return JSON.parse(localStorage.getItem('teamApplications:v1') || '[]').filter(app => Number(app.teamId) === Number(teamId));
}
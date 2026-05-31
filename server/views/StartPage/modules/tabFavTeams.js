import * as Data from '../team-data.js';

export async function render(gridContainer, token, userId) {
  const res = await fetch(`/api/teams/my-favorites?userId=${encodeURIComponent(userId)}`, {
    headers: { 'Authorization': ` ${token}` }
  });
  if (!res.ok) throw new Error('API 回傳失敗');
  const result = await res.json();
  const favTeams = result.data || result.teams || (Array.isArray(result) ? result : []);

  if (favTeams.length === 0) {
    gridContainer.innerHTML = `<div class="empty-text">目前您尚未收藏任何隊伍。</div>`;
    return;
  }

  gridContainer.innerHTML = favTeams.map(t => {
    const contestName = t.com_name || '未指定特定競賽';
    const currentCount = t.current_member_count ?? t.current_members ?? t.member_count ?? 1;
    const maxCount = t.num_limit ?? t.max_members ?? 5;

    return `
      <div class="team-manage-card">
          <div class="card-top"><h3 class="team-title" style="margin-top: 5px;">${Data.escapeHtml(t.team_name)}</h3></div>
          <div class="card-mid">
              <div class="info-row"><span class="label">競賽項目：</span><span class="val">${Data.escapeHtml(contestName)}</span></div>
              <div class="info-row"><span class="label">目前人數：</span><span class="val">${currentCount} / ${maxCount} 人</span></div>
          </div>
          <div class="card-bottom"><button class="btn-manage-action" data-team-id="${t.team_id || t.id}">查看隊伍</button></div>
      </div>
    `;
  }).join('');

  gridContainer.querySelectorAll('.btn-manage-action').forEach(btn => {
    btn.addEventListener('click', () => {
      location.href = Data.withUserParam(`/team-info.html?teamId=${btn.dataset.teamId}`);
    });
  });
}
import * as Data from '../team-data.js';

async function loadDatabaseTeams() {
  try {
    const res = await fetch('/api/teams/all');
    if (!res.ok) throw new Error('無法取得完整隊伍資料');
    const result = await res.json();
    return result.teams || result.data || (Array.isArray(result) ? result : []);
  } catch (error) {
    console.error('❌ 收藏隊伍補齊比賽資料失敗:', error);
    return [];
  }
}

function getTeamId(team) {
  return team?.team_id || team?.id;
}

// 收藏隊伍列表也要顯示即時人數，因此用 detail 裡的成員狀態重新計算。
async function getLiveMemberCount(teamId, token) {
  try {
    const res = await fetch(`/api/teams/detail?teamId=${encodeURIComponent(teamId)}`, {
      headers: { 'Authorization': ` ${token}` }
    });
    if (!res.ok) throw new Error('無法取得隊伍詳細資料');

    const result = await res.json();
    const members = result.members || [];
    return members.filter(member => {
      const status = String(member.mem_status || member.status || '').trim();
      const role = String(member.role || '').trim();
      return status === '通過' || role === '建立人';
    }).length;
  } catch (error) {
    console.warn('收藏隊伍即時人數計算失敗，改用原本資料:', teamId, error);
    return null;
  }
}

function mergeFavoriteWithDatabaseTeam(favoriteTeam, databaseTeams) {
  const favoriteTeamId = getTeamId(favoriteTeam);
  const databaseTeam = databaseTeams.find(team => Number(getTeamId(team)) === Number(favoriteTeamId)) || {};

  // my-favorites 只回收藏關係的基本欄位；完整 Team 資料才有 com_id / contestName / 人數。
  return {
    ...databaseTeam,
    ...favoriteTeam,
    com_id: favoriteTeam.com_id || databaseTeam.com_id,
    contestName: favoriteTeam.contestName || favoriteTeam.contest_name || favoriteTeam.com_name || databaseTeam.contestName || databaseTeam.contest_name || databaseTeam.com_name,
    current_member_count: favoriteTeam.current_member_count ?? databaseTeam.current_member_count,
    num_limit: favoriteTeam.num_limit ?? databaseTeam.num_limit
  };
}

export async function render(gridContainer, token, userId) {
  const [res, databaseTeams] = await Promise.all([
    fetch(`/api/teams/my-favorites?userId=${encodeURIComponent(userId)}`, {
      headers: { 'Authorization': ` ${token}` }
    }),
    loadDatabaseTeams()
  ]);

  if (!res.ok) throw new Error('API 回傳失敗');
  const result = await res.json();
  const favTeams = (result.data || result.teams || (Array.isArray(result) ? result : []))
    .map(team => mergeFavoriteWithDatabaseTeam(team, databaseTeams));

  const favTeamsWithLiveCounts = await Promise.all(favTeams.map(async team => {
    const liveCount = await getLiveMemberCount(getTeamId(team), token);
    return liveCount == null ? team : { ...team, current_member_count: liveCount };
  }));

  if (favTeamsWithLiveCounts.length === 0) {
    gridContainer.innerHTML = `<div class="empty-text">目前您尚未收藏任何隊伍。</div>`;
    return;
  }

  gridContainer.innerHTML = favTeamsWithLiveCounts.map(t => {
    const contestName = t.contestName || t.contest_name || t.com_name || '未指定特定競賽';
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

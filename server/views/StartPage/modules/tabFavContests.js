import * as Data from '../team-data.js';

export async function render(gridContainer, allContestsData, setAllContestsData) {
  let contests = allContestsData;
  if (!contests || contests.length === 0) {
    const res = await fetch('/api/contests/competitions');
    if (res.ok) {
      const result = await res.json();
      contests = result.competitions || result || [];
      setAllContestsData(contests);
    }
  }

  const contestFavs = JSON.parse(localStorage.getItem('favoriteContests') || '[]');
  const favContests = contests.filter(c => contestFavs.includes(Number(c.id || c.com_id)));

  if (favContests.length === 0) {
    gridContainer.innerHTML = `<div class="empty-text">目前暫無收藏的比賽。快去首頁逛逛吧！</div>`;
    return;
  }

  gridContainer.innerHTML = favContests.map(c => {
    const cId = c.com_id || c.id;
    const cName = c.com_name || c.name || '未命名比賽';
    const cIntro = c.com_intro || '尚未填寫比賽說明';

    return `
      <div class="team-manage-card" style="border-left: 4px solid #caa77a;">
          <div class="card-top"><h3 class="team-title" style="margin-top: 5px;">${Data.escapeHtml(cName)}</h3></div>
          <div class="card-mid">
              <div class="info-row"><span class="label">簡介：</span><span class="val" style="font-weight:400; color:#666;">${Data.escapeHtml(cIntro.substring(0, 50))}...</span></div>
          </div>
          <div class="card-bottom"><button class="btn-contest-action" data-contest-id="${cId}" style="width: 100%; background-color: #caa77a; color: white; border: none; padding: 10px 0; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer;">前往比賽詳情 →</button></div>
      </div>
    `;
  }).join('');

  gridContainer.querySelectorAll('.btn-contest-action').forEach(btn => {
    btn.addEventListener('click', () => {
      location.href = Data.withUserParam(`/contest.html?id=${btn.dataset.contestId}`);
    });
  });
}
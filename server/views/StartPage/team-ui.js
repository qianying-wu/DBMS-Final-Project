import { escapeHtml, withUserParam, currentUserId, ME, loadFavorites} from './team-data.js';

// 渲染側邊欄區塊：包含「我加入的隊伍」、「我收藏的隊伍」以及「我管理的隊伍」
export function renderSidebarTeams(teams) {
  const myJoinedTeams = document.getElementById('myJoinedTeams');
  const myOwnedTeams = document.getElementById('myOwnedTeams');
  const myFavsEl = document.getElementById('myFavs');
  if (!myJoinedTeams || !myOwnedTeams) return;

  // 1. 處理並渲染「我加入的隊伍」
  const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`) || '[]');
  const joined = joinedIds.map(id => teams.find(team => Number(team.id) === Number(id))).filter(Boolean);
  myJoinedTeams.innerHTML = joined.length ? `<ul class="managed-list">${joined.map(team => `<li><span>${escapeHtml(team.name)}</span></li>`).join('')}</ul>` : '尚未加入隊伍';

  // 2. 處理並渲染「我的收藏 (隊伍)」
  const favs = loadFavorites();
  const favEls = favs.map(id => {
    const team = teams.find(item => item.id === id);
    return team ? `<li><strong>${escapeHtml(team.name)}</strong></li>` : null;
  }).filter(Boolean);
  if (myFavsEl) myFavsEl.innerHTML = favEls.length ? `<ul class="fav-list">${favEls.join('')}</ul>` : '尚無收藏隊伍';

  // 3. 處理並渲染「我建立的隊伍」
  const owned = teams.filter(team => String(team.owner) === String(currentUserId) || (String(currentUserId) === String(ME.id) && Number(team.owner) === Number(ME.id)));
  if (!owned.length) {
    myOwnedTeams.textContent = '尚未建立隊伍';
    return;
  }

  // 渲染建立的隊伍，並顯示目前有多少待處理的「加入請求 (pending)」
  const reqs = JSON.parse(localStorage.getItem('joinRequests') || '[]');
  myOwnedTeams.innerHTML = `<ul class="managed-list">${owned.map(team => {
    const pending = reqs.filter(request => request.teamId === team.id && request.status === 'pending').length;
    return `<li><span>${escapeHtml(team.name)}</span><span class="pending-count">${pending}</span> <button class="btn outline manage-btn" data-team="${team.id}">管理</button></li>`;
  }).join('')}</ul>`;
}

// 渲染主畫面中，目前所選比賽的詳細資訊標題區塊
export function renderContestInfo(contests, selectedContest) {
  const contestInfoWrapId = 'contestInfoWrap';
  let contestInfoWrap = document.getElementById(contestInfoWrapId);
  // 若該區塊不存在，則動態建立插入 DOM 中
  if (!contestInfoWrap) {
    contestInfoWrap = document.createElement('div');
    contestInfoWrap.id = contestInfoWrapId;
    contestInfoWrap.className = 'contest-info';
    document.querySelector('.content').insertBefore(contestInfoWrap, document.getElementById('teamsGrid'));
  }
  const selected = contests.find(item => Number(item.id) === Number(selectedContest));
  contestInfoWrap.innerHTML = selected
    ? `<h3>${escapeHtml(selected.name)}</h3><div>${escapeHtml(selected.date)}</div><p>${escapeHtml(selected.info)}</p>`
    : '<h3>全部隊伍</h3><div>顯示所有跨比賽隊伍</div>';
}

// 渲染左側選單的「比賽分類列表 (Accordion 摺疊選單)」
export function renderContestCategoryList(contests, selectedContest, expandedContestCategory) {
  const list = document.getElementById('contestsList');
  if (!list || !window.AppPreferences) return expandedContestCategory;

  // 透過標籤將比賽分類
  const categories = window.AppPreferences.DEFAULT_TAGS
    .map(tag => ({
      ...tag,
      contests: contests.filter(contest => window.AppPreferences.inferContestTags(contest).includes(tag.key))
    }))
    .filter(category => category.contests.length);

  // 保留使用者目前的展開狀態；空字串代表全部收合，不再自動打開第一個分類。
  const currentExpanded = expandedContestCategory;

  list.innerHTML = categories.map(category => {
    const isOpen = category.key === currentExpanded;
    return `
      <li class="contest-category ${isOpen ? 'open' : ''}">
        <button class="contest-category-toggle" type="button" data-contest-category="${category.key}" aria-expanded="${isOpen}">
          <span>${escapeHtml(category.label)}</span>
          <span class="contest-category-count">${category.contests.length} 個</span>
        </button>
        <div class="contest-category-panel">
          ${category.contests.map(contest => `
            <button class="contest-child ${Number(selectedContest) === Number(contest.id) ? 'active' : ''}" type="button" data-cid="${contest.id}">
              <strong>${escapeHtml(contest.name)}</strong>
              <span>${escapeHtml(contest.date || '日期未定')}</span>
            </button>
          `).join('')}
        </div>
      </li>
    `;
  }).join('');
  return currentExpanded;
}

// 渲染「為你推薦的比賽」區塊，根據使用者的偏好標籤進行配對與計分
export function renderRecommendations(contests, currentPreferences) {
  const recommendedContests = document.getElementById('recommendedContests');
  const recommendedBody = document.getElementById('recommendedBody') || recommendedContests;
  if (!recommendedBody || !window.AppPreferences) return;

  // 若使用者未設定偏好，顯示引導設定的提示
  if (!currentPreferences.length) {
    recommendedBody.innerHTML = `
      <div class="recommend-empty">
        <strong>想看到更適合你的比賽嗎？</strong>
        <p>到帳號資訊設定個人化標籤後，這裡會依照你的興趣推薦比賽。</p>
        <a class="btn outline" href="${withUserParam('/account-info.html')}">設定偏好</a>
      </div>
    `;
    return;
  }

  // 根據偏好計算分數並排序，取前三名
  const scored = contests
    .map(contest => ({ contest, ...window.AppPreferences.scoreContest(contest, currentPreferences) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // 生成推薦卡片 HTML
  recommendedBody.innerHTML = scored.length ? `
    <div class="recommend-panel">
      <div class="recommend-head">
        <div>
          <h3>為你推薦的比賽</h3>
          <p>根據你的標籤：${currentPreferences.map(key => escapeHtml(window.AppPreferences.labelFor(key))).join('、')}</p>
        </div>
        <a class="btn outline" href="${withUserParam('/account-info.html')}">修改偏好</a>
      </div>
      <div class="recommend-list">
        ${scored.map(item => `
          <article class="recommend-card" data-cid="${item.contest.id}">
            <h4>${escapeHtml(item.contest.name)}</h4>
            <div class="recommend-reason">符合 ${item.score} 個偏好：${item.matches.map(key => escapeHtml(window.AppPreferences.labelFor(key))).join('、')}</div>
            <div class="tag-row">${item.matches.map(key => `<span class="match-tag">${escapeHtml(window.AppPreferences.labelFor(key))}</span>`).join('')}</div>
          </article>
        `).join('')}
      </div>
    </div>
  ` : '';
}

// 渲染上方橫向滾動的「比賽總覽 (Card) 區塊」
export function renderContestOverview(contests, teams, selectedContest, contestFavs) {
  const contestsGrid = document.getElementById('contestsGrid');
  if (!contestsGrid) return;
  const displayContests = contests;
  
  // 渲染每張比賽卡片，包含愛心收藏按鈕、比賽資訊與參賽隊伍數量
  contestsGrid.innerHTML = `${displayContests.map(contest => {
    
    // 🚀 修正 1：對齊隊伍與比賽的資料庫欄位名稱 (team.com_id 比對 contest.id)
    const contestTeams = teams.filter(team => Number(team.com_id) === Number(contest.id));
    const isContestFav = contestFavs.includes(Number(contest.id));
    
    // 這裡維持原本的標籤判定
    const contestTags = window.AppPreferences ? window.AppPreferences.inferContestTags(contest).slice(0, 3) : [];
    
    return `
      <article class="contest-card ${Number(selectedContest) === Number(contest.id) ? 'active' : ''}" data-cid="${contest.id}">
        <button class="contest-fav-btn ${isContestFav ? 'active' : ''}" data-contest-fav="${contest.id}" type="button" aria-pressed="${isContestFav}">${isContestFav ? '♥' : '♡'}</button>
        <h3>${escapeHtml(contest.name)}</h3>
        
        <div class="contest-date">${escapeHtml(contest.com_date || '日期未定')}</div>
        
        <p>${escapeHtml(contest.com_intro || '尚未填寫比賽資訊')}</p>
        
        <div class="tag-row">${contestTags.map(key => `<span class="match-tag">${escapeHtml(window.AppPreferences.labelFor(key))}</span>`).join('')}</div>
        <div class="contest-stats"><span>${contestTeams.length} 隊</span></div>
      </article>
    `;
  }).join('')}
    <article class="contest-card and-more">
      <h3>And More...</h3>
    </article>
  `;
}

// 渲染側邊欄下方簡單文字版「已關注的比賽」
export function renderFollowedContests(contests, contestFavs) {
  const followed = document.getElementById('followed');
  if (!followed) return;
  const followedContests = contestFavs.map(id => contests.find(contest => Number(contest.id) === Number(id))).filter(Boolean);
  followed.textContent = followedContests.length ? followedContests.map(contest => `${contest.name}\n${contest.date}`).join('\n\n') : '尚無關注';
}

// 根據傳入的加入申請 (requests)，產生待審核名單的 HTML 結構，包含履歷資訊等
export function renderRequestsHtml(reqs) {
  return reqs.map(request => {
    const app = request.application || {};
    const resume = app.resume;
    return `<div class="req-item" data-req="${request.id}">
      <div><strong>${escapeHtml(app.applicantName || request.user.name)}</strong> 申請加入 <em>${escapeHtml(request.teamName)}</em></div>
      <div class="req-detail">
        <div>聯絡方式：${escapeHtml(app.applicantContact || '未填寫')}</div>
        <div>申請理由：${escapeHtml(app.applicantReason || '未填寫')}</div>
        ${resume ? `<div class="attached-resume"><strong>附上履歷：${escapeHtml(resume.name || resume.data?.name || '履歷')}</strong><br>
          學校：${escapeHtml(resume.data?.school || '未填寫')}　年級：${escapeHtml(resume.data?.grade || '未填寫')}<br>
          專長：${escapeHtml((resume.data?.tags || []).join('、') || '未填寫')}<br>
          經歷：${escapeHtml(resume.data?.experience || '未填寫')}<br>
          自我介紹：${escapeHtml(resume.data?.intro || '未填寫')}
        </div>` : ''}
      </div>
      <div class="req-actions">
        <button class="btn" data-act="approve" data-id="${request.id}">批准</button>
        <button class="btn outline" data-act="deny" data-id="${request.id}">拒絕</button>
      </div>
    </div>`;
  }).join('');
}

// 使用立即執行函式 (IIFE) 包裝，避免內部的變數污染到全域環境
(function () {

  // DOM 元素選擇器簡寫
  const $ = id => document.getElementById(id);

  // 取得網址參數，設定目前的使用者 ID 以及當前頁面要顯示的「比賽 ID」
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const contestId = Number(params.get('contestId')) || Number(params.get('id')) || 10;

  // --- 資料讀寫輔助函式區塊 ---
  function getValidId(value) {
    const text = String(value || '').trim();
    return text && text !== 'unknown' && text !== 'null' && text !== 'undefined' ? text : '';
  }

  // 取得目前登入者，優先使用登入後儲存的 userId；網址列只當備援，避免舊連結覆蓋新帳號。
  function getCurrentUserId() {
    return getValidId(localStorage.getItem('userId')) || getValidId(sessionStorage.getItem('userId')) || getValidId(params.get('userId'));
  }

  // 用隊伍成員狀態重新計算目前人數，避免 Team.current_member_count 沒同步時顯示 0 人。
  function countAcceptedMembers(members = []) {
    return members.filter(member => {
      const status = String(member.mem_status || member.status || '').trim();
      const role = String(member.role || '').trim();
      return status === '通過' || role === '建立人';
    }).length;
  }

  async function getLiveTeamMemberCount(teamId, token) {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/teams/detail?teamId=${encodeURIComponent(teamId)}`, { headers });
      if (!res.ok) throw new Error('無法取得隊伍詳細資料');

      const result = await res.json();
      const members = result.members || result.data || [];
      const count = countAcceptedMembers(members);
      return count > 0 ? count : null;
    } catch (err) {
      console.warn('隊伍人數即時重算失敗，改用列表資料:', teamId, err);
      return null;
    }
  }

  // 🚀 從後端真實資料庫讀取全部比賽（升級版：支援多標籤解析）
  async function loadContests() {
    try {
      const res = await fetch('/api/contests/competitions');
      if (!res.ok) throw new Error('無法取得資料庫比賽資料');

      const result = await res.json();
      const dbContests = result.competitions || result;

      const mappedContests = dbContests.map(contest => {
        // 🚀【核心對線】精準抓取後端 GROUP_CONCAT 吐出來的 tags 字串，並拆解成陣列
        const parsedTags = contest.tags && typeof contest.tags === 'string'
          ? contest.tags.split(',')
          : ['其他'];

        return {
          id: contest.com_id,
          name: contest.com_name,
          com_date: contest.com_date ? contest.com_date.split('T')[0] : '日期未定',
          com_enroll_ddl: contest.com_enroll_ddl ? contest.com_enroll_ddl.split('T')[0] : '截止日未定',
          com_intro: contest.com_intro || '尚未填寫說明',
          com_link: contest.com_link || '#',
          com_location: contest.com_location || '地點未定',
          com_reward: contest.com_reward || '獎勵未定',
          com_fee: contest.com_fee || '費用未定',
          tags: parsedTags // 🚀 成功保留完整的多標籤陣列
        };
      });

      return mappedContests;
    } catch (err) {
      console.error('❌ 讀取比賽資料庫失敗:', err);
      return [];
    }
  }

  // 🚀 從後端真實資料庫讀取全部隊伍
  async function loadTeams() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/teams/all');
      if (!res.ok) throw new Error('無法取得資料庫隊伍資料');

      const result = await res.json();
      const dbTeams = result.data || result.teams || result;
      const activeTeams = dbTeams.filter(team => (team.teamStatus || team.team_status || team.status || 'active') === 'active');

      const mappedTeams = await Promise.all(activeTeams.map(async team => {
        const teamId = team.team_id || team.id;
        const liveCount = await getLiveTeamMemberCount(teamId, token);

        return {
          id: teamId,
          team_id: teamId,
          team_name: team.team_name,
          com_id: team.com_id,
          demand: team.team_intro || team.demand || '尚未填寫說明',
          current_member_count: liveCount ?? team.current_member_count ?? team.current_members ?? team.member_count ?? 1,
          num_limit: team.num_limit || 0
        };
      }));

      return mappedTeams;
    } catch (err) {
      console.error('❌ 讀取隊伍資料庫失敗:', err);
      return [];
    }
  }

  // 🚀 從資料庫撈取該使用者目前的「收藏隊伍 ID 清單」
  async function loadDatabaseFavorites() {
    const token = localStorage.getItem('token');
    const userId = getCurrentUserId();
    if (!token || !userId) return [];

    try {
      const res = await fetch(`/api/teams/my-favorites?userId=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` } // 🔧 順手鎖緊 Bearer 機制
      });
      if (!res.ok) return [];
      const result = await res.json();
      return result.success ? result.data.map(item => Number(item.team_id)) : [];
    } catch (err) {
      console.error('❌ 載入資料庫收藏清單失敗:', err);
      return [];
    }
  }

  // 取得目前頁面指定的「特定比賽」物件資料
  async function getContest() {
    const contests = await loadContests();
    return contests.find(c => Number(c.id) === contestId) || contests[0];
  }

  async function contestTeams() {
    const allTeams = await loadTeams();
    const currentContest = await getContest();
    if (!currentContest) return [];
    return allTeams.filter(team => Number(team.com_id) === Number(currentContest.id));
  }

  // --- 網址路徑處理區塊 ---
  function withUserParam(path) {
    const userId = params.get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  function createTeamHref() { return withUserParam(`/create-team.html?contestId=${encodeURIComponent(contestId)}`); }
  function teamInfoHref(id) { return withUserParam(`/team-info.html?teamId=${encodeURIComponent(id)}`); }

  function isLoggedIn() {
    const token = localStorage.getItem('token');
    const userId = getCurrentUserId();
    return Boolean(token && token.trim() !== '' && userId);
  }

  function redirectToAuth() {
    location.href = '/auth.html';
  }

  function setContestFavoriteButton(isFavorite) {
    const btn = document.getElementById('favContestBtn');
    if (!btn) return;

    btn.classList.toggle('active', isFavorite);
    btn.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
    btn.innerHTML = isFavorite
      ? `<span class="heart-icon">♥</span> 已收藏`
      : `<span class="heart-icon">♡</span> 收藏比賽`;
  }

  async function syncContestFavoriteButton() {
    const token = localStorage.getItem('token');
    const userId = getCurrentUserId();

    // 先清成未收藏，避免切換帳號時短暫沿用上一個帳號的畫面狀態。
    setContestFavoriteButton(false);

    if (!token || !userId) {
      return;
    }

    try {
      const response = await fetch(`/api/contests/getFavorites?userId=${encodeURIComponent(userId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('無法取得收藏比賽清單');

      const result = await response.json();
      const favoriteContests = result.data || result.contests || [];
      const isFavorite = favoriteContests.some(item => Number(item.com_id || item.comId || item.id) === Number(contestId));
      setContestFavoriteButton(isFavorite);
    } catch (error) {
      console.error('❌ 初始化比賽收藏狀態失敗:', error);
      setContestFavoriteButton(false);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, match => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[match]);
  }

  // --- 核心畫面渲染邏輯 ---
  async function render() {
    if (!isLoggedIn()) {
      redirectToAuth();
      return;
    }

    const contest = await getContest();
    const teams = await contestTeams();
    const allContests = await loadContests();
    const dbFavIds = await loadDatabaseFavorites();

    if (!contest) {
      if ($('contestSummary')) $('contestSummary').innerHTML = '<h2>無法載入比賽資料</h2>';
      return;
    }

    window.AppNotifications?.ensureContestNotifications(allContests);
    document.title = `${contest.name} / 組隊`;
    await syncContestFavoriteButton();

    // 🚀【全面解鎖多標籤】將這場比賽綁定的所有中文標籤，通通渲染成精緻的小晶片！
    const tagsHtml = contest.tags && contest.tags.length
      ? contest.tags.map(t => `<span class="contest-detail-tag" style="background: #fbf6ef; border: 1px solid #efe1cf; color: #5d4937; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; display: inline-block;">${escapeHtml(t)}</span>`).join('')
      : '';

    // 渲染比賽摘要（內含多標籤雲排版）
    // 渲染比賽摘要（🚀 標籤已調整到標題正下方）
    $('contestSummary').innerHTML = `
      <h2 style="margin: 0 0 12px 0;">${contest.name}</h2>
      
      <div class="contest-tags-wrap" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;">
        ${tagsHtml}
      </div>
      
      <div class="summary-grid">
        <div class="summary-item"><span>隊伍數量</span><strong>${teams.length}</strong></div>
        <div class="summary-item"><span>比賽日期</span><strong>${contest.com_date}</strong></div>
        <div class="summary-item"><span>報名截止</span><strong>${contest.com_enroll_ddl}</strong></div>
        <div class="summary-item"><span>比賽費用</span><strong>${contest.com_fee}</strong></div>
        <div class="summary-item"><span>比賽獎金</span><strong>${contest.com_reward}</strong></div>
      </div>
    `;

    // 渲染比賽說明文字
    $('contestInfo').innerHTML = `
      <p>${contest.com_intro}</p>
      </br>
      <p>比賽官網連結：<a href="${contest.com_link}" target="_blank">${contest.com_link}</a></p>
    `;

    // 渲染屬於該比賽的「所有隊伍卡片」
    $('teamCards').innerHTML = teams.length ? teams.map(team => {
      const isFav = dbFavIds.includes(Number(team.team_id || team.id));
      const formattedDemand = team.demand
        ? team.demand.replace(/(需求：)/g, '<br>$1')
        : '尚未填寫說明';

      return `
        <article class="team-card">
          <div class="team-body">
            <h4>${team.team_name}</h4>
            <div class="team-meta" style="white-space: pre-line;">${formattedDemand}</div>
            <div class="recruitment-status">招募進度： ${team.current_member_count} / ${team.num_limit}</div>
          </div>
          
          <div class="team-actions">
            <button class="btn" data-id="${team.team_id}">查看 / 加入</button>
            <button class="fav-btn ${isFav ? 'active' : ''}" 
                    data-fav="${team.team_id}" 
                    aria-pressed="${isFav}">
              ${isFav ? '♥ 已收藏' : '♡ 收藏'}
            </button>
          </div>
        </article>
      `;
    }).join('') : '<div class="box">目前還沒有隊伍，先創建自己的隊伍吧。</div>';
  }

  // --- 互動與事件監聽區塊 ---

  // 收藏 / 取消收藏
  async function toggleFavorite(teamId, favBtn) {
    const token = localStorage.getItem('token');
    const userId = getCurrentUserId();

    if (!token || !userId) {
      alert('請先登入才能收藏隊伍！');
      return;
    }

    favBtn.style.opacity = '0.5';
    favBtn.disabled = true;

    try {
      const response = await fetch('/api/teams/toggle-favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // 🔧 鎖緊 Token 驗證
        },
        body: JSON.stringify({ userId: Number(userId), teamId: Number(teamId) })
      });

      if (!response.ok) throw new Error('伺服器回應錯誤');
      const result = await response.json();

      console.log(`🎯 收藏狀態已同步資料庫：`, result.message);

      if (result.action === 'favorite') {
        favBtn.classList.add('active');
        favBtn.innerHTML = '♥ 已收藏';
        favBtn.setAttribute('aria-pressed', 'true');
      } else if (result.action === 'unfavorite') {
        favBtn.classList.remove('active');
        favBtn.innerHTML = '♡ 收藏';
        favBtn.setAttribute('aria-pressed', 'false');
      }

      if (typeof renderSidebarTeams === 'function') {
        await renderSidebarTeams();
      } else if (typeof UI !== 'undefined' && typeof UI.renderSidebarTeams === 'function') {
        await UI.renderSidebarTeams();
      }

    } catch (error) {
      console.error('❌ 收藏失敗:', error);
      alert('收藏操作失敗，請稍後再試');
    } finally {
      favBtn.style.opacity = '1';
      favBtn.disabled = false;
    }
  }

  async function openTeamDetail(id) {
    if (!isLoggedIn()) {
      redirectToAuth();
      return;
    }

    const allTeams = await loadTeams();
    const team = allTeams.find(item => item.team_id === id);
    if (!team) return alert('找不到隊伍');
    location.href = teamInfoHref(id);
  }

  // 強制掛在視窗最頂層
  window.handleCreateTeamClick = function (e) {
    if (e) e.preventDefault();
    console.log("創建隊伍按鈕成功觸發！");

    const token = localStorage.getItem('token');

    if (!token || token === 'undefined') {
      if (typeof requireLogin === 'function') {
        requireLogin('請先登入才能創建隊伍喔！');
      } else {
        alert('請先登入才能創建隊伍喔！');
      }
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const contestId = urlParams.get('id') || "";
    const contestName = document.querySelector('#contestSummary h2')?.innerText || "";

    window.location.href = `create-team.html?id=${contestId}&name=${encodeURIComponent(contestName)}`;
  };

  // 處理收藏競賽的邏輯
  window.handleFavoriteClick = async function (e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const token = localStorage.getItem('token');
    const userId = getCurrentUserId();

    if (!token || token === 'undefined' || !userId) {
      if (typeof requireLogin === 'function') {
        requireLogin('請先登入才能收藏比賽喔！');
      } else {
        alert('請先登入才能收藏比賽喔！');
      }
      return;
    }

    const btn = e.currentTarget || document.getElementById('favContestBtn');
    const urlParams = new URLSearchParams(window.location.search);
    const contestId = urlParams.get('id');

    if (!contestId) {
      console.error("找不到競賽 ID");
      return;
    }

    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    const isNowActive = btn.classList.contains('active');

    btn.classList.toggle('active');
    if (!isNowActive) {
      btn.innerHTML = `<span class="heart-icon">♥</span> 已收藏`;
    } else {
      btn.innerHTML = `<span class="heart-icon">♡</span> 收藏比賽`;
    }

    try {
      const response = await fetch('/api/contests/toggle-favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: Number(userId),
          comId: Number(contestId)
        })
      });

      if (!response.ok) throw new Error('網路回應不正常');

      const result = await response.json();
      console.log(`🎯 比賽收藏狀態同步成功：`, result.message);

      if (result.action === 'favorite') {
        btn.classList.add('active');
        btn.innerHTML = `<span class="heart-icon">♥</span> 已收藏`;
        btn.setAttribute('aria-pressed', 'true');
      } else if (result.action === 'unfavorite') {
        btn.classList.remove('active');
        btn.innerHTML = `<span class="heart-icon">♡</span> 收藏比賽`;
        btn.setAttribute('aria-pressed', 'false');
      } else {
        await syncContestFavoriteButton();
      }

    } catch (err) {
      console.error("❌ 收藏比賽同步失敗:", err);
      btn.classList.toggle('active');
      btn.innerHTML = originalHTML;
      alert('抱歉，收藏功能暫時無法連線，請稍後再試。');
    } finally {
      btn.disabled = false;
    }
  };

  // 事件委派：監聽隊伍列表的點擊
  $('teamCards').addEventListener('click', e => {
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) return toggleFavorite(Number(favBtn.dataset.fav), favBtn);
    const joinBtn = e.target.closest('[data-id]');
    if (joinBtn) openTeamDetail(Number(joinBtn.dataset.id));
  });

  const homeLink = $('homeLink');
  if (homeLink) homeLink.href = withUserParam('/contests.html');

  // 頁面載入後執行初始渲染
  render();
})();

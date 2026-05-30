// 使用立即執行函式 (IIFE) 包裝，避免內部的變數污染到全域環境
(function(){

  // DOM 元素選擇器簡寫
  const $ = id => document.getElementById(id);
  
  // 取得網址參數，設定目前的使用者 ID 以及當前頁面要顯示的「比賽 ID」
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const currentUserId = params.get('userId') && params.get('userId') !== 'unknown' ? params.get('userId') : String(ME.id);
  const contestId = Number(params.get('contestId')) || Number(params.get('id')) || 10;

  // --- 資料讀寫輔助函式區塊 ---

  // 🚀 從後端真實資料庫讀取全部比賽
  async function loadContests() {
    try {
      const res = await fetch('/api/contests/competitions'); 
      if (!res.ok) throw new Error('無法取得資料庫比賽資料');
      
      const result = await res.json();
      const dbContests = result.competitions || result; 

      const mappedContests = dbContests.map(contest => ({
        id: contest.com_id,                             
        name: contest.com_name,   
                            
        /*com_date: contest.com_date || '日期未定',    
        com_enroll_ddl: contest.com_enroll_ddl || '報名截止未定', 
        com_intro: contest.com_intro || '尚未填寫說明',*/
        com_date: contest.com_date ? contest.com_date.split('T')[0] : '日期未定',
        com_enroll_ddl: contest.com_enroll_ddl ? contest.com_enroll_ddl.split('T')[0] : '截止日未定',
        
        com_intro: contest.com_intro || '尚未填寫說明', 
        com_link: contest.com_link || '#',
        com_location: contest.com_location || '地點未定', 
        com_reward: contest.com_reward || '獎勵未定', 
        com_fee: contest.com_fee || '費用未定' 
      }));

      return mappedContests;
    } catch (err) {
      console.error('❌ 讀取比賽資料庫失敗:', err);
      return [];
    }
  }

  // 🚀 從後端真實資料庫讀取全部隊伍
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
        num_limit: team.num_limit || 0                
      }));

      return mappedTeams;
    } catch (err) {
      console.error('❌ 讀取隊伍資料庫失敗:', err);
      return [];
    }
  }

  // 🚀【全新打造】重整網頁時，從資料庫撈取該使用者目前的「收藏隊伍 ID 清單」
  async function loadDatabaseFavorites() {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) return []; // 未登入就回傳空陣列

    try {
      const res = await fetch(`/api/teams/my-favorites?userId=${userId}`, {
        headers: { 'Authorization': ` ${token}` }
      });
      if (!res.ok) return [];
      const result = await res.json();
      // 🚀 將撈回來的收藏物件陣列，精簡轉換成只有 ID 的純數字陣列，方便用 .includes() 比對
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
  function withUserParam(path){
    const userId = params.get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  function createTeamHref(){ return withUserParam(`/create-team.html?contestId=${encodeURIComponent(contestId)}`); }
  function teamInfoHref(id){ return withUserParam(`/team-info.html?teamId=${encodeURIComponent(id)}`); }
  function isLoggedIn() {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId') || params.get('userId');
    return Boolean(
      token &&
      token.trim() !== '' &&
      userId &&
      userId !== 'unknown' &&
      userId !== 'null' &&
      userId !== 'undefined'
    );
  }
  function redirectToAuth() {
    location.href = '/auth.html';
  }

  // --- 核心畫面渲染邏輯 ---
  async function render(){
    if (!isLoggedIn()) {
      redirectToAuth();
      return;
    }

    // 1. 使用 await 解開所有非同步資料
    const contest = await getContest();
    const teams = await contestTeams();
    const allContests = await loadContests();
    
    // 🚀 核心修正：拋棄 LocalStorage，改從資料庫抓最即時的收藏隊伍 ID 陣列
    const dbFavIds = await loadDatabaseFavorites(); 

    if (!contest) {
      if ($('contestSummary')) $('contestSummary').innerHTML = '<h2>無法載入比賽資料</h2>';
      return;
    }
    
    window.AppNotifications?.ensureContestNotifications(allContests);
    document.title = `${contest.name} / 組隊`;

    // 渲染比賽摘要
    $('contestSummary').innerHTML = `
      <h2>${contest.name}</h2>
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
      // 🚀 核心修正：精準比對資料庫陣列中有沒有包含目前的 team_id
      const isFav = dbFavIds.includes(Number(team.team_id));
      const formattedDemand = team.demand
        ? team.demand.replace(/(需求：)/g, '<br>$1')
        : '尚未填寫說明';
      /*return `
        <article class="team-card">
          <h4>${team.team_name}</h4>
          <div class="team-meta" style="white-space: pre-line;">${formattedDemand}</div>          
          <div>成員 ${team.current_member_count} / ${team.num_limit}</div>
          <div class="team-actions">
            <button class="btn" data-id="${team.team_id}">查看 / 加入</button>
            <button class="fav-btn ${isFav ? 'active' : ''}" data-fav="${team.team_id}" aria-pressed="${isFav}">${isFav ? '♥ 已收藏' : '♡ 收藏'}</button>
          </div>
        </article>*/

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
    const userId = localStorage.getItem('userId');

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
          'Authorization': ` ${token}` 
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
      
      // 成功後連動刷新右側邊欄
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

  async function openTeamDetail(id){
    if (!isLoggedIn()) {
      redirectToAuth();
      return;
    }

    const allTeams = await loadTeams();
    const team = allTeams.find(item => item.team_id === id);
    if (!team) return alert('找不到隊伍');
    location.href = teamInfoHref(id);
  }

  //$('createBtn').addEventListener('click', () => { location.href = createTeamHref(); });

  // 強制掛在視窗最頂層，誰都洗不掉它
window.handleCreateTeamClick = function(e) {
    if(e) e.preventDefault();
    console.log("創建隊伍按鈕成功觸發！");
    
    const token = localStorage.getItem('token');

    if (!token || token === 'undefined') { 
        // 🛑 沒登入：彈窗警告，然後絕對要 return！
        if (typeof requireLogin === 'function') {
            requireLogin('請先登入才能創建隊伍喔！');
        } else {
            alert('請先登入才能創建隊伍喔！');
        }
        return; // 👈 這一行是保險絲，沒它就會繼續執行跳轉
    }

    // ✅ 有登入：才會跑到這裡執行跳轉
    const urlParams = new URLSearchParams(window.location.search);
    const contestId = urlParams.get('id') || "";
    const contestName = document.querySelector('#contestSummary h2')?.innerText || "";

    window.location.href = `create-team.html?id=${contestId}&name=${encodeURIComponent(contestName)}`;
};

// --- 處理收藏競賽的邏輯 ---
window.handleFavoriteClick = async function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation(); // 防止事件干擾到下方的卡片點擊
    }

    // 1. 權限檢查
    const token = localStorage.getItem('token');
    
    if (!token || token === 'undefined') {
        // 🛑 沒登入：彈窗警告，然後絕對要 return！
        if (typeof requireLogin === 'function') {
            requireLogin('請先登入才能收藏比賽喔！');
        } else {
            alert('請先登入才能收藏比賽喔！');
        }
        return;
    }

    // 2. 獲取按鈕元素與競賽 ID
    const btn = e.currentTarget || document.getElementById('favContestBtn');
    const urlParams = new URLSearchParams(window.location.search);
    const contestId = urlParams.get('id');

    if (!contestId) {
        console.error("找不到競賽 ID");
        return;
    }

    // 3. 即時 UI 回饋 (Optimistic UI)
    // 切換 active 類別，並根據狀態更改圖示與文字
    const isNowActive = btn.classList.toggle('active');
    
    if (isNowActive) {
        btn.innerHTML = `<span class="heart-icon">♥</span> 已收藏`;
        console.log(`已將競賽 ${contestId} 加入收藏清單`);
    } else {
        btn.innerHTML = `<span class="heart-icon">♡</span> 收藏比賽`;
        console.log(`已將競賽 ${contestId} 從收藏清單移除`);
    }

    // 4. 同步到資料庫
    try {
        // 這裡對應你們後端的 API 路徑，例如 /api/favorites/contest
        const response = await fetch('/api/contests/favorite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ contestId: contestId })
        });

        if (!response.ok) {
            throw new Error('網路回應不正常');
        }
        
        const result = await response.json();
        // 成功後可以根據後端回傳訊息做進一步處理
    } catch (err) {
        console.error("收藏同步失敗:", err);
        // 如果後端失敗，把 UI 狀態彈回去並提醒使用者
        btn.classList.toggle('active');
        btn.innerHTML = !isNowActive ? `<span class="heart-icon">♥</span> 已收藏` : `<span class="heart-icon">♡</span> 收藏比賽`;
        alert('抱歉，收藏功能暫時無法連線，請稍後再試。');
    }
};

  // 事件委派：監聽隊伍列表的點擊
  $('teamCards').addEventListener('click', e=>{
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

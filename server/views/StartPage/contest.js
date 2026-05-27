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

  // 🚀 轉正版：從後端真實資料庫讀取全部比賽
  async function loadContests() {
    try {
      const res = await fetch('/api/contests/competitions'); 
      if (!res.ok) throw new Error('無法取得資料庫比賽資料');
      
      const result = await res.json();
      const dbContests = result.competitions || result; 

      console.log('📦 資料庫原始比賽資料：', dbContests);

      // 🛠️ 對齊修正：讓屬性名稱完美對應你的 render 渲染欄位
      const mappedContests = dbContests.map(contest => ({
        id: contest.com_id,                             
        name: contest.com_name,                       
        com_date: contest.com_date || '日期未定',    // 👉 對齊 contest.com_date
        com_intro: contest.com_intro || '尚未填寫說明', // 👉 對齊 contest.com_intro
        officialUrl: contest.com_link || '#'    
      }));

      return mappedContests;
    } catch (err) {
      console.error('❌ 讀取比賽資料庫失敗，啟用空陣列防護:', err);
      return [];
    }
  }

  // 🚀 轉正版：從後端真實資料庫讀取全部隊伍
  async function loadTeams() {
    try {
      const res = await fetch('/api/teams/all'); 
      if (!res.ok) throw new Error('無法取得資料庫隊伍資料');

      const result = await res.json();
      const dbTeams = result.data || result.teams || result;

      console.log('📦 資料庫原始隊伍資料：', dbTeams);

      // 🛠️ 對齊修正：讓屬性名稱完美對應你的 render 渲染與側邊欄 filter
      const mappedTeams = dbTeams.map(team => ({
        id: team.team_id || team.id,                  // 👉 提供一個基本 id 做為輔助機制
        team_id: team.team_id,                        // 👉 對齊 team.team_id
        team_name: team.team_name,                    // 👉 對齊 team.team_name
        com_id: team.com_id,                          // 👉 對齊 team.com_id
        demand: team.team_intro || team.demand || '尚未填寫說明', // 👉 對齊 team.demand
        current_member_count: team.current_member_count || 0,     // 👉 對齊 team.current_member_count
        num_limit: team.num_limit || 0                // 👉 對齊 team.num_limit
      }));

      return mappedTeams;
    } catch (err) {
      console.error('❌ 讀取隊伍資料庫失敗，啟用空陣列防護:', err);
      return [];
    }
  }

  // 基礎的 localStorage 存取操作 (收藏部分仍維持在 local)
  function saveTeams(teams){ localStorage.setItem('teams', JSON.stringify(teams)); }
  function loadFavorites(){ return JSON.parse(localStorage.getItem('favorites')||'[]'); }
  function saveFavorites(favs){ localStorage.setItem('favorites', JSON.stringify(favs)); }
  function loadContestFavorites(){ return JSON.parse(localStorage.getItem('favoriteContests')||'[]').map(Number); }

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

  function createTeamHref(){
    return withUserParam(`/create-team.html?contestId=${encodeURIComponent(contestId)}`);
  }

  function teamInfoHref(id){
    return withUserParam(`/team-info.html?teamId=${encodeURIComponent(id)}`);
  }

  // --- 核心畫面渲染邏輯 ---
  async function render(){
    // 1. 使用 await 解開所有非同步資料
    const contest = await getContest();
    const teams = await contestTeams();
    const allContests = await loadContests();
    const allTeams = await loadTeams();
    const favs = loadFavorites();

    // 2. 安全防護：萬一後端連不上，避免網頁噴錯
    if (!contest) {
      if ($('contestSummary')) $('contestSummary').innerHTML = '<h2>無法載入比賽資料</h2>';
      return;
    }
    
    // 確保比賽的通知狀態同步
    window.AppNotifications?.ensureContestNotifications(allContests);
    // 動態更新網頁標題
    document.title = `${contest.name} / 組隊`;

    // 渲染比賽摘要（隊伍總數、日期、總招募缺額）
    $('contestSummary').innerHTML = `
      <h2>${contest.name}</h2>
      <div class="summary-grid">
        <div class="summary-item"><span>隊伍數量</span><strong>${teams.length}</strong></div>
        <div class="summary-item"><span>比賽日期</span><strong>${contest.com_date}</strong></div>
        <div class="summary-item"><span>招募需求</span><strong>${teams.reduce((sum,t)=>sum + Math.max((t.num_limit||0)-(t.current_member_count||0),0),0)} 人</strong></div>
      </div>
    `;

    // 渲染比賽說明文字
    $('contestInfo').innerHTML = `
      <p>${contest.com_intro}</p>
      <p>可以在此查看目前正在招募的隊伍，也可以直接建立自己的隊伍並開始招募成員。</p>
    `;

    // 渲染屬於該比賽的「所有隊伍卡片」
    $('teamCards').innerHTML = teams.length ? teams.map(team => {
      const isFav = favs.includes(team.team_id);
      const formattedDemand = team.demand
      ? team.demand.replace(/(需求：)/g, '<br>$1')
      : '尚未填寫說明';
      return `
        <article class="team-card">
          <h4>${team.team_name}</h4>
          <div class="team-meta" style="white-space: pre-line;">${formattedDemand}</div>          
          <div>成員 ${team.current_member_count} / ${team.num_limit}</div>
          <div class="team-actions">
            <button class="btn" data-id="${team.team_id}">查看 / 加入</button>
            <button class="fav-btn ${isFav ? 'active' : ''}" data-fav="${team.team_id}" aria-pressed="${isFav}">${isFav ? '♥ 已收藏' : '♡ 收藏'}</button>
          </div>
        </article>
      `;
    }).join('') : '<div class="box">目前還沒有隊伍，先創建自己的隊伍吧。</div>';

    // 渲染側邊欄：「我加入的隊伍」
    const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`)||'[]');
    const my = allTeams.filter(team => joinedIds.some(id => Number(id) === Number(team.team_id)) && Number(team.com_id) === Number(contest.id));
    if ($('myTeams')) $('myTeams').textContent = my.length ? my.map(team => team.team_name).join('\n') : '尚未加入隊伍';

    // 渲染側邊欄：「我收藏的隊伍」
    const favoriteTeams = allTeams.filter(team => favs.includes(team.team_id));
    if ($('myFavs')) $('myFavs').textContent = favoriteTeams.length ? favoriteTeams.map(team => team.team_name).join('\n') : '尚無收藏隊伍';

    // 渲染側邊欄：「我關注的比賽」
    const favoriteContests = loadContestFavorites().map(id => allContests.find(item => Number(item.id) === Number(id))).filter(Boolean);
    if ($('followed')) $('followed').textContent = favoriteContests.length ? favoriteContests.map(item => `${item.name}\n${item.com_date}`).join('\n\n') : '尚無關注';
  }

  // --- 互動與事件監聽區塊 ---

  function toggleFavorite(id){
    const favs = loadFavorites();
    const index = favs.indexOf(id);
    if (index >= 0) favs.splice(index, 1); else favs.push(id);
    saveFavorites(favs);
    render(); // 重新渲染
  }

  async function openTeamDetail(id){
    const allTeams = await loadTeams();
    // 🛠️ 對齊修正：此處的 item.id 與傳入的 team_id 比對
    const team = allTeams.find(item => item.team_id === id);
    if (!team) return alert('找不到隊伍');
    location.href = teamInfoHref(id);
  }

  function openCreateTeamPage(){
    location.href = createTeamHref();
  }
  $('createBtn').addEventListener('click', openCreateTeamPage);

  // 事件委派：監聽隊伍列表的點擊
  $('teamCards').addEventListener('click', e=>{
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) return toggleFavorite(Number(favBtn.dataset.fav));
    const joinBtn = e.target.closest('[data-id]');
    if (joinBtn) openTeamDetail(Number(joinBtn.dataset.id)); 
  });

  document.querySelector('.logo-link')?.setAttribute('href', withUserParam('/team.html'));

  // 頁面載入後執行初始渲染
  render();
})();
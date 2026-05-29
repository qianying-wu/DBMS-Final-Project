(function(){
  // 簡化 DOM 查找，後續用 $('id') 取得元素。
  const $ = id => document.getElementById(id);

  // 本機測試用預設使用者，網址沒有 userId 時使用。
  const ME = { id: 9999, name: '你自己' };
  const params = new URLSearchParams(location.search);
  const currentUserId = params.get('userId') && params.get('userId') !== 'unknown' ? params.get('userId') : String(ME.id);
  const initialContestId = Number(params.get('contestId')) || Number(params.get('id')) || null;

  // 預設給申請人的問題。
  const questions = ['請簡單介紹你的背景和想加入的原因'];


  // 讀取比賽資料，並補齊預設比賽與官方連結。
  async function loadContests(){
    try {
      const path = '/api/contests/competitions';      
      const response = await fetch(path);
      if (!response.ok) throw new Error('伺服器回應錯誤');
      
      const contests = await response.json();
      return contests; // 這會是一個從資料庫撈出來的陣列
    } catch (error) {
      console.error('❌ 無法從資料庫載入比賽:', error);
      // alert('載入比賽列表失敗，請檢查網路連線或後端伺服器');
      return [];
    }
  }

  // 讀取隊伍資料，並移除展示用預設隊伍。
  function loadTeams(){
    const raw = localStorage.getItem('teams');
    if (raw) {
      const defaultNames = ['AI 聯合隊', '機器人挑戰隊', '資料探勘小隊'];
      const teams = JSON.parse(raw).filter(team => !defaultNames.includes(team.team_name));
      if (teams.length !== JSON.parse(raw).length) localStorage.setItem('teams', JSON.stringify(teams));
      return teams;
    }

  }

  // 讀取各種本機狀態資料。
  function loadFavorites(){ return JSON.parse(localStorage.getItem('favorites')||'[]'); }
  function loadContestFavorites(){ return JSON.parse(localStorage.getItem('favoriteContests')||'[]').map(Number); }

  // 將使用者輸入轉成安全文字，避免插入 HTML 時破壞畫面。
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  // 將資料放進 HTML attribute 前先轉義。
  function escapeAttr(value){
    return String(value ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // 🚀 簡化後的版本：單純記錄使用者切換下拉選單時選擇的比賽 com_id
  function toggleNewContestFields(){
    selectedContestId = $('contestSelect').value ? Number($('contestSelect').value) : null;
    
    if (typeof render === 'function') render();
  }

  // 取得目前選擇的比賽；若使用新增比賽模式則回傳 null。
  async function getContest(){
    const contests = await loadContests();
    if ($('contestSelect')?.value === 'new') return null;
    return contests.find(contest => Number(contest.com_id) === Number(selectedContestId)) || contests[0];
  }

  // 將 userId 保留在跨頁連結中。這個感覺可以整合

  function loadTeams(){
    return JSON.parse(localStorage.getItem('teams') || '[]');
  }

  function saveTeams(teams){
    localStorage.setItem('teams', JSON.stringify(teams));
  }

  function withUserParam(path){
    const userId = params.get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  // 取得目前比賽底下的隊伍。
  async function getContestTeams(){
    const contest = await getContest();
    if (!contest) return [];
    return loadTeams().filter(team => Number(team.com_id) === Number(contest.com_id));
  }

  // 更新頁面摘要、左右側狀態與通知。
  async function render(){
    const contests = await loadContests();
  
    const select = $('contestSelect');
    // 🚀 加上防呆：如果 select 存在，且它是個 SELECT 標籤時才塞 innerHTML
    if (select && select.tagName === 'SELECT') {
      select.innerHTML = contests.map(c => `<option value="${c.com_id}">${c.name}</option>`).join('');
    }
    const contest = await getContest();
    const teams = await getContestTeams();
    window.AppNotifications?.ensureContestNotifications(loadContests());
    const openings = teams.reduce((sum,team) => sum + Math.max((team.num_limit || 0) - (team.members || 0), 0), 0);
    document.title = '發起招募';

  }

  // 渲染比賽下拉選單
  async function renderContestSelect(){
    let contests = await loadContests(); 
  
    // 2. 決定預設選中的值
    const selectedValue = selectedContestId && contests.some(c => Number(c.com_id) === Number(selectedContestId)) ? String(selectedContestId) : '';
    
    // 3. 開始渲染 Options
    $('contestSelect').innerHTML = `
      ${contests.map(contest => `
        <option value="${contest.com_id}">
          ${escapeAttr(contest.com_name)}（${escapeAttr(contest.com_date || '日期未定')}）
        </option>
      `).join('')}
    `;
    
    $('contestSelect').value = selectedValue;
  }

  // 送出表單時取得比賽
  function resolveContestForSubmit() {
    const selectedComId = $('contestSelect').value;

    // 防呆：如果使用者選到預設的空白選項、或者是空的
    if (!selectedComId || selectedComId === 'new') {
      throw new Error('請選擇一個比賽');
    }

    // 直接回傳包含 id 的物件，讓後續建立隊伍的程式碼（contest.id）可以無縫接軌
    return {
      id: Number(selectedComId)
    };

  }
  // 渲染「給申請人的提問」列表。
  // function renderQuestions(){
  //   $('questionsList').innerHTML = questions.map((question, index) => `
  //     <div class="question-row">
  //       <input class="question-input" data-index="${index}" type="text" value="${escapeAttr(question)}" placeholder="輸入給申請人的問題">
  //       <button class="remove-question" data-remove="${index}" type="button" aria-label="刪除提問">×</button>
  //     </div>
  //   `).join('');
  // }

    // 監聽搜尋列表的點擊
// 🚀 1. 核心搜尋與渲染函式
async function renderContestResults() {
  const keyword = $('contestSearch').value.trim();
  const resultContainer = $('searchResultList'); 
  const hiddenInput = $('contestSelect');        

  // 🚀 防護：只要使用者開始重新輸入字，立刻把上次選錯的隱藏 ID 和 ✅ 標籤清空！
  if (keyword) {
    hiddenInput.value = '';
    $('contestResults').innerHTML = ''; 
  } else {
    resultContainer.innerHTML = '';
    hiddenInput.value = '';
    $('contestResults').innerHTML = '';
    return;
  }

  try {
    const path = `/api/teams/contests/search?q=${encodeURIComponent(keyword)}`;
    const resp = await fetch(path);
    if (!resp.ok) throw new Error('搜尋伺服器回應錯誤');
    
    const contests = await resp.json();

    if (contests.length === 0) {
      resultContainer.innerHTML = '<div class="no-result" style="color: #666; padding: 10px;">找不到符合條件的比賽</div>';
      return;
    }

    // 渲染比賽卡片到搜尋清單 (加上統一的 class: contest-card)
    resultContainer.innerHTML = contests.map(contest => `
      <div class="contest-card" data-id="${contest.com_id}" data-name="${contest.com_name}" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
        <strong style="font-size: 1.1em; color: #333;">${contest.com_name}</strong>
        <div style="font-size: 0.9em; color: #666; margin-top: 5px;">📆 比賽日期：${contest.com_date || '日期未定'}</div>
        <div style="font-size: 0.9em; color: #888; margin-top: 3px;">📝 簡介：${contest.com_intro || '點擊查看詳情'}</div>
      </div>
    `).join('');

  } catch (error) {
    console.error('❌ 前端即時搜尋渲染失敗:', error);
    resultContainer.innerHTML = '<div class="error" style="color: red; padding: 10px;">搜尋發生網路錯誤</div>';
  }
}

// 🚀 2. 【事件獨立】將點擊事件統一交給 searchResultList 代理（只寫這一個，把舊的 card.forEach 刪掉！）
$('searchResultList').addEventListener('click', (e) => {
  // 精準抓取被點擊的比賽卡片
  const card = e.target.closest('.contest-card'); 
  if (!card || !card.dataset.id) return;

  const id = card.dataset.id;
  const name = card.dataset.name;

  // 1. 將選中的 ID 存入隱藏欄位，送出表單時對齊 com_id
  $('contestSelect').value = id;
  if (window.hasOwnProperty('selectedContestId')) selectedContestId = Number(id); // 有全域變數就同步

  // 2. 視覺回饋：漂亮地顯示選中標籤
  $('contestResults').innerHTML = `
      <div class="selected-tag" style="background:#f0f7ff; padding:10px; border:1px solid #1890ff; margin-top:10px; border-radius:4px;">
          ✅ 已選擇比賽：<strong>${name}</strong>
      </div>
  `;
  
  // 3. 清空搜尋列表與輸入框，讓重選流程完美結束
  $('searchResultList').innerHTML = '';
  $('contestSearch').value = '';
});

// 🚀 3. 輸入框 Debounce 倒數計時（修正重複宣告與括號問題）
$('contestSearch').addEventListener('input', () => {
  if (window.hasOwnProperty('selectedContestId')) selectedContestId = null;
  clearTimeout(window.debounceTimer);

  window.debounceTimer = setTimeout(() => {
    renderContestResults();
  }, 300);
});

  // $('addQuestion').addEventListener('click', () => {
  //   questions.push('');
  //   renderQuestions();
  //   document.querySelectorAll('.question-input').item(questions.length - 1)?.focus();
  // });

  // $('questionsList').addEventListener('input', event => {
  //   const input = event.target.closest('.question-input');
  //   if (!input) return;
  //   questions[Number(input.dataset.index)] = input.value;
  // });

  // $('questionsList').addEventListener('click', event => {
  //   const button = event.target.closest('[data-remove]');
  //   if (!button) return;
  //   if (questions.length === 1) questions[0] = '';
  //   else questions.splice(Number(button.dataset.remove), 1);
  //   renderQuestions();
  // });

  /**
 * 取得當前使用者在搜尋結果中點選的比賽資料
 * @returns {Object} 包含 com_id 的比賽物件
 */
function getSelectedContest() {
  // 1. 從隱藏欄位中撈出剛剛點擊卡片塞進去的 com_id
  const selectedComId = $('contestSelect')?.value;

  // 2. 🚀 防呆機制：如果欄位是空的，代表使用者根本沒有點選任何一場比賽
  if (!selectedComId || selectedComId.trim() === '') {
    throw new Error('請先在上方輸入關鍵字，並「點擊選擇」一場比賽！');
  }

  // 3. 成功拿到 ID，包裝成物件回傳（對齊你後端需要的欄位名稱）
  return {
    com_id: Number(selectedComId)
  };
}
/*  // 表單送出：建立隊伍並導回對應比賽頁。
  $('createForm').addEventListener('submit', async event => { // 💡 注意：這裡加上了 async

    event.preventDefault();
    // const contest = getSelectedContest();
    contest = resolveContestForSubmit();
    const name = $('teamName').value.trim();
    if (!contest) return alert('請先搜尋並選擇一個比賽');
    if (!name) return alert('請輸入隊伍名稱');

    // try {
    //   console.log(contest);
    // } catch (error) {
    //   return alert(error.message || error);
    // }
  
    // ----------檢查這邊的邏輯------------
    const descParts = [$('teamDesc').value.trim(), $('teamSkills').value.trim() ? `需求：${$('teamSkills').value.trim()}` : ''].filter(Boolean);
    const slots = Number($('teamSlots').value) || 4;
    
    // 這裡打包要丟給資料庫的欄位資料
    const teamData = {
      com_id: contest.id,                // 資料庫: com_id
      teamStatus: 'active',              // 資料庫: teamStatus (預設啟用)
      num_limit: slots,                  // 資料庫: num_limit
      demand: descParts.join('\n'),      // 資料庫: demand
      team_name: name,                   // 資料庫: team_name
      current_member_count: 1,          // 資料庫: current_member_count (建立時預設 1 人，代表隊長)
    };
  
    try {
      
      const path = '/api/teams/create';
      const token = localStorage.getItem('token'); // 🚀 假設你們登入時把 token 存存在這裡
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 
                   'Authorization': ` ${token}` // 🚀 關鍵核心：手動把 JWT Token 傳給後端驗證
        },
        body: JSON.stringify(teamData) // 把資料變成字串送過去
      });
  
      console.log(teamData);
      // 🚀 3. 安全防護：如果是 401，抓出純文字提示
      if (!response.ok) {
        const errorText = await response.text();
        return console.log(`建立失敗 (錯誤代碼 ${response.status}): ${errorText}\n提示：請檢查 Token 是否有效或是否已登入。`);
      }
      const result = await response.json();

      if (response.ok && result.success) {
        alert('🎉 隊伍建立成功！');
        
        // 成功後看你要導頁回到哪裡，例如：
        window.location.href = withUserParam('/team.html');
      } else {
        alert('建立隊伍失敗：' + (result.message || '未知錯誤'));
      }
    } catch (error) {
      console.error('網路錯誤:', error);
      alert('無法連接到伺服器，請稍後再試');
    }

  });
*/

$('createForm').addEventListener('submit', async event => {
  event.preventDefault();

  // 1. 基本欄位獲取
  const contest = resolveContestForSubmit();
  const name = $('teamName').value.trim();
  const desc = $('teamDesc').value.trim();     
  const skills = $('teamSkills').value.trim(); 
  const slots = Number($('teamSlots').value) || 4;

  // 2. 檢查邏輯
  if (!contest) return alert('請先搜尋並選擇一個比賽');
  if (!name) return alert('請輸入隊伍名稱');
  if (!skills) return alert('請輸入「招募需求」');
  if (!desc) return alert('請輸入「主題/說明」');

  // 3. 打包要丟給資料庫的欄位資料
  const descParts = [desc, skills ? `需求：${skills}` : ''].filter(Boolean);
      
  const teamData = {
      // 🚀 雙重保險：不管你選擇比賽後跳成哪種格式，兩個欄位通通丟給後端去抓！
      com_id: contest.com_id || contest.id,
      contestId: contest.id || contest.com_id,
      num_limit: slots,
      demand: descParts.join('\n'), 
      team_name: name,
      user_id: localStorage.getItem("userId")
  };

  // 4. 送出請求 (一次 Fetch 搞定兩張表！)
  try {
      const path = '/api/teams/create';
      const token = localStorage.getItem('token');
      
      if (!token) return alert('登入逾時，請重新登入');

      const response = await fetch(path, {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${token}` // 修正：加上 Bearer 比較標準
          },
          body: JSON.stringify(teamData)
      });

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`建立失敗 (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
          alert('🎉 隊伍與成員身分同步建立成功！');
          // 🚀 順利解鎖跳轉功能
          window.location.href = withUserParam('/team.html'); 
      } else {
          alert('建立隊伍失敗：' + (result.message || '未知錯誤'));
      }
  } catch (error) {
      console.error('網路錯誤:', error);
      alert('無法連接到伺服器：' + error.message);
  }
});

  $('cancelBtn').addEventListener('click', () => { location.href = withUserParam('/team.html'); });
  $('backBtn').addEventListener('click', () => { location.href = withUserParam('/team.html'); });
  document.querySelector('.logo-link')?.setAttribute('href', withUserParam('/team.html'));

  // 負責網頁載入啟動的監聽器，回呼函式要加上 async
  document.addEventListener('DOMContentLoaded', async () => {
    
    const contests = await loadContests();
    
    // 檢查網址有沒有帶 contestId 過來 (initialContestId 在程式最上面已經抓好了)
    if (initialContestId) {
      // 從撈回來的比賽清單中，找出對應的那一場比賽
      const targetContest = contests.find(c => 
        Number(c.com_id) === initialContestId || Number(c.id) === initialContestId
      );
      
      if (targetContest) {
        $('contestSelect').value = targetContest.com_id || targetContest.id;
        if (window.hasOwnProperty('selectedContestId')) {
           selectedContestId = targetContest.com_id || targetContest.id;
        }
        
        $('contestResults').innerHTML = `
            <div class="selected-tag" style="background:#f0f7ff; padding:10px; border:1px solid #1890ff; margin-top:10px; border-radius:4px;">
                ✅ 已選擇比賽：<strong>${targetContest.com_name || targetContest.name}</strong>
            </div>
        `;
      }
    }
  });  
  toggleNewContestFields();
  render();
  // renderQuestions();
})();

(function(){
  // 初始化履歷頁面，集中取得 DOM 元素並綁定互動事件。
  function init(){
  const $ = id => document.getElementById(id);
  const saveBtn = $('saveBtn');
  const exportBtn = $('exportBtn');
  const delResume = $('delResume');
  const resumeHome = $('resumeHome');
  const resumeEditor = $('resumeEditor');
  const resumeGallery = $('resumeGallery');
  const backToGallery = $('backToGallery');
  const viewResumeBtn = $('viewResumeBtn');
  const editorTitle = $('editorTitle');
  const addTag = $('addTag');
  const newTag = $('newTag');
  const tagsWrap = $('tags');
  const photo = $('photo');
  const photoPreview = $('photoPreview');
  const photoImage = $('photoImage');
  const photoScale = $('photoScale');
  const resetPhoto = $('resetPhoto');
  const myTeamsBox = $('myTeams');
  const followedBox = $('followed');

  // 照片狀態會保留圖片來源、縮放比例與拖曳偏移量。
//  let photoState = { src: null, scale: 1, x: 0, y: 0 };

  // 履歷資料儲存在 localStorage.profiles，格式為 { id, name, data }。
  // function loadProfiles(){
  //   return JSON.parse(localStorage.getItem('profiles')||'[]');
  // }
function getAuthHeader(){
  const token = localStorage.getItem('token');

  return token ? { 'Authorization': `${token}` } : {};
}

// 載入：從資料庫獲取所有履歷
    async function loadProfiles(){
      try {
        const path = '/api/pv/loadPV';
        const response = await fetch ( path, { headers: { ...getAuthHeader()}});
        if (!response.ok) throw new Error('無法取得履歷資料');

        const existProfiles = await response.json();
        return existProfiles
      } catch (err) {
        console.error(err);
        alert('讀取資料庫失敗');
        return [];
  }
}

    // 儲存：將特定履歷資料推送到資料庫
    async function saveProfileToDB(profilePayload){
      try {
        path = '/api/pv/savePV';
        const res = await fetch(path, { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          body: JSON.stringify(profilePayload)
        });
        if (!res.ok) throw new Error('儲存失敗');
        const result = await res.json();
        return result; 
      } catch (err) {
        console.error(err);
        alert('儲存到資料庫失敗');
        throw err;
      }
    }

//     // 刪除：通知資料庫移除特定 ID 的履歷
    async function deleteProfile(card_id){
      try {
        const res = await fetch(`/api/pv/deletePV/${card_id}`, { 
          method: 'DELETE',
          headers: { ...getAuthHeader() }
        });
        if (!res.ok) throw new Error('刪除失敗');
        return true;
      } catch (err) {
        console.error(err);
        alert('刪除履歷失敗');
        return false;
      }
    }

  // function saveProfiles(p){ localStorage.setItem('profiles', JSON.stringify(p)); }
  // function setActiveProfileId(id){ localStorage.setItem('activeProfileId', String(id)); }
  // function getActiveProfileId(){ return localStorage.getItem('activeProfileId') || null; }
    let activeResumeId = null; // 這就是全域紀錄本變數

  function setActiveProfileId(id) { 
    activeResumeId = id ? String(id) : null; 
  }

  function getActiveProfileId() { 
    return activeResumeId; 
  }

  
  // 將專長標籤渲染成可移除的 tag。
  function renderTags(tags){
    tagsWrap.innerHTML = '';
    tags.forEach((t,i)=>{
      const el = document.createElement('span'); el.className='tag'; el.textContent = t;
      const rem = document.createElement('span'); rem.className='remove'; rem.textContent='✕'; rem.onclick = ()=>{ tags.splice(i,1); renderTags(tags); };
      el.appendChild(rem); tagsWrap.appendChild(el);
    });
  }

  // 渲染履歷卡片列表，以及新增履歷卡片。
  async function renderResumeGallery(){
    const ps = await loadProfiles();
    resumeGallery.innerHTML = '';
  //  const activeId = localStorage.getItem("userId");
    const activeId = getActiveProfileId();
    
    ps.forEach(p => {
      const card = document.createElement('article');
      card.className = `resume-card${String(p.id) === String(activeId) ? ' open' : ''}`;
      card.dataset.id = p.id; // 每張卡片都帶上自己的 ID，點擊時可以知道是哪一份履歷
      card.innerHTML = `
        <div class="resume-cover"><span class="resume-ribbon">開啟</span></div>
        <div class="resume-body">
          <h3 class="resume-title" contenteditable="true" spellcheck="false">${escapeHtml(p.name || '未命名履歷')}</h3>
          <span class="resume-time">${formatDateTime(p.updatedAt || p.createdAt)}</span>
          <div class="resume-card-actions">
            <button class="icon-action view-resume" type="button" aria-label="查看履歷">查看</button>
            <button class="icon-action edit-resume" type="button" aria-label="編輯履歷">...</button>
          </div>
        </div>
      `;

      //  點擊標題可以直接編輯名稱，失焦後自動儲存變更並更新畫面。
      const title = card.querySelector('.resume-title');
      title.addEventListener('click', event => event.stopPropagation());
      title.addEventListener('input', () => {
        p.name = title.textContent.trim() || '未命名履歷';
        p.updatedAt = new Date().toISOString();
        
        // 若此為目前開啟的履歷，同步編輯器標題
        const openId = document.querySelector('.resume-card.open')?.dataset.id;
        if (String(p.id) === String(openId)) editorTitle.textContent = p.name;
      });

      title.addEventListener('blur', async () => {
        try {
          await saveProfileToDB(p);   // 將更新傳到後端
          await renderResumeGallery();
        } catch (err) {
          console.error('更新名稱失敗', err);
          alert('儲存履歷名稱失敗');
        }
      });

      resumeGallery.appendChild(card);
    });

    const addCard = document.createElement('button');
    addCard.id = 'addResume';
    addCard.className = 'add-resume-card';
    addCard.type = 'button';
    addCard.innerHTML = `
      <strong>＋ 新增履歷</strong>
      <span>針對不同工作客製化履歷，申請隊伍時選擇要附上的版本。</span>
    `;
    resumeGallery.appendChild(addCard) ;
  }





  // 根據目前照片狀態更新預覽區。
  function renderPhoto(){
    if (!photoState.src) {
      photoPreview.classList.remove('has-photo');
      photoImage.removeAttribute('src');
      photoImage.style.transform = '';
      photoScale.value = '1';
      return;
    }

    photoPreview.classList.add('has-photo');
    photoImage.src = photoState.src;
    photoImage.style.transform = `translate(${photoState.x}px, ${photoState.y}px) scale(${photoState.scale})`;
    photoScale.value = String(photoState.scale);
  }

  // 從履歷資料還原照片與照片調整設定。
  function setPhotoFromData(data){
    photoState = {
      src: data.photo || null,
      scale: data.photoTransform?.scale || 1,
      x: data.photoTransform?.x || 0,
      y: data.photoTransform?.y || 0
    };
    renderPhoto();
  }

  // 將使用者輸入轉成安全文字，避免插入 HTML 時破壞畫面。
  function escapeHtml(value){
    return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // 將 ISO 時間字串轉成台灣常用的日期時間格式。
  function formatDateTime(value){
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '時間未記錄';
    return date.toLocaleString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  // 補齊舊履歷缺少的欄位，讓後續渲染可以使用一致格式。
  // function normalizeProfiles(){
  //   const ps = loadProfiles().map((profile, index) => ({
  //     ...profile,
  //     id: profile.id || Date.now() + index,
  //     name: profile.name || profile.data?.name || `履歷 ${index + 1}`,
  //     createdAt: profile.createdAt || profile.updatedAt || new Date().toISOString(),
  //     updatedAt: profile.updatedAt || profile.createdAt || new Date().toISOString(),
  //     data: profile.data || {}
  //   }));
  //   saveProfiles(ps);
  //   return ps;
  // }

  // 以下通知功能是備援：若共用 notifications.js 未載入，仍可顯示基本通知。
  function loadNotifications(){
    return JSON.parse(localStorage.getItem('notifications')||'[]');
  }

  function saveNotifications(notifications){
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }

  function updateNotificationBadge(){
    const notifyBtn = document.getElementById('notifyBtn');
    if (!notifyBtn) return;
    const unread = loadNotifications().filter(item=>Number(item.userId)===9999 && !item.read).length;
    notifyBtn.textContent = unread ? `🔔 ${unread}` : '🔔';
  }

  function showNotifications(){
    const existing = document.getElementById('notificationModal');
    if (existing) existing.remove();
    const notifications = loadNotifications();
    const myNotifications = notifications.filter(item=>Number(item.userId)===9999);
    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.className = 'modal notification-modal';
    modal.innerHTML = `
      <div class="modal-card notification-card">
        <h3>通知</h3>
        <div class="notification-list">
          ${myNotifications.length ? myNotifications.map(item=>`
            <div class="notification-item ${item.read ? '' : 'unread'}">
              <strong>${escapeHtml(item.message)}</strong>
              <span>${formatDateTime(item.createdAt)}</span>
            </div>
          `).join('') : '<div class="empty-note">目前沒有通知</div>'}
        </div>
        <div class="modal-actions">
          <button id="closeNotificationModal" class="btn outline">關閉</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    notifications.forEach(item=>{ if (Number(item.userId)===9999) item.read = true; });
    saveNotifications(notifications);
    updateNotificationBadge();
    modal.addEventListener('click', e=>{ if (e.target === modal) modal.remove(); });
    document.getElementById('closeNotificationModal').addEventListener('click', ()=>modal.remove());
  }

  function getTeamHref(){
    const userId = localStorage.getItem("userId");
    // new URLSearchParams(window.location.search).get('userId');
    const teamPath = window.location.protocol === 'file:' ? 'team.html' : '/team.html';
    return userId ? `${teamPath}?userId=${encodeURIComponent(userId)}` : teamPath;
  }

  // 讀取隊伍資料，並移除展示用預設隊伍。
  function loadTeams(){
    const defaultNames = ['AI 聯合隊', '機器人挑戰隊', '資料探勘小隊'];
    const teams = JSON.parse(localStorage.getItem('teams')||'[]').filter(team => !defaultNames.includes(team.name));
    localStorage.setItem('teams', JSON.stringify(teams));
    return teams;
  }

  // 讀取比賽資料，並補上預設比賽清單。
  function loadContests(){
    const existing = JSON.parse(localStorage.getItem('contests')||'[]');
    const merged = [...existing];
    seed.forEach(contest => {
      if (!merged.some(item => Number(item.id) === Number(contest.id))) merged.push(contest);
    });
    localStorage.setItem('contests', JSON.stringify(merged));
    return merged;
  }

  // 讓履歷首頁側欄同步顯示已加入隊伍與收藏隊伍。
  function renderSyncedSidebar(){
    if (!myTeamsBox || !followedBox) return;
    const allTeams = loadTeams();
    const contests = loadContests();
    const userId = new URLSearchParams(window.location.search).get('userId');
    const currentUserId = userId && userId !== 'unknown' ? userId : '9999';
    const legacyJoined = JSON.parse(localStorage.getItem('myTeams')||'[]');
    if (legacyJoined.length) {
      const migrated = legacyJoined.map(item => item.id ?? item).filter(id => allTeams.some(team => Number(team.id) === Number(id)));
      localStorage.setItem(`myTeams:${currentUserId}`, JSON.stringify(migrated));
      localStorage.removeItem('myTeams');
    }
    const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`)||'[]');
    const joinedTeams = joinedIds.map(id => allTeams.find(team => Number(team.id) === Number(id))).filter(Boolean);
    const favoriteIds = JSON.parse(localStorage.getItem('favorites')||'[]');
    const favoriteTeams = favoriteIds.map(id=>allTeams.find(team=>Number(team.id)===Number(id))).filter(Boolean);

    myTeamsBox.innerHTML = joinedTeams.length ? joinedTeams.map(team=>{
      const contest = contests.find(item=>Number(item.id)===Number(team.contestId));
      return `<div class="sync-item">
        <strong>${escapeHtml(team.name)}</strong>
        <span>${contest ? escapeHtml(contest.name) : '未指定比賽'}</span>
      </div>`;
    }).join('') : '尚未加入隊伍';

    followedBox.innerHTML = favoriteTeams.length ? favoriteTeams.map(team=>{
      const contest = contests.find(item=>Number(item.id)===Number(team.contestId));
      return `<div class="sync-item">
        <strong>${escapeHtml(team.name)}</strong>
        <span>${contest ? `關注比賽：${escapeHtml(contest.name)}` : '已收藏隊伍'}</span>
      </div>`;
    }).join('') : '無';
  }

  // 依照目前使用者與履歷 ID 組成履歷查看頁連結。
  function getResumeViewHref(id){
    const userId = new URLSearchParams(window.location.search).get('userId');
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    params.set('resumeId', id);
    return `/resume-view.html?${params.toString()}`;
  }



  // 載入指定履歷並切換到編輯畫面。
  function loadProfile(id){
    setActiveProfileId(id);
    loadEditorData();
    showEditor();
  }

  // 將目前選取履歷的資料填入表單。
  async function loadEditorData(){
    const activeId = getActiveProfileId();
    const ps = await loadProfiles();
    const profile = ps.find(x=>String(x.id)===String(activeId)) || ps[0] || null;
    const data = profile ? profile.data : {};
    if (profile && !activeId) setActiveProfileId(profile.id);
    editorTitle.textContent = profile?.name || '新增履歷';
    $('name').value = data.name||'';
    $('school').value = data.school||'';
    $('grade').value = data.grade||'';
    $('experience').value = data.experience||'';
    $('intro').value = data.intro||'';
    const tags = data.tags||[]; renderTags(tags);
    window._tags = tags;
    setPhotoFromData(data);
  }

  // 顯示履歷列表首頁。
  async function showGallery(){
    resumeHome.hidden = false;
    resumeEditor.hidden = true;
    await renderResumeGallery();
    renderSyncedSidebar();
  }

  // 顯示履歷編輯器。
  async function showEditor(){
    resumeHome.hidden = true;
    resumeEditor.hidden = false;
    await renderResumeGallery();
  }

  // 頁面初次載入時先讀資料，再顯示列表。
  async function load(){
    await loadEditorData();
    await showGallery();
  }

  addTag.addEventListener('click', ()=>{
    const v = newTag.value.trim(); if(!v) return; window._tags = window._tags||[]; window._tags.push(v); newTag.value=''; renderTags(window._tags);
  });

  resumeGallery.addEventListener('click', event => {
    const addCard = event.target.closest('#addResume');
    const viewButton = event.target.closest('.view-resume');
    const card = event.target.closest('.resume-card');

    if (addCard) {
      createResume();
      return;
    }

    if (viewButton && card) {
      event.stopPropagation();
      window.location.href = getResumeViewHref(card.dataset.id);
      return;
    }

    if (card && !event.target.closest('.resume-title')) loadProfile(card.dataset.id);
  });

  //=======???======

  //===============
// ======= 修正後：真正與後端 DB 連線的新增履歷 =======
  async function createResume(){
    try {
      // 1. 先準備一份要送給後端的全新空履歷格式
      const newProfilePayload = {
        resume_id: undefined,        // 🌟 傳 undefined，後端看到就知道這是「全新建立」
        resume_name: '新履歷',
        user_school: '',
        department_grade: '',
        user_intro: '',
        tags: []                     // 一開始沒有標籤，傳空陣列
      };

      // 2. 發送給後端，請資料庫執行 INSERT INTO Resumes...
      // saveProfileToDB 就是我們之前對齊過後端的那支 fetch 函式
      const result = await saveProfileToDB(newProfilePayload);

      // 3. 後端成功寫入後，會回傳 { ok: true, resumeId: 15 }
      // 我們要把後端資料庫幫我們生成的「真正 ID」拿回來！
      const trueId = result.resumeId;

      // 4. 把這個真正的 ID 鎖定為目前正在編輯的履歷
      setActiveProfileId(trueId);

      // 5. 重新跟後端拉取最新列表（這樣快取 cachedProfiles 才會拿到最新有這份新履歷的資料）
      await loadProfiles(); 

      // 6. 把這份新履歷的空白欄位填入右邊編輯器，並切換到編輯畫面
      await loadEditorData();
      showEditor();

    } catch (err) {
      console.error('建立履歷失敗，原因：', err);
      alert('無法建立新履歷，請檢查網路或資料庫連線');
    }
  }

  backToGallery.addEventListener('click', showGallery);


  viewResumeBtn.addEventListener('click', ()=>{
    const activeId = localStorage.getItem("userId"); 
    if (!activeId) { alert('請先新增或選擇一份履歷'); return; }
    window.location.href = getResumeViewHref(activeId);
  });

  // 刪除按鈕目前選取的履歷，並更新畫面。
// 刪除按鈕：利用 card.dataset.id 抓出當前開啟的履歷並刪除
  delResume.addEventListener('click', async ()=>{
    // 1. 抓出畫面上目前被打開、蓋著「開啟」緞帶的那張履歷卡片
    const activeCard = document.querySelector('.resume-card.open');
    
    // 2. 防呆：萬一使用者還沒點任何卡片就按刪除，提示他
    if(!activeCard){ 
      alert('沒有選中的履歷'); 
      return; 
    }
    
    // 🌟 3. 精髓在這一行！直接從這張卡片的 HTML 號碼牌（data-id）把履歷 ID 挖出來！
    const resumeIdToDelete = activeCard.dataset.id;

    // 4. 跳出確認視窗，問使用者是不是真的要刪除
    if (!confirm('確定要刪除這份履歷嗎？')) return;

    try {
      // 5. 呼叫刪除 API，把剛剛挖到的「真．履歷 ID」傳給後端
      const success = await deleteProfile(resumeIdToDelete);
      
      if (success) {
        // 🌟 6. 刪除成功後，清除全域的選取狀態（因為那份履歷已經在地球上消失了）
        setActiveProfileId(null); 
        
        // 7. 重新向後端重新整理列表，那張卡片就會從畫面上消失
        await renderResumeGallery();
        
        // 8. 讓右邊的編輯器表單恢復空白（或是抓剩下第一份的資料）
        await loadEditorData();
        
        alert('履歷已成功刪除！');
      }
    } catch (err) {
      console.error('刪除過程中發生錯誤：', err);
      alert('刪除失敗，請檢查資料庫連線');
    }
  });

  exportBtn.addEventListener('click', ()=>{
    const data = {
      name:$('name').value, school:$('school').value, grade:$('grade').value,
      experience:$('experience').value, intro:$('intro').value, tags: window._tags||[],
      photo: photoState.src,
      photoTransform: { scale: photoState.scale, x: photoState.x, y: photoState.y }
    };
    const s = JSON.stringify(data, null, 2);
    const blob = new Blob([s], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='profile.json'; a.click(); URL.revokeObjectURL(url);
  });

  // 即時同步姓名欄位：主姓名輸入變更時，同步更新目前履歷資料。
  $('name').addEventListener('input', async (e)=>{
    const v = e.target.value;
    const activeId = getActiveProfileId();
    if (!activeId) return;
    const ps = await loadProfiles();
    const idx = ps.findIndex(p=>String(p.id)===String(activeId));
    if (idx>=0){ ps[idx].data = { ...(ps[idx].data || {}), name: v }; ps[idx].updatedAt = new Date().toISOString(); saveProfiles(ps); }
  });

// 儲存按鈕：收集表單欄位，並送進後端資料庫（自動判斷是「新增」還是「更新」）
  saveBtn.addEventListener('click', async ()=>{
    // 1. 檢查防呆：名字、學校、自我介紹，至少要撈得到網頁上的值
    const currentName = $('name').value.trim();
    const currentSchool = $('school').value.trim();
    const currentGrade = $('grade').value.trim();
    const currentIntro = $('intro').value.trim();

    // 2. 翻開我們前端的「紀錄本」，看看目前有沒有選中的履歷 ID
    const activeResumeId = getActiveProfileId();

    // 3. 把要送給後端的包裹（Payload）包好，只留資料庫（Schema）有的欄位！
    const payload = {
      // 如果 activeResumeId 存在，轉成數字送過去（後端就知道是 UPDATE）；不存在就是 undefined（後端執行 INSERT）
      resume_id: activeResumeId ? Number(activeResumeId) : undefined,
      resume_name: currentName || '未命名履歷',
      user_school: currentSchool,
      department_grade: currentGrade,
      user_intro: currentIntro,
      tags: window._tags || [] // 拿目前存在記憶體全域的標籤陣列
    };

    try {
      // 4. 送去給我們之前接好後端的 saveProfileToDB 函式
      const result = await saveProfileToDB(payload);

      // 5. 🌟 關鍵：如果是「第一次存全新履歷」，後端會產生一個新 ID
      // 我們要把這個新 ID 抓回來，更新前端的紀錄本，不然下次再按儲存就會變成重複新增了！
      if (result && result.resumeId) {
        setActiveProfileId(result.resumeId);
      }

      // 6. 儲存成功後，重新跟後端拉取最新資料更新快取
      await loadProfiles();

      // 7. 重新刷洗左邊的履歷卡片列表（這樣卡片上的更新時間、名字才會同步變更）
      await renderResumeGallery();

      alert('已成功儲存至資料庫！');

    } catch (err) {
      console.error('儲存按鈕執行失敗：', err);
      alert('儲存失敗，請確認後端伺服器與資料庫是否正常連線');
    }
  });

  photo.addEventListener('change', e=>{
    const f = e.target.files && e.target.files[0]; if(!f) return;
    const reader = new FileReader(); reader.onload = ()=>{
      photoState = { src: reader.result, scale: 1, x: 0, y: 0 };
      renderPhoto();
    };
    reader.readAsDataURL(f);
  });

  photoScale.addEventListener('input', e=>{
    photoState.scale = Number(e.target.value);
    renderPhoto();
  });

  resetPhoto.addEventListener('click', ()=>{
    photoState.scale = 1;
    photoState.x = 0;
    photoState.y = 0;
    renderPhoto();
  });

  // 拖曳照片預覽區時，更新照片在框內的位置。
  photoPreview.addEventListener('pointerdown', e=>{
    if (!photoState.src) return;
    photoPreview.setPointerCapture(e.pointerId);
    const start = { pointerX: e.clientX, pointerY: e.clientY, photoX: photoState.x, photoY: photoState.y };

    function onPointerMove(moveEvent){
      photoState.x = start.photoX + moveEvent.clientX - start.pointerX;
      photoState.y = start.photoY + moveEvent.clientY - start.pointerY;
      renderPhoto();
    }

    function onPointerUp(upEvent){
      photoPreview.releasePointerCapture(upEvent.pointerId);
      photoPreview.removeEventListener('pointermove', onPointerMove);
      photoPreview.removeEventListener('pointerup', onPointerUp);
      photoPreview.removeEventListener('pointercancel', onPointerUp);
    }

    photoPreview.addEventListener('pointermove', onPointerMove);
    photoPreview.addEventListener('pointerup', onPointerUp);
    photoPreview.addEventListener('pointercancel', onPointerUp);
  });

  // 右上角按鈕的防禦性綁定，避免缺少共用模組時整頁失效。
  try {
    console.log('profile.js loaded - binding top-right buttons');
    const notifyBtn = document.getElementById('notifyBtn');
    const avatarBtn = document.getElementById('avatarBtn');
    const teamBtn = document.getElementById('teamBtn');
    if (notifyBtn && !window.AppNotifications) notifyBtn.addEventListener('click', showNotifications);
    if (teamBtn) {
      const teamHref = getTeamHref();
      teamBtn.setAttribute('href', teamHref);
      teamBtn.addEventListener('click', event=>{
        event.preventDefault();
        window.location.href = teamHref;
      });
      teamBtn.setAttribute('data-href', teamHref);
    }
  } catch (err) {
    console.error('Error binding top-right buttons:', err);
    // 若綁定失敗，至少保留組隊按鈕的基本導頁能力。
    const teamBtn = document.getElementById('teamBtn');
    if (teamBtn) teamBtn.setAttribute('href', 'team.html');
  }
  document.querySelector('.logo-link')?.setAttribute('href', new URLSearchParams(window.location.search).get('userId') ? `/team.html?userId=${encodeURIComponent(new URLSearchParams(window.location.search).get('userId'))}` : '/team.html');
  window.addEventListener('storage', e=>{
    if (['myTeams','favorites','teams','contests'].includes(e.key)) renderSyncedSidebar();
    if (e.key === 'notifications' && !window.AppNotifications) updateNotificationBadge();
  });

    load();
    if (!window.AppNotifications) updateNotificationBadge();
  }

  // 確保 DOM 完成後才初始化，並記錄啟動錯誤方便除錯。
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  } catch (err) {
    console.error('profile.js initialization failed:', err);
  }
})();

/*const seed = [
      { id: 10, name: '全國資料科學競賽', date: '2026-07-20', info: '針對資料科學專題的校內外隊伍競賽' },
      { id: 11, name: '全國機器人盃', date: '2026-09-10', info: '機器人實作與競賽' },
      { id: 12, name: '校園創新黑客松', date: '2026-08-15', info: '48 小時產品原型、簡報與實作挑戰' },
      { id: 13, name: '智慧醫療應用競賽', date: '2026-10-02', info: '結合資料分析、AI 與醫療場景的跨域競賽' },
      { id: 14, name: '永續科技提案賽', date: '2026-11-18', info: '以永續、能源與社會影響為主題的提案競賽' },
      { id: 15, name: '金融科技創意賽', date: '2026-12-05', info: '金融資料、風控、支付與數位服務創新競賽' }
    ];*/



// // 全域快取與狀態變數，供所有內部函式共用
// let cachedProfiles = [];
// let activeProfileId = null;

// (function(){

//   // 初始化履歷頁面，集中取得 DOM 元素並綁定互動事件。
//   function init(){
//     const $ = id => document.getElementById(id);
//     const saveBtn = $('saveBtn');
//     const exportBtn = $('exportBtn');
//     const delResume = $('delResume');
//     const resumeHome = $('resumeHome');
//     const resumeEditor = $('resumeEditor');
//     const resumeGallery = $('resumeGallery');
//     const backToGallery = $('backToGallery');
//     const viewResumeBtn = $('viewResumeBtn');
//     const editorTitle = $('editorTitle');
//     const addTag = $('addTag');
//     const newTag = $('newTag');
//     const tagsWrap = $('tags');
//     const myTeamsBox = $('myTeams');
//     const followedBox = $('followed');

//     // 取得 token
//     function getAuthHeader() {
//       const token = localStorage.getItem('token'); 
//       return token ? { 'Authorization': `${token}` } : {}; 
//     }

//     // 載入：從資料庫獲取所有履歷
//     async function loadProfiles(){
//       try {
//         const res = await fetch('/api/pv/loadPV', { 
//           headers: { ...getAuthHeader() }
//         });
//         if (!res.ok) throw new Error('無法取得履歷資料');
//         const dbData = await res.json();
        
//         // 在快取記憶體中做資料標準化（取代舊的 normalizeProfiles）
//         cachedProfiles = dbData.map((profile, index) => ({
//           ...profile,
//           id: profile.id || profile._id || String(Date.now() + index),
//           name: profile.name || profile.data?.name || `履歷 ${index + 1}`,
//           createdAt: profile.createdAt || new Date().toISOString(),
//           updatedAt: profile.updatedAt || new Date().toISOString(),
//           data: profile.data || {}
//         }));
        
//         return cachedProfiles;
//       } catch (err) {
//         console.error(err);
//         alert('讀取資料庫失敗');
//         return [];
//       }
//     }

//     // 儲存：將特定履歷資料推送到資料庫
//     async function saveProfileToDB(profilePayload){
//       try {
//         const res = await fetch('/api/pv/savePV', { 
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             ...getAuthHeader()
//           },
//           body: JSON.stringify(profilePayload)
//         });
//         if (!res.ok) throw new Error('儲存失敗');
//         const result = await res.json();
//         return result; 
//       } catch (err) {
//         console.error(err);
//         alert('儲存到資料庫失敗');
//         throw err;
//       }
//     }

//     // 刪除：通知資料庫移除特定 ID 的履歷
//     async function deleteProfile(id){
//       try {
//         const res = await fetch(`/api/pv/deletePV/${id}`, { 
//           method: 'DELETE',
//           headers: { ...getAuthHeader() }
//         });
//         if (!res.ok) throw new Error('刪除失敗');
//         return true;
//       } catch (err) {
//         console.error(err);
//         alert('刪除履歷失敗');
//         return false;
//       }
//     }

//     // 將專長標籤渲染成可移除的 tag。
//     function renderTags(tags){
//       tagsWrap.innerHTML = '';
//       tags.forEach((t, i)=>{
//         const el = document.createElement('span'); el.className = 'tag'; el.textContent = t;
//         const rem = document.createElement('span'); rem.className = 'remove'; rem.textContent = '✕'; 
//         rem.onclick = ()=>{ 
//           tags.splice(i, 1); 
//           renderTags(tags); 
//         };
//         el.appendChild(rem); tagsWrap.appendChild(el);
//       });
//     }
  
//     // =====================================
//     //  UI 渲染與狀態管理
//     // =====================================

//     // 將使用者輸入轉成安全文字，避免插入 HTML 時破壞畫面。
//     function escapeHtml(value){
//       return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
//     }

//     // 將 ISO 時間字串轉成台灣常用的日期時間格式。
//     function formatDateTime(value){
//       const date = value ? new Date(value) : new Date();
//       if (Number.isNaN(date.getTime())) return '時間未記錄';
//       return date.toLocaleString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
//     }

//     // 依照目前使用者與履歷 ID 組成履歷查看頁連結。
//     function getResumeViewHref(id){
//       const userId = localStorage.getItem("userId");
//       const params = new URLSearchParams();
//       if (userId) params.set('userId', userId);
//       params.set('resumeId', id);
//       return `/resume-view.html?${params.toString()}`;
//     }

//     // 渲染履歷卡片列表，以及新增履歷卡片。
//     async function renderResumeGallery(){
//       await loadProfiles(); // ✅ 渲染前先調用你的 async loadProfiles() 確保最新資料存入 cachedProfiles
//       const ps = cachedProfiles;
//       resumeGallery.innerHTML = '';
//       const activeId = activeProfileId;
      
//       ps.forEach(p => {
//         const card = document.createElement('article');
//         card.className = `resume-card${String(p.id) === String(activeId) ? ' open' : ''}`;
//         card.dataset.id = p.id;
//         card.innerHTML = `
//           <div class="resume-cover"><span class="resume-ribbon">開啟</span></div>
//           <div class="resume-body">
//             <h3 class="resume-title" contenteditable="true" spellcheck="false">${escapeHtml(p.name || '未命名履歷')}</h3>
//             <span class="resume-time">${formatDateTime(p.updatedAt || p.createdAt)}</span>
//             <div class="resume-card-actions">
//               <button class="icon-action view-resume" type="button" aria-label="查看履歷">查看</button>
//               <button class="icon-action edit-resume" type="button" aria-label="編輯履歷">...</button>
//             </div>
//           </div>
//         `;
        
//         const title = card.querySelector('.resume-title');
//         title.addEventListener('click', event => event.stopPropagation());
        
//         // 在列表直接內聯修改標題時，即時打 API 更新 DB
//         title.addEventListener('blur', async () => {
//           const newName = title.textContent.trim() || '未命名履歷';
//           if (newName !== p.name) {
//             p.name = newName;
//             p.updatedAt = new Date().toISOString();
//             await saveProfileToDB(p);
//             if (String(p.id) === String(activeProfileId)) {
//               editorTitle.textContent = newName;
//             }
//             renderResumeGallery();
//           }
//         });
        
//         resumeGallery.appendChild(card);
//       });

//       // 🌟 新增履歷按鈕順暢產出
//       const addCard = document.createElement('button');
//       addCard.id = 'addResume';
//       addCard.className = 'add-resume-card';
//       addCard.type = 'button';
//       addCard.innerHTML = `
//         <strong>＋ 新增履歷</strong>
//         <span>針對不同工作客製化履歷，申請隊伍時選擇要附上的版本。</span>
//       `;
//       resumeGallery.appendChild(addCard);
//     }

//     // 載入指定履歷並切換到編輯畫面。
//     function loadProfile(id){
//       activeProfileId = id;
//       loadEditorData();
//       showEditor();
//     }

//     // 將目前選取履歷的資料填入表單。
//     function loadEditorData(){
//       const activeId = activeProfileId;
//       const ps = cachedProfiles;
//       const profile = ps.find(x=>String(x.id)===String(activeId)) || ps[0] || null;
//       const data = profile ? profile.data : {};
      
//       if (profile && !activeId) activeProfileId = profile.id;
//       editorTitle.textContent = profile?.name || '新增履歷';
      
//       $('name').value = data.name||'';
//       $('school').value = data.school||'';
//       $('grade').value = data.grade||'';
//       $('experience').value = data.experience||'';
//       $('intro').value = data.intro||'';
      
//       const tags = data.tags||[]; renderTags(tags);
//       window._tags = tags;
//     }

//     // 顯示履歷列表首頁。
//     function showGallery(){
//       resumeHome.hidden = false;
//       resumeEditor.hidden = true;
//       renderResumeGallery();
//       renderSyncedSidebar();
//     }

//     // 顯示履歷編輯器。
//     function showEditor(){
//       resumeHome.hidden = true;
//       resumeEditor.hidden = false;
//     }

//     // 頁面初次載入時先讀資料，再顯示列表。
//     async function load(){
//       await loadProfiles();
//       if (cachedProfiles.length > 0) {
//         activeProfileId = cachedProfiles[0].id;
//       }
//       loadEditorData();
//       showGallery();
//     }

//     addTag.addEventListener('click', ()=>{
//       const v = newTag.value.trim(); if(!v) return; window._tags = window._tags||[]; window._tags.push(v); newTag.value=''; renderTags(window._tags);
//     });

//     resumeGallery.addEventListener('click', async event => {
//       const addCard = event.target.closest('#addResume');
//       const viewButton = event.target.closest('.view-resume');
//       const card = event.target.closest('.resume-card');

//       if (addCard) {
//         await createResume();
//         return;
//       }

//       if (viewButton && card) {
//         event.stopPropagation();
//         window.location.href = getResumeViewHref(card.dataset.id);
//         return;
//       }

//       if (card && !event.target.closest('.resume-title')) loadProfile(card.dataset.id);
//     });

//     // 建立新履歷：直接 POST 回後端資料庫
//     async function createResume(){
//       const id = String(Date.now());
//       const now = new Date().toISOString();
//       const newProfile = { 
//         id, 
//         name: '新履歷', 
//         createdAt: now, 
//         updatedAt: now, 
//         data: { name: '', school: '', grade: '', experience: '', intro: '', tags: [] } 
//       };
      
//       await saveProfileToDB(newProfile);
//       activeProfileId = id;
//       await renderResumeGallery(); 
//       loadEditorData(); 
//       showEditor();
//     }

//     backToGallery.addEventListener('click', showGallery);

//     viewResumeBtn.addEventListener('click', ()=>{
//       if (!activeProfileId) { alert('請先新增或選擇一份履歷'); return; }
//       window.location.href = getResumeViewHref(activeProfileId);
//     });

//     // 刪除功能：同步刪除 DB 資料
//     delResume.addEventListener('click', async ()=>{
//       if(!activeProfileId){ alert('沒有選中的履歷'); return; }
//       if(!confirm('確定要刪除這份履歷嗎？')) return;

//       const success = await deleteProfile(activeProfileId);
//       if (success) {
//         cachedProfiles = cachedProfiles.filter(p => String(p.id) !== String(activeProfileId));
//         if (cachedProfiles.length) activeProfileId = cachedProfiles[0].id; 
//         else activeProfileId = null;
//         showGallery();
//       }
//     });

//     exportBtn.addEventListener('click', ()=>{
//       const data = {
//         name:$('name').value, school:$('school').value, grade:$('grade').value,
//         experience:$('experience').value, intro:$('intro').value, tags: window._tags||[]
//       };
//       const s = JSON.stringify(data, null, 2);
//       const blob = new Blob([s], {type:'application/json'});
//       const url = URL.createObjectURL(blob);
//       const a = document.createElement('a'); a.href=url; a.download='profile.json'; a.click(); URL.revokeObjectURL(url);
//     });

//     // 點擊儲存按鈕：完整表單非同步發送至後端
//     saveBtn.addEventListener('click', async () => {
//       const data = {
//         name:$('name').value, school:$('school').value, grade:$('grade').value,
//         experience:$('experience').value, intro:$('intro').value, tags: window._tags||[]
//       };
      
//       let profile = cachedProfiles.find(p => String(p.id) === String(activeProfileId));
//       if (!profile) {
//         profile = {
//           id: activeProfileId || String(Date.now()),
//           name: data.name || '履歷',
//           createdAt: new Date().toISOString(),
//           data: data
//         };
//       } else {
//         profile.data = data;
//         profile.name = data.name || profile.name;
//       }
//       profile.updatedAt = new Date().toISOString();

//       await saveProfileToDB(profile);
//       alert('已成功儲存到資料庫！');
//       showGallery();
//     });

//     // =====================================
//     // 側邊欄同步輔助系統
//     // =====================================
//     function getTeamHref(){
//       const userId = localStorage.getItem("userId");
//       const teamPath = window.location.protocol === 'file:' ? 'team.html' : '/team.html';
//       return userId ? `${teamPath}?userId=${encodeURIComponent(userId)}` : teamPath;
//     }

//     function renderSyncedSidebar(){
//       if (!myTeamsBox || !followedBox) return;
//       const allTeams = JSON.parse(localStorage.getItem('teams')||'[]');
//       const contests = JSON.parse(localStorage.getItem('contests')||'[]');
//       const userId = localStorage.getItem("userId");
//       const currentUserId = userId && userId !== 'unknown' ? userId : '9999';
      
//       const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`)||'[]');
//       const joinedTeams = joinedIds.map(id => allTeams.find(team => Number(team.id) === Number(id))).filter(Boolean);
//       const favoriteIds = JSON.parse(localStorage.getItem('favorites')||'[]');
//       const favoriteTeams = favoriteIds.map(id=>allTeams.find(team=>Number(team.id)===Number(id))).filter(Boolean);

//       myTeamsBox.innerHTML = joinedTeams.length ? joinedTeams.map(team=>{
//         const contest = contests.find(item=>Number(item.id)===Number(team.contestId));
//         return `<div class="sync-item"><strong>${escapeHtml(team.name)}</strong><span>${contest ? escapeHtml(contest.name) : '未指定比賽'}</span></div>`;
//       }).join('') : '尚未加入隊伍';

//       followedBox.innerHTML = favoriteTeams.length ? favoriteTeams.map(team=>{
//         const contest = contests.find(item=>Number(item.id)===Number(team.contestId));
//         return `<div class="sync-item"><strong>${escapeHtml(team.name)}</strong><span>${contest ? `關注比賽：${escapeHtml(contest.name)}` : '已收藏隊伍'}</span></div>`;
//       }).join('') : '無';
//     }

//     // 右上角按鈕防禦性綁定
//     try {
//       console.log('profile.js loaded - binding top-right buttons');
//       const teamBtn = document.getElementById('teamBtn');
//       if (teamBtn) {
//         const teamHref = getTeamHref();
//         teamBtn.setAttribute('href', teamHref);
//       }
//     } catch (err) {
//       console.error('Error binding top-right buttons:', err);
//     }
    
//     document.querySelector('.logo-link')?.setAttribute('href', localStorage.getItem("userId") ? `/team.html?userId=${encodeURIComponent(localStorage.getItem("userId"))}` : '/team.html');

//     // 啟動載入
//     load();
//   } // ✅ init 函式大括號在最尾端完美閉合

//   // 確保 DOM 完成後才初始化
//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', init);
//   } else {
//     init();
//   }
// })();

// import { get } from "http";

// (function(){

//   // 初始化履歷頁面，集中取得 DOM 元素並綁定互動事件。
//   function init(){
//     const $ = id => document.getElementById(id);
//     const saveBtn = $('saveBtn');
//     const exportBtn = $('exportBtn');
//     const delResume = $('delResume');
//     const resumeHome = $('resumeHome');
//     const resumeEditor = $('resumeEditor');
//     const resumeGallery = $('resumeGallery');
//     const backToGallery = $('backToGallery');
//     const viewResumeBtn = $('viewResumeBtn');
//     const editorTitle = $('editorTitle');
//     const addTag = $('addTag');
//     const newTag = $('newTag');
//     const tagsWrap = $('tags');
//     const myTeamsBox = $('myTeams');
//     const followedBox = $('followed');

//     // 取得token
//     function getAuthHeader() {
//       const token = localStorage.getItem('token'); 
//       const userId = localStorage.getItem("userId");
//       return token ? { 'Authorization': `${token}` } : {}, userId; 
//     }

//     // 載入
//     async function loadProfiles(){
//       try {
//         const res = await fetch('/api/pv/loadPV', { // 🌟 請確保這與你的 Express Route 路由一致
//           headers: { ...getAuthHeader() }
//         });
//         if (!res.ok) throw new Error('無法取得履歷資料');
//         cachedProfiles = await res.json();
//         return cachedProfiles;
//       } catch (err) {
//         console.error(err);
//         alert('讀取資料庫失敗');
//         return [];
//       }
//     }

//     // 儲存
//     async function saveProfiles(){
//       try {
//         const res = await fetch('/api/pv/savePV', { 
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             ...getAuthHeader()
//           },
//           body: JSON.stringify(profilePayload)
//         });
//         if (!res.ok) throw new Error('儲存失敗');
//         const result = await res.json();
//         return result; // 後端回傳 { ok: true, message: '...', resumeId: xxx }
//       } catch (err) {
//         console.error(err);
//         alert('儲存到資料庫失敗');
//         throw err;
//       }
//     }

//     //刪除
//     async function deleteProfile(id){
//       try {
//         const res = await fetch(`/api/pv/deletePV/${id}`, { // 🌟 網址對應 /deletePV/:id
//           method: 'DELETE',
//           headers: { ...getAuthHeader() }
//         });
//         if (!res.ok) throw new Error('刪除失敗');
//         return true;
//       } catch (err) {
//         console.error(err);
//         alert('刪除履歷失敗');
//         return false;
//       }
//     }

//     // =====================================

//   // 履歷資料儲存在 localStorage.profiles，格式為 { id, name, data }。
//   // function loadProfiles(){
//   //   return JSON.parse(localStorage.getItem('profiles')||'[]');
//   // }

//   // function saveProfiles(p){ localStorage.setItem('profiles', JSON.stringify(p)); }

//   // function setActiveProfileId(id){ localStorage.setItem('activeProfileId', String(id)); }

//   // function getActiveProfileId(){ return localStorage.getItem('activeProfileId') || null; }

//   // 將專長標籤渲染成可移除的 tag。
//     function renderTags(tags){
//       tagsWrap.innerHTML = '';
//       tags.forEach((t,i)=>{
//         const el = document.createElement('span'); el.className='tag'; el.textContent = t;
//         const rem = document.createElement('span'); rem.className='remove'; rem.textContent='✕'; rem.onclick = ()=>{ tags.splice(i,1); renderTags(tags); };
//         el.appendChild(rem); tagsWrap.appendChild(el);
//       });
//     }
  
//   // =====================================
//   //  UI 渲染與狀態管理
//   // =====================================

//   // 將使用者輸入轉成安全文字，避免插入 HTML 時破壞畫面。
//   function escapeHtml(value){
//     return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
//   }

//   // 將 ISO 時間字串轉成台灣常用的日期時間格式。
//   function formatDateTime(value){
//     const date = value ? new Date(value) : new Date();
//     if (Number.isNaN(date.getTime())) return '時間未記錄';
//     return date.toLocaleString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
//   }

//   // 渲染履歷卡片列表，以及新增履歷卡片。
//   function renderResumeGallery(){

//     await loadProfiles(); // ✅ 渲染前先調用你的 async loadProfiles() 確保最新資料存入 cachedProfiles
//     const ps = cachedProfiles;
//     // const ps = normalizeProfiles();
//     resumeGallery.innerHTML = '';
//     const activeId = getActiveProfileId();
//     ps.forEach(p => {
//       const card = document.createElement('article');
//       card.className = `resume-card${String(p.id) === String(activeId) ? ' open' : ''}`;
//       card.dataset.id = p.id;
//       card.innerHTML = `
//         <div class="resume-cover"><span class="resume-ribbon">開啟</span></div>
//         <div class="resume-body">
//           <h3 class="resume-title" contenteditable="true" spellcheck="false">${escapeHtml(p.name || '未命名履歷')}</h3>
//           <span class="resume-time">${formatDateTime(p.updatedAt || p.createdAt)}</span>
//           <div class="resume-card-actions">
//             <button class="icon-action view-resume" type="button" aria-label="查看履歷">查看</button>
//             <button class="icon-action edit-resume" type="button" aria-label="編輯履歷">...</button>
//           </div>
//         </div>
//       `;
//       const title = card.querySelector('.resume-title');
//       title.addEventListener('click', event => event.stopPropagation());
//       title.addEventListener('input', () => {
//         const next = loadProfiles();
//         const idx = next.findIndex(item => String(item.id) === String(p.id));
//         if (idx >= 0) {
//           next[idx].name = title.textContent.trim() || '未命名履歷';
//           next[idx].updatedAt = new Date().toISOString();
//           saveProfiles(next);
//           if (String(p.id) === String(getActiveProfileId())) editorTitle.textContent = next[idx].name;
//         }
//       });
//       title.addEventListener('blur', renderResumeGallery);
//       resumeGallery.appendChild(card);
//     });

//     const addCard = document.createElement('button');
//     addCard.id = 'addResume';
//     addCard.className = 'add-resume-card';
//     addCard.type = 'button';
//     addCard.innerHTML = `
//       <strong>＋ 新增履歷</strong>
//       <span>針對不同工作客製化履歷，申請隊伍時選擇要附上的版本。</span>
//     `;
//     resumeGallery.appendChild(addCard);
//   }

//   // 載入指定履歷並切換到編輯畫面。
//   function loadProfile(id){
//     setActiveProfileId(id);
//     loadEditorData();
//     showEditor();
//   }

//   // 將目前選取履歷的資料填入表單。
//   function loadEditorData(){
//     getAuthHeader();
//     const activeId = ();
//     const ps = ();
//     const profile = ps.find(x=>String(x.id)===String(activeId)) || ps[0] || null;
//     const data = profile ? profile.data : {};
//     if (profile && !activeId) setActiveProfileId(profile.id);
//     editorTitle.textContent = profile?.name || '新增履歷';
//     $('name').value = data.name||'';
//     $('school').value = data.school||'';
//     $('grade').value = data.grade||'';
//     $('experience').value = data.experience||'';
//     $('intro').value = data.intro||'';
//     const tags = data.tags||[]; renderTags(tags);
//     window._tags = tags;
//   //    setPhotoFromData(data);
//   }

//   // 顯示履歷列表首頁。
//   function showGallery(){
//     resumeHome.hidden = false;
//     resumeEditor.hidden = true;
//     renderResumeGallery();
//     renderSyncedSidebar();
//   }

//   // 顯示履歷編輯器。
//   function showEditor(){
//     resumeHome.hidden = true;
//     resumeEditor.hidden = false;
//     renderResumeGallery();
//   }

//   // 頁面初次載入時先讀資料，再顯示列表。
//   function load(){
//     loadEditorData();
//     showGallery();
//   }

//   addTag.addEventListener('click', ()=>{
//     const v = newTag.value.trim(); if(!v) return; window._tags = window._tags||[]; window._tags.push(v); newTag.value=''; renderTags(window._tags);
//   });

//   resumeGallery.addEventListener('click', event => {
//     const addCard = event.target.closest('#addResume');
//     const viewButton = event.target.closest('.view-resume');
//     const card = event.target.closest('.resume-card');

//     if (addCard) {
//       createResume();
//       return;
//     }

//     if (viewButton && card) {
//       event.stopPropagation();
//       window.location.href = getResumeViewHref(card.dataset.id);
//       return;
//     }

//     if (card && !event.target.closest('.resume-title')) loadProfile(card.dataset.id);
//   });

//   function createResume(){
//     const ps = loadProfiles(); 
//     const id = Date.now();
//     const now = new Date().toISOString();
//     const newProfile = { id, name: '新履歷', createdAt: now, updatedAt: now, data: {} };
//     ps.unshift(newProfile); saveProfiles(ps); setActiveProfileId(id); loadEditorData(); showEditor();
//   }

//   backToGallery.addEventListener('click', showGallery);

//   viewResumeBtn.addEventListener('click', ()=>{
//     const activeId = getActiveProfileId();
//     if (!activeId) { alert('請先新增或選擇一份履歷'); return; }
//     window.location.href = getResumeViewHref(activeId);
//   });

//   delResume.addEventListener('click', ()=>{
//     const activeId = getActiveProfileId(); if(!activeId){ alert('沒有選中的履歷'); return; }
//     let ps = loadProfiles(); ps = ps.filter(p=>String(p.id)!==String(activeId)); saveProfiles(ps);
//     if (ps.length) setActiveProfileId(ps[0].id); else localStorage.removeItem('activeProfileId');
//     showGallery();
//   });

//   exportBtn.addEventListener('click', ()=>{
//     const data = {
//       name:$('name').value, school:$('school').value, grade:$('grade').value,
//       experience:$('experience').value, intro:$('intro').value, tags: window._tags||[],
//       // photo: photoState.src,
//       // photoTransform: { scale: photoState.scale, x: photoState.x, y: photoState.y }
//     };
//     const s = JSON.stringify(data, null, 2);
//     const blob = new Blob([s], {type:'application/json'});
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a'); a.href=url; a.download='profile.json'; a.click(); URL.revokeObjectURL(url);
//   });

//   // 即時同步姓名欄位：主姓名輸入變更時，同步更新目前履歷資料。
//   $('name').addEventListener('input', (e)=>{
//     const v = e.target.value;
//     const activeId = getActiveProfileId();
//     if (!activeId) return;
//     const ps = loadProfiles();
//     const idx = ps.findIndex(p=>String(p.id)===String(activeId));
//     if (idx>=0){ ps[idx].data = { ...(ps[idx].data || {}), name: v }; ps[idx].updatedAt = new Date().toISOString(); saveProfiles(ps); }
//   });

//   saveBtn.addEventListener('click', ()=>{
//     const data = {
//       name:$('name').value, school:$('school').value, grade:$('grade').value,
//       experience:$('experience').value, intro:$('intro').value, tags: window._tags||[],
//       photo: photoState.src,
//       photoTransform: { scale: photoState.scale, x: photoState.x, y: photoState.y }
//     };
//     // 將表單資料儲存到目前履歷；若尚未有履歷，則建立一份新的。
//     let ps = loadProfiles(); let activeId = getActiveProfileId();
//     if (!activeId) { // create one
//       const id = Date.now(); const now = new Date().toISOString(); ps.unshift({ id, name: data.name || '履歷', createdAt: now, updatedAt: now, data }); setActiveProfileId(id);
//     } else {
//       const idx = ps.findIndex(p=>String(p.id)===String(activeId));
//       if (idx>=0) { ps[idx].data = data; ps[idx].updatedAt = new Date().toISOString(); }
//       else { ps.unshift({ id: activeId, name: data.name||'履歷', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), data }); }
//     }
//     saveProfiles(ps); renderResumeGallery(); alert('已儲存到 localStorage');
//  })
//   //}})();

//   // 右上角按鈕的防禦性綁定，避免缺少共用模組時整頁失效。
//   try {
//     console.log('profile.js loaded - binding top-right buttons');
//     const notifyBtn = document.getElementById('notifyBtn');
//     const avatarBtn = document.getElementById('avatarBtn');
//     const teamBtn = document.getElementById('teamBtn');
//     if (notifyBtn && !window.AppNotifications) notifyBtn.addEventListener('click', showNotifications);
//     if (teamBtn) {
//       const teamHref = getTeamHref();
//       teamBtn.setAttribute('href', teamHref);
//       teamBtn.addEventListener('click', event=>{
//         event.preventDefault();
//         window.location.href = teamHref;
//       });
//       teamBtn.setAttribute('data-href', teamHref);
//     }
//   } catch (err) {
//     console.error('Error binding top-right buttons:', err);
//     // 若綁定失敗，至少保留組隊按鈕的基本導頁能力。
//     const teamBtn = document.getElementById('teamBtn');
//     if (teamBtn) teamBtn.setAttribute('href', 'team.html');
//   }
//   document.querySelector('.logo-link')?.setAttribute('href', new URLSearchParams(window.location.search).get('userId') ? `/team.html?userId=${encodeURIComponent(new URLSearchParams(window.location.search).get('userId'))}` : '/team.html');
//   window.addEventListener('storage', e=>{
//     if (['myTeams','favorites','teams','contests'].includes(e.key)) renderSyncedSidebar();
//     if (e.key === 'notifications' && !window.AppNotifications) updateNotificationBadge();
//   });

//     load();
//     if (!window.AppNotifications) updateNotificationBadge();
  

//   // 確保 DOM 完成後才初始化，並記錄啟動錯誤方便除錯。
//   try {
//     if (document.readyState === 'loading') {
//       document.addEventListener('DOMContentLoaded', init);
//     } else {
//       init();
//     }
//   } catch (err) {
//     console.error('profile.js initialization failed:', err);
//   }



//   // function getTeamHref(){
//   //   const userId = 
//   //   const teamPath = window.location.protocol === 'file:' ? 'team.html' : '/team.html';
//   //   return userId ? `${teamPath}?userId=${encodeURIComponent(userId)}` : teamPath;
//   // }

//   // // 讀取隊伍資料，並移除展示用預設隊伍。
//   // function loadTeams(){
//   //   const defaultNames = ['AI 聯合隊', '機器人挑戰隊', '資料探勘小隊'];
//   //   const teams = JSON.parse(localStorage.getItem('teams')||'[]').filter(team => !defaultNames.includes(team.name));
//   //   localStorage.setItem('teams', JSON.stringify(teams));
//   //   return teams;
//   // }

//   // // 讀取比賽資料，並補上預設比賽清單。
//   // function loadContests(){
//   //   const existing = JSON.parse(localStorage.getItem('contests')||'[]');
//   //   const merged = [...existing];
//   //   seed.forEach(contest => {
//   //     if (!merged.some(item => Number(item.id) === Number(contest.id))) merged.push(contest);
//   //   });
//   //   localStorage.setItem('contests', JSON.stringify(merged));
//   //   return merged;
//   // }

//   // 讓履歷首頁側欄同步顯示已加入隊伍與收藏隊伍。
//   // function renderSyncedSidebar(){
//   //   if (!myTeamsBox || !followedBox) return;
//   //   const allTeams = loadTeams();
//   //   const contests = loadContests();
//   //   const userId = new URLSearchParams(window.location.search).get('userId');
//   //   const currentUserId = userId && userId !== 'unknown' ? userId : '9999';
//   //   const legacyJoined = JSON.parse(localStorage.getItem('myTeams')||'[]');
//   //   if (legacyJoined.length) {
//   //     const migrated = legacyJoined.map(item => item.id ?? item).filter(id => allTeams.some(team => Number(team.id) === Number(id)));
//   //     localStorage.setItem(`myTeams:${currentUserId}`, JSON.stringify(migrated));
//   //     localStorage.removeItem('myTeams');
//   //   }
//   //   const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`)||'[]');
//   //   const joinedTeams = joinedIds.map(id => allTeams.find(team => Number(team.id) === Number(id))).filter(Boolean);
//   //   const favoriteIds = JSON.parse(localStorage.getItem('favorites')||'[]');
//   //   const favoriteTeams = favoriteIds.map(id=>allTeams.find(team=>Number(team.id)===Number(id))).filter(Boolean);

//   //   myTeamsBox.innerHTML = joinedTeams.length ? joinedTeams.map(team=>{
//   //     const contest = contests.find(item=>Number(item.id)===Number(team.contestId));
//   //     return `<div class="sync-item">
//   //       <strong>${escapeHtml(team.name)}</strong>
//   //       <span>${contest ? escapeHtml(contest.name) : '未指定比賽'}</span>
//   //     </div>`;
//   //   }).join('') : '尚未加入隊伍';

//   //   followedBox.innerHTML = favoriteTeams.length ? favoriteTeams.map(team=>{
//   //     const contest = contests.find(item=>Number(item.id)===Number(team.contestId));
//   //     return `<div class="sync-item">
//   //       <strong>${escapeHtml(team.name)}</strong>
//   //       <span>${contest ? `關注比賽：${escapeHtml(contest.name)}` : '已收藏隊伍'}</span>
//   //     </div>`;
//   //   }).join('') : '無';
//   // }
// }})();

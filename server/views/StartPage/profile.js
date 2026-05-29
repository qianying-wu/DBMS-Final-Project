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
  const photoPreview = $('photoPreview');
  const myTeamsBox = $('myTeams');
  const followedBox = $('followed');

  // 照片功能已移除，使用預設頭像（不儲存圖片）
  let photoState = { src: null };

  // 履歷資料儲存在 localStorage.profiles，格式為 { id, name, data }。
  function loadProfiles(){
    return JSON.parse(localStorage.getItem('profiles')||'[]');
  }

  function saveProfiles(p){ localStorage.setItem('profiles', JSON.stringify(p)); }

  function setActiveProfileId(id){ localStorage.setItem('activeProfileId', String(id)); }

  function getActiveProfileId(){ return localStorage.getItem('activeProfileId') || null; }

  // 將專長標籤渲染成可移除的 tag。
  function renderTags(tags){
    tagsWrap.innerHTML = '';
    tags.forEach((t,i)=>{
      const el = document.createElement('span'); el.className='tag'; el.textContent = t;
      const rem = document.createElement('span'); rem.className='remove'; rem.textContent='✕'; rem.onclick = ()=>{ tags.splice(i,1); renderTags(tags); };
      el.appendChild(rem); tagsWrap.appendChild(el);
    });
  }

  // 根據目前照片狀態更新預覽區。
   function renderPhoto(){
  // No-op if photo preview element was removed from DOM
  if (!photoPreview) return;
  // Ensure default styling (no user-supplied photo)
  if (photoPreview.classList) photoPreview.classList.remove('has-photo');
  try { const img = photoPreview.querySelector && photoPreview.querySelector('img'); if (img) img.remove(); } catch (e) { /* ignore */ }
  }
  

  // 從履歷資料還原照片與照片調整設定。
  function setPhotoFromData(data){
  // Ignore any stored photo; keep default avatar
  photoState = { src: null };
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
  function normalizeProfiles(){
    const ps = loadProfiles().map((profile, index) => ({
      ...profile,
      id: profile.id || Date.now() + index,
      name: profile.name || profile.data?.name || `履歷 ${index + 1}`,
      createdAt: profile.createdAt || profile.updatedAt || new Date().toISOString(),
      updatedAt: profile.updatedAt || profile.createdAt || new Date().toISOString(),
      data: profile.data || {}
    }));
    saveProfiles(ps);
    return ps;
  }

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
    const userId = new URLSearchParams(window.location.search).get('userId');
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

  // 渲染履歷卡片列表，以及新增履歷卡片。
  function renderResumeGallery(){
    const ps = normalizeProfiles();
    resumeGallery.innerHTML = '';
    const activeId = getActiveProfileId();
    ps.forEach(p => {
      const card = document.createElement('article');
      card.className = `resume-card${String(p.id) === String(activeId) ? ' open' : ''}`;
      card.dataset.id = p.id;
      card.innerHTML = `
        <div class="resume-cover"><span class="resume-ribbon">開啟</span></div>
        <div class="resume-body">
            <div style="display:flex;align-items:center;gap:8px;grid-column:1 / -1">
            <h3 class="resume-title" contenteditable="true" spellcheck="false">${escapeHtml(p.name || '未命名履歷')}</h3>
            <button class="rename-btn" type="button" aria-label="重命名">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
                <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />
              </svg>
            </button>
          </div>
          <span class="resume-time">${formatDateTime(p.updatedAt || p.createdAt)}</span>
          <div class="resume-card-actions">
            <button class="icon-action view-resume" type="button" aria-label="查看履歷">查看</button>
            <button class="icon-action edit-resume" type="button" aria-label="編輯履歷">...</button>
          </div>
        </div>
      `;
  const title = card.querySelector('.resume-title');
  const renameBtn = card.querySelector('.rename-btn');
      title.addEventListener('click', event => event.stopPropagation());
      title.addEventListener('input', () => {
        const next = loadProfiles();
        const idx = next.findIndex(item => String(item.id) === String(p.id));
        if (idx >= 0) {
          next[idx].name = title.textContent.trim() || '未命名履歷';
          next[idx].updatedAt = new Date().toISOString();
          saveProfiles(next);
          if (String(p.id) === String(getActiveProfileId())) editorTitle.textContent = next[idx].name;
        }
      });
      if (renameBtn) {
        renameBtn.addEventListener('click', event => {
          event.stopPropagation();
          // focus the title for editing and move caret to end
          title.focus();
          try {
            const range = document.createRange();
            range.selectNodeContents(title);
            range.collapse(false);
            const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
          } catch (err) { /* ignore selection errors */ }
        });
      }
      title.addEventListener('blur', renderResumeGallery);
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
    resumeGallery.appendChild(addCard);
  }

  // 載入指定履歷並切換到編輯畫面。
  function loadProfile(id){
    setActiveProfileId(id);
    loadEditorData();
    showEditor();
  }

  // 將目前選取履歷的資料填入表單。
  function loadEditorData(){
    const activeId = getActiveProfileId();
    const ps = loadProfiles();
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

  // 編輯器標題可 inline 編輯；變更時同步到當前履歷名稱
  if (editorTitle) {
    editorTitle.addEventListener('input', () => {
      const activeId = getActiveProfileId();
      if (!activeId) return;
      const ps = loadProfiles();
      const idx = ps.findIndex(p => String(p.id) === String(activeId));
      if (idx >= 0) {
        const v = editorTitle.textContent.trim() || '未命名履歷';
        ps[idx].name = v;
        ps[idx].updatedAt = new Date().toISOString();
        saveProfiles(ps);
        // also update gallery render title in-place
        const card = document.querySelector(`.resume-card[data-id="${activeId}"]`);
        if (card) {
          const t = card.querySelector('.resume-title');
          if (t) t.textContent = v;
        }
      }
    });

    // make sure clicking title in editor doesn't accidentally navigate
    editorTitle.addEventListener('click', e => e.stopPropagation());
    // editor header rename button focuses the title for quick editing
    const editorRenameBtn = document.getElementById('editorRenameBtn');
    if (editorRenameBtn) {
      editorRenameBtn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        try {
          editorTitle.focus();
          const range = document.createRange();
          range.selectNodeContents(editorTitle);
          range.collapse(false);
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        } catch (err) { /* ignore */ }
      });
    }
  }

  // 顯示履歷列表首頁。
  function showGallery(){
    resumeHome.hidden = false;
    resumeEditor.hidden = true;
    renderResumeGallery();
    renderSyncedSidebar();
  }

  // 顯示履歷編輯器。
  function showEditor(){
    resumeHome.hidden = true;
    resumeEditor.hidden = false;
    renderResumeGallery();
  }

  // 頁面初次載入時先讀資料，再顯示列表。
  function load(){
    loadEditorData();
    showGallery();
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

  function createResume(){
    const ps = loadProfiles(); const id = Date.now();
    const now = new Date().toISOString();
    const newProfile = { id, name: '新履歷', createdAt: now, updatedAt: now, data: {} };
    ps.unshift(newProfile); saveProfiles(ps); setActiveProfileId(id); loadEditorData(); showEditor();
  }

  backToGallery.addEventListener('click', showGallery);

  viewResumeBtn.addEventListener('click', ()=>{
    const activeId = getActiveProfileId();
    if (!activeId) { alert('請先新增或選擇一份履歷'); return; }
    window.location.href = getResumeViewHref(activeId);
  });

  delResume.addEventListener('click', ()=>{
    const activeId = getActiveProfileId(); if(!activeId){ alert('沒有選中的履歷'); return; }
    let ps = loadProfiles(); ps = ps.filter(p=>String(p.id)!==String(activeId)); saveProfiles(ps);
    if (ps.length) setActiveProfileId(ps[0].id); else localStorage.removeItem('activeProfileId');
    showGallery();
  });

  exportBtn.addEventListener('click', ()=>{
    // Inline validation: clear old errors
    const clearErrors = () => { $('error-name').textContent=''; $('error-school').textContent=''; $('error-intro').textContent=''; };
    clearErrors();
    const nameVal = $('name').value.trim();
    const schoolVal = $('school').value.trim();
    const introVal = $('intro').value.trim();
    const invalids = [];
    if (!nameVal) { $('error-name').textContent = '姓名為必填'; invalids.push($('name')); }
    if (!schoolVal) { $('error-school').textContent = '學校為必填'; invalids.push($('school')); }
    if (!introVal) { $('error-intro').textContent = '請簡短介紹自己'; invalids.push($('intro')); }
    if (invalids.length) { invalids[0].focus(); return; }
    const data = {
      name: nameVal, school: schoolVal, grade:$('grade').value,
      experience:$('experience').value, intro: introVal, tags: window._tags||[],
    };
    const s = JSON.stringify(data, null, 2);
    const blob = new Blob([s], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='profile.json'; a.click(); URL.revokeObjectURL(url);
  });

  // 即時同步姓名欄位：主姓名輸入變更時，同步更新目前履歷資料。
  $('name').addEventListener('input', (e)=>{
    const v = e.target.value;
    const activeId = getActiveProfileId();
    if (!activeId) return;
    const ps = loadProfiles();
    const idx = ps.findIndex(p=>String(p.id)===String(activeId));
    if (idx>=0){ ps[idx].data = { ...(ps[idx].data || {}), name: v }; ps[idx].updatedAt = new Date().toISOString(); saveProfiles(ps); }
  });

  saveBtn.addEventListener('click', ()=>{
    // Inline validation on save: show errors and focus first empty
    const clearErrors2 = () => { $('error-name').textContent=''; $('error-school').textContent=''; $('error-intro').textContent=''; };
    clearErrors2();
    const nameVal2 = $('name').value.trim();
    const schoolVal2 = $('school').value.trim();
    const introVal2 = $('intro').value.trim();
    const invalids2 = [];
    if (!nameVal2) { $('error-name').textContent = '姓名為必填'; invalids2.push($('name')); }
    if (!schoolVal2) { $('error-school').textContent = '學校為必填'; invalids2.push($('school')); }
    if (!introVal2) { $('error-intro').textContent = '請簡短介紹自己'; invalids2.push($('intro')); }
    if (invalids2.length) { invalids2[0].focus(); return; }
    const data = {
      name: nameVal2, school: schoolVal2, grade:$('grade').value,
      experience:$('experience').value, intro: introVal2, tags: window._tags||[],
    };
    // 將表單資料儲存到目前履歷；若尚未有履歷，則建立一份新的。
    let ps = loadProfiles(); let activeId = getActiveProfileId();
    if (!activeId) { // create one
      const id = Date.now(); const now = new Date().toISOString(); ps.unshift({ id, name: data.name || '履歷', createdAt: now, updatedAt: now, data }); setActiveProfileId(id);
    } else {
      const idx = ps.findIndex(p=>String(p.id)===String(activeId));
      if (idx>=0) { ps[idx].data = data; ps[idx].updatedAt = new Date().toISOString(); }
      else { ps.unshift({ id: activeId, name: data.name||'履歷', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), data }); }
    }
    saveProfiles(ps); renderResumeGallery(); alert('已儲存到 localStorage');
  });

  // Photo upload and editing removed; photoPreview kept only for display.

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
    /* damn*/
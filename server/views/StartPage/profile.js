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
  let photoState = { src: null, scale: 1, x: 0, y: 0 };

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
          <h3 class="resume-title" contenteditable="true" spellcheck="false">${escapeHtml(p.name || '未命名履歷')}</h3>
          <span class="resume-time">${formatDateTime(p.updatedAt || p.createdAt)}</span>
          <div class="resume-card-actions">
            <button class="icon-action view-resume" type="button" aria-label="查看履歷">查看</button>
            <button class="icon-action edit-resume" type="button" aria-label="編輯履歷">...</button>
          </div>
        </div>
      `;
      const title = card.querySelector('.resume-title');
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
  $('name').addEventListener('input', (e)=>{
    const v = e.target.value;
    const activeId = getActiveProfileId();
    if (!activeId) return;
    const ps = loadProfiles();
    const idx = ps.findIndex(p=>String(p.id)===String(activeId));
    if (idx>=0){ ps[idx].data = { ...(ps[idx].data || {}), name: v }; ps[idx].updatedAt = new Date().toISOString(); saveProfiles(ps); }
  });

  saveBtn.addEventListener('click', ()=>{
    const data = {
      name:$('name').value, school:$('school').value, grade:$('grade').value,
      experience:$('experience').value, intro:$('intro').value, tags: window._tags||[],
      photo: photoState.src,
      photoTransform: { scale: photoState.scale, x: photoState.x, y: photoState.y }
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



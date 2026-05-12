(function(){
  const $ = id => document.getElementById(id);
  const saveBtn = $('saveBtn');
  const exportBtn = $('exportBtn');
  const addResume = $('addResume');
  const delResume = $('delResume');
  const addTag = $('addTag');
  const newTag = $('newTag');
  const tagsWrap = $('tags');
  const photo = $('photo');
  const photoPreview = $('photoPreview');
  const photoImage = $('photoImage');
  const photoScale = $('photoScale');
  const resetPhoto = $('resetPhoto');
  const resumeList = document.getElementById('resumeList');
  const myTeamsBox = $('myTeams');
  const followedBox = $('followed');
  let photoState = { src: null, scale: 1, x: 0, y: 0 };

  // profiles stored in localStorage.profiles as { id, name, data }
  function loadProfiles(){
    return JSON.parse(localStorage.getItem('profiles')||'[]');
  }

  function saveProfiles(p){ localStorage.setItem('profiles', JSON.stringify(p)); }

  function setActiveProfileId(id){ localStorage.setItem('activeProfileId', String(id)); }

  function getActiveProfileId(){ return localStorage.getItem('activeProfileId') || null; }

  function renderTags(tags){
    tagsWrap.innerHTML = '';
    tags.forEach((t,i)=>{
      const el = document.createElement('span'); el.className='tag'; el.textContent = t;
      const rem = document.createElement('span'); rem.className='remove'; rem.textContent='✕'; rem.onclick = ()=>{ tags.splice(i,1); renderTags(tags); };
      el.appendChild(rem); tagsWrap.appendChild(el);
    });
  }

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

  function setPhotoFromData(data){
    photoState = {
      src: data.photo || null,
      scale: data.photoTransform?.scale || 1,
      x: data.photoTransform?.x || 0,
      y: data.photoTransform?.y || 0
    };
    renderPhoto();
  }

  function escapeHtml(value){
    return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function formatDateTime(value){
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '時間未記錄';
    return date.toLocaleString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

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

  function loadTeams(){
    return JSON.parse(localStorage.getItem('teams')||'[]');
  }

  function loadContests(){
    return JSON.parse(localStorage.getItem('contests')||'[]');
  }

  function renderSyncedSidebar(){
    const joinedTeams = JSON.parse(localStorage.getItem('myTeams')||'[]');
    const allTeams = loadTeams();
    const contests = loadContests();
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

  function renderResumeList(){
    const ps = loadProfiles(); resumeList.innerHTML = '';
    const activeId = getActiveProfileId();
    ps.forEach(p=>{
      const li = document.createElement('li'); li.dataset.id = p.id;
      if (String(p.id) === String(activeId)) li.className='active';
      // inline editable name
      const nameSpan = document.createElement('span'); nameSpan.className='resume-name';
      nameSpan.textContent = p.name || ('履歷 ' + p.id);
      nameSpan.contentEditable = true;
      nameSpan.spellcheck = false;
      nameSpan.addEventListener('input', (e)=>{
        // update stored name immediately
        const ps2 = loadProfiles();
        const idx = ps2.findIndex(x=>String(x.id)===String(p.id));
        if (idx>=0){ ps2[idx].name = nameSpan.textContent; saveProfiles(ps2); }
      });

      nameSpan.addEventListener('click', (e)=>{ e.stopPropagation(); });

      li.appendChild(nameSpan);
      li.onclick = ()=>{ loadProfile(p.id); };
      resumeList.appendChild(li);
    });
  }

  function loadProfile(id){
    setActiveProfileId(id); renderResumeList(); load();
  }

  function load(){
    const activeId = getActiveProfileId();
    const ps = loadProfiles();
    const profile = ps.find(x=>String(x.id)===String(activeId)) || ps[0] || null;
    const data = profile ? profile.data : {};
    $('name').value = data.name||'';
    $('school').value = data.school||'';
    $('grade').value = data.grade||'';
    $('experience').value = data.experience||'';
    $('intro').value = data.intro||'';
    const tags = data.tags||[]; renderTags(tags);
    window._tags = tags;
    setPhotoFromData(data);
    renderResumeList();
    renderSyncedSidebar();
  }

  addTag.addEventListener('click', ()=>{
    const v = newTag.value.trim(); if(!v) return; window._tags = window._tags||[]; window._tags.push(v); newTag.value=''; renderTags(window._tags);
  });

  addResume.addEventListener('click', ()=>{
    const ps = loadProfiles(); const id = Date.now();
    const newProfile = { id, name: '新履歷', data: {} };
    ps.unshift(newProfile); saveProfiles(ps); setActiveProfileId(id); load();
  });

  delResume.addEventListener('click', ()=>{
    const activeId = getActiveProfileId(); if(!activeId){ alert('沒有選中的履歷'); return; }
    let ps = loadProfiles(); ps = ps.filter(p=>String(p.id)!==String(activeId)); saveProfiles(ps);
    if (ps.length) setActiveProfileId(ps[0].id); else localStorage.removeItem('activeProfileId');
    load();
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

  // live-sync: when the main name input changes, update active profile's name in list
  $('name').addEventListener('input', (e)=>{
    const v = e.target.value;
    const activeId = getActiveProfileId();
    if (!activeId) return;
    const ps = loadProfiles();
    const idx = ps.findIndex(p=>String(p.id)===String(activeId));
    if (idx>=0){ ps[idx].name = v || ps[idx].name; saveProfiles(ps); renderResumeList(); }
  });

  saveBtn.addEventListener('click', ()=>{
    const data = {
      name:$('name').value, school:$('school').value, grade:$('grade').value,
      experience:$('experience').value, intro:$('intro').value, tags: window._tags||[],
      photo: photoState.src,
      photoTransform: { scale: photoState.scale, x: photoState.x, y: photoState.y }
    };
    // save into active profile
    let ps = loadProfiles(); let activeId = getActiveProfileId();
    if (!activeId) { // create one
      const id = Date.now(); ps.unshift({ id, name: data.name || '履歷', data }); setActiveProfileId(id);
    } else {
      const idx = ps.findIndex(p=>String(p.id)===String(activeId));
      if (idx>=0) { ps[idx].data = data; ps[idx].name = data.name || ps[idx].name; }
      else { ps.unshift({ id: activeId, name: data.name||'履歷', data }); }
    }
    saveProfiles(ps); renderResumeList(); alert('已儲存到 localStorage');
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

  // top-right buttons (defensive binding)
  try {
    console.log('profile.js loaded - binding top-right buttons');
    const notifyBtn = document.getElementById('notifyBtn');
    const avatarBtn = document.getElementById('avatarBtn');
    const teamBtn = document.getElementById('teamBtn');
    if (notifyBtn) notifyBtn.addEventListener('click', showNotifications);
    if (teamBtn) {
      // primary listener
      teamBtn.addEventListener('click', ()=>{ window.location.href = '/team.html'; });
      // fallback: set onclick and an href-like attribute so non-JS clicks also work
      teamBtn.onclick = () => { window.location.href = '/team.html'; };
      teamBtn.setAttribute('data-href', '/team.html');
    }
    if (avatarBtn) avatarBtn.addEventListener('click', ()=>{ alert('打開個人檔案設定'); });
  } catch (err) {
    console.error('Error binding top-right buttons:', err);
    // ensure team button still navigates as fallback
    const teamBtn = document.getElementById('teamBtn');
    if (teamBtn) teamBtn.onclick = () => { window.location.href = '/team.html'; };
  }
  window.addEventListener('storage', e=>{
    if (['myTeams','favorites','teams','contests'].includes(e.key)) renderSyncedSidebar();
    if (e.key === 'notifications') updateNotificationBadge();
  });

  load();
  updateNotificationBadge();
})();

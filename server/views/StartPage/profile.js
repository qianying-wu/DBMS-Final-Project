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
  const resumeList = document.getElementById('resumeList');

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
    if (data.photo) photoPreview.style.backgroundImage = `url(${data.photo})`; else photoPreview.textContent='預覽';
    renderResumeList();
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
      experience:$('experience').value, intro:$('intro').value, tags: window._tags||[]
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
      experience:$('experience').value, intro:$('intro').value, tags: window._tags||[], photo: photoPreview.style.backgroundImage ? photoPreview.style.backgroundImage.slice(5,-2) : null
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
    const reader = new FileReader(); reader.onload = ()=>{ photoPreview.style.backgroundImage = `url(${reader.result})`; photoPreview.textContent=''; };
    reader.readAsDataURL(f);
  });

  // top-right buttons
  const notifyBtn = document.getElementById('notifyBtn');
  const avatarBtn = document.getElementById('avatarBtn');
  const teamBtn = document.getElementById('teamBtn');
  if (notifyBtn) notifyBtn.addEventListener('click', ()=>{ alert('沒有新通知'); });
  if (teamBtn) teamBtn.addEventListener('click', ()=>{ window.location.href = '/team.html'; });
  if (avatarBtn) avatarBtn.addEventListener('click', ()=>{ alert('打開個人檔案設定'); });

  load();
})();

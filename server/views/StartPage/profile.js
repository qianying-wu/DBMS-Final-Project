// 全域快取與狀態變數，供所有內部函式共用
let cachedProfiles = [];
let activeProfileId = null;

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
    const myTeamsBox = $('myTeams');
    const followedBox = $('followed');

    // 取得 token
    function getAuthHeader() {
      const token = localStorage.getItem('token'); 
      return token ? { 'Authorization': `${token}` } : {}; 
    }

    // 載入：從資料庫獲取所有履歷
    async function loadProfiles(){
      try {
        const res = await fetch('/api/pv/loadPV', { 
          headers: { ...getAuthHeader() }
        });
        if (!res.ok) throw new Error('無法取得履歷資料');
        const dbData = await res.json();
        
        // 在快取記憶體中做資料標準化（取代舊的 normalizeProfiles）
        cachedProfiles = dbData.map((profile, index) => ({
          ...profile,
          id: profile.id || profile._id || String(Date.now() + index),
          name: profile.name || profile.data?.name || `履歷 ${index + 1}`,
          createdAt: profile.createdAt || new Date().toISOString(),
          updatedAt: profile.updatedAt || new Date().toISOString(),
          data: profile.data || {}
        }));
        
        return cachedProfiles;
      } catch (err) {
        console.error(err);
        alert('讀取資料庫失敗');
        return [];
      }
    }

    // 儲存：將特定履歷資料推送到資料庫
    async function saveProfileToDB(profilePayload){
      try {
        const res = await fetch('/api/pv/savePV', { 
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

    // 刪除：通知資料庫移除特定 ID 的履歷
    async function deleteProfile(id){
      try {
        const res = await fetch(`/api/pv/deletePV/${id}`, { 
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

    // 將專長標籤渲染成可移除的 tag。
    function renderTags(tags){
      tagsWrap.innerHTML = '';
      tags.forEach((t, i)=>{
        const el = document.createElement('span'); el.className = 'tag'; el.textContent = t;
        const rem = document.createElement('span'); rem.className = 'remove'; rem.textContent = '✕'; 
        rem.onclick = ()=>{ 
          tags.splice(i, 1); 
          renderTags(tags); 
        };
        el.appendChild(rem); tagsWrap.appendChild(el);
      });
    }
  
    // =====================================
    //  UI 渲染與狀態管理
    // =====================================

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

    // 依照目前使用者與履歷 ID 組成履歷查看頁連結。
    function getResumeViewHref(id){
      const userId = localStorage.getItem("userId");
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      params.set('resumeId', id);
      return `/resume-view.html?${params.toString()}`;
    }

    // 渲染履歷卡片列表，以及新增履歷卡片。
    async function renderResumeGallery(){
      await loadProfiles(); // ✅ 渲染前先調用你的 async loadProfiles() 確保最新資料存入 cachedProfiles
      const ps = cachedProfiles;
      resumeGallery.innerHTML = '';
      const activeId = activeProfileId;
      
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
        
        // 在列表直接內聯修改標題時，即時打 API 更新 DB
        title.addEventListener('blur', async () => {
          const newName = title.textContent.trim() || '未命名履歷';
          if (newName !== p.name) {
            p.name = newName;
            p.updatedAt = new Date().toISOString();
            await saveProfileToDB(p);
            if (String(p.id) === String(activeProfileId)) {
              editorTitle.textContent = newName;
            }
            renderResumeGallery();
          }
        });
        
        resumeGallery.appendChild(card);
      });

      // 🌟 新增履歷按鈕順暢產出
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
      activeProfileId = id;
      loadEditorData();
      showEditor();
    }

    // 將目前選取履歷的資料填入表單。
    function loadEditorData(){
      const activeId = activeProfileId;
      const ps = cachedProfiles;
      const profile = ps.find(x=>String(x.id)===String(activeId)) || ps[0] || null;
      const data = profile ? profile.data : {};
      
      if (profile && !activeId) activeProfileId = profile.id;
      editorTitle.textContent = profile?.name || '新增履歷';
      
      $('name').value = data.name||'';
      $('school').value = data.school||'';
      $('grade').value = data.grade||'';
      $('experience').value = data.experience||'';
      $('intro').value = data.intro||'';
      
      const tags = data.tags||[]; renderTags(tags);
      window._tags = tags;
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
    }

    // 頁面初次載入時先讀資料，再顯示列表。
    async function load(){
      await loadProfiles();
      if (cachedProfiles.length > 0) {
        activeProfileId = cachedProfiles[0].id;
      }
      loadEditorData();
      showGallery();
    }

    addTag.addEventListener('click', ()=>{
      const v = newTag.value.trim(); if(!v) return; window._tags = window._tags||[]; window._tags.push(v); newTag.value=''; renderTags(window._tags);
    });

    resumeGallery.addEventListener('click', async event => {
      const addCard = event.target.closest('#addResume');
      const viewButton = event.target.closest('.view-resume');
      const card = event.target.closest('.resume-card');

      if (addCard) {
        await createResume();
        return;
      }

      if (viewButton && card) {
        event.stopPropagation();
        window.location.href = getResumeViewHref(card.dataset.id);
        return;
      }

      if (card && !event.target.closest('.resume-title')) loadProfile(card.dataset.id);
    });

    // 建立新履歷：直接 POST 回後端資料庫
    async function createResume(){
      const id = String(Date.now());
      const now = new Date().toISOString();
      const newProfile = { 
        id, 
        name: '新履歷', 
        createdAt: now, 
        updatedAt: now, 
        data: { name: '', school: '', grade: '', experience: '', intro: '', tags: [] } 
      };
      
      await saveProfileToDB(newProfile);
      activeProfileId = id;
      await renderResumeGallery(); 
      loadEditorData(); 
      showEditor();
    }

    backToGallery.addEventListener('click', showGallery);

    viewResumeBtn.addEventListener('click', ()=>{
      if (!activeProfileId) { alert('請先新增或選擇一份履歷'); return; }
      window.location.href = getResumeViewHref(activeProfileId);
    });

    // 刪除功能：同步刪除 DB 資料
    delResume.addEventListener('click', async ()=>{
      if(!activeProfileId){ alert('沒有選中的履歷'); return; }
      if(!confirm('確定要刪除這份履歷嗎？')) return;

      const success = await deleteProfile(activeProfileId);
      if (success) {
        cachedProfiles = cachedProfiles.filter(p => String(p.id) !== String(activeProfileId));
        if (cachedProfiles.length) activeProfileId = cachedProfiles[0].id; 
        else activeProfileId = null;
        showGallery();
      }
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

    // 點擊儲存按鈕：完整表單非同步發送至後端
    saveBtn.addEventListener('click', async () => {
      const data = {
        name:$('name').value, school:$('school').value, grade:$('grade').value,
        experience:$('experience').value, intro:$('intro').value, tags: window._tags||[]
      };
      
      let profile = cachedProfiles.find(p => String(p.id) === String(activeProfileId));
      if (!profile) {
        profile = {
          id: activeProfileId || String(Date.now()),
          name: data.name || '履歷',
          createdAt: new Date().toISOString(),
          data: data
        };
      } else {
        profile.data = data;
        profile.name = data.name || profile.name;
      }
      profile.updatedAt = new Date().toISOString();

      await saveProfileToDB(profile);
      alert('已成功儲存到資料庫！');
      showGallery();
    });

    // =====================================
    // 側邊欄同步輔助系統
    // =====================================
    function getTeamHref(){
      const userId = localStorage.getItem("userId");
      const teamPath = window.location.protocol === 'file:' ? 'team.html' : '/team.html';
      return userId ? `${teamPath}?userId=${encodeURIComponent(userId)}` : teamPath;
    }

    function renderSyncedSidebar(){
      if (!myTeamsBox || !followedBox) return;
      const allTeams = JSON.parse(localStorage.getItem('teams')||'[]');
      const contests = JSON.parse(localStorage.getItem('contests')||'[]');
      const userId = localStorage.getItem("userId");
      const currentUserId = userId && userId !== 'unknown' ? userId : '9999';
      
      const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`)||'[]');
      const joinedTeams = joinedIds.map(id => allTeams.find(team => Number(team.id) === Number(id))).filter(Boolean);
      const favoriteIds = JSON.parse(localStorage.getItem('favorites')||'[]');
      const favoriteTeams = favoriteIds.map(id=>allTeams.find(team=>Number(team.id)===Number(id))).filter(Boolean);

      myTeamsBox.innerHTML = joinedTeams.length ? joinedTeams.map(team=>{
        const contest = contests.find(item=>Number(item.id)===Number(team.contestId));
        return `<div class="sync-item"><strong>${escapeHtml(team.name)}</strong><span>${contest ? escapeHtml(contest.name) : '未指定比賽'}</span></div>`;
      }).join('') : '尚未加入隊伍';

      followedBox.innerHTML = favoriteTeams.length ? favoriteTeams.map(team=>{
        const contest = contests.find(item=>Number(item.id)===Number(team.contestId));
        return `<div class="sync-item"><strong>${escapeHtml(team.name)}</strong><span>${contest ? `關注比賽：${escapeHtml(contest.name)}` : '已收藏隊伍'}</span></div>`;
      }).join('') : '無';
    }

    // 右上角按鈕防禦性綁定
    try {
      console.log('profile.js loaded - binding top-right buttons');
      const teamBtn = document.getElementById('teamBtn');
      if (teamBtn) {
        const teamHref = getTeamHref();
        teamBtn.setAttribute('href', teamHref);
      }
    } catch (err) {
      console.error('Error binding top-right buttons:', err);
    }
    
    document.querySelector('.logo-link')?.setAttribute('href', localStorage.getItem("userId") ? `/team.html?userId=${encodeURIComponent(localStorage.getItem("userId"))}` : '/team.html');

    // 啟動載入
    load();
  } // ✅ init 函式大括號在最尾端完美閉合

  // 確保 DOM 完成後才初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

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

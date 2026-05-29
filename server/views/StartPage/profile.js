(function () {
  // 初始化履歷頁面，集中取得 DOM 元素並綁定互動事件。
  function init() {
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
    // const photoPreview = $('photoPreview');
    // const myTeamsBox = $('myTeams');
    // const followedBox = $('followed');

    // 照片功能已移除，使用預設頭像（不儲存圖片）
    let photoState = { src: null };

    function getAuthHeader() {
      const token = localStorage.getItem('token');
      return token ? { 'Authorization': `${token}` } : {};
    }
    // ================================== 以下是與後端 API 互動的函式 ==========================
    // 載入：從資料庫獲取所有履歷
    async function loadProfiles() {
      try {
        const path = '/api/pv/loadPV';
        const response = await fetch(path, { headers: { ...getAuthHeader() } });
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
    async function saveProfileToDB(profilePayload) {
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

    // 刪除：通知資料庫移除特定 ID 的履歷
    async function deleteProfile(card_id) {
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
    // ================================== 以下是與後端 API 互動的函式 ==========================
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
    function renderTags(tags) {
      tagsWrap.innerHTML = '';
      tags.forEach((t, i) => {
        const el = document.createElement('span'); el.className = 'tag'; el.textContent = t;
        const rem = document.createElement('span'); rem.className = 'remove'; rem.textContent = '✕'; rem.onclick = () => { tags.splice(i, 1); renderTags(tags); };
        el.appendChild(rem); tagsWrap.appendChild(el);
      });
    }

    // 渲染履歷卡片列表，以及新增履歷卡片。
    async function renderResumeGallery() {
      const ps = await loadProfiles();
      resumeGallery.innerHTML = '';
      //  const activeId = localStorage.getItem("userId");
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


        //  點擊標題可以直接編輯名稱，失焦後自動儲存變更並更新畫面。
        const title = card.querySelector('.resume-title');
        const renameBtn = card.querySelector('.rename-btn');
        title.addEventListener('click', event => event.stopPropagation());
        title.addEventListener('input', async () => {
          const next = await loadProfiles();
          const idx = next.findIndex(item => String(item.id) === String(p.id));
          if (idx >= 0) {
            p.name = title.textContent.trim() || '未命名履歷';
            p.updatedAt = new Date().toISOString();

            // 若此為目前開啟的履歷，同步編輯器標題
            const openId = document.querySelector('.resume-card.open')?.dataset.id;
            if (String(p.id) === String(openId)) editorTitle.textContent = p.name;
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
        title.addEventListener('blur', async () => {
          try {
            await saveProfileToDB({
              resume_id: Number(p.id),
              resume_name: p.name,
              user_school: p.school,
              department_grade: p.grade,
              user_intro: p.intro,
              tags: p.tags
            });
            await renderResumeGallery();
          } catch (err) {
            console.error('更新名稱失敗', err);
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
      resumeGallery.appendChild(addCard);
    }


    // 將純文字進行 HTML 轉義，防止 XSS 攻擊
    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // 取得當前網址列的 userId，用來保持登入與選單同步
    function getUserIdFromUrl() {
      return new URLSearchParams(window.location.search).get('userId') || localStorage.getItem('userId') || 'unknown';
    }

    function getTeamHref() {
      const id = getUserIdFromUrl();
      const base = '/team.html';
      return id !== 'unknown' ? `${base}?userId=${encodeURIComponent(id)}` : base;
    }

    // 渲染左側狀態欄（包含同步外部的「我的隊伍」與「關注的比賽」）
    // function renderSyncedSidebar() {
    //   const uId = getUserIdFromUrl();

    //   const savedName = localStorage.getItem('userName');
    //   if ($('profileUsername') && savedName) {
    //     $('profileUsername').textContent = savedName;
    //   }
    //   if ($('profileUserEmail')) {
    //     $('profileUserEmail').textContent = uId !== 'unknown' ? '已驗證參賽者' : '訪客身分';
    //   }

    //   if (myTeamsBox) {
    //     const teams = JSON.parse(localStorage.getItem('myTeams') || '[]');
    //     if (!teams.length) {
    //       myTeamsBox.innerHTML = '<li class="empty-item">尚未加入任何隊伍</li>';
    //     } else {
    //       myTeamsBox.innerHTML = teams.map(t => `
    //         <li onclick="window.location.href='${getTeamHref()}'">
    //           <span class="team-dot"></span>
    //           <div class="list-content">
    //             <strong>${escapeHtml(t.name)}</strong>
    //             <span>角色: ${escapeHtml(t.role || '隊員')}</span>
    //           </div>
    //         </li>
    //       `).join('');
    //     }
    //   }

    //   if (followedBox) {
    //     const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    //     const contests = JSON.parse(localStorage.getItem('contests') || '[]');
    //     const myFavContests = contests.filter(c => favs.includes(c.id));

    //     if (!myFavContests.length) {
    //       followedBox.innerHTML = '<li class="empty-item">尚未關注任何比賽</li>';
    //     } else {
    //       followedBox.innerHTML = myFavContests.map(c => `
    //         <li onclick="window.location.href='${getTeamHref()}'">
    //           <span class="contest-dot"></span>
    //           <div class="list-content">
    //             <strong>${escapeHtml(c.name)}</strong>
    //             <span>時間: ${escapeHtml(c.date)}</span>
    //           </div>
    //         </li>
    //       `).join('');
    //     }
    //   }
    // }


    // 從履歷資料還原照片與照片調整設定。
    function setPhotoFromData(data) {
      // Ignore any stored photo; keep default avatar
      photoState = { src: null };
      renderPhoto();
    }

    // 將使用者輸入轉成安全文字，避免插入 HTML 時破壞畫面。
    function escapeHtml(value) {
      return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // 將 ISO 時間字串轉成台灣常用的日期時間格式。
    function formatDateTime(value) {
      const date = value ? new Date(value) : new Date();
      if (Number.isNaN(date.getTime())) return '時間未記錄';
      return date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    function loadNotifications() {
      return JSON.parse(localStorage.getItem('notifications') || '[]');
    }

    function saveNotifications(notifications) {
      localStorage.setItem('notifications', JSON.stringify(notifications));
    }

    function updateNotificationBadge() {
      const notifyBtn = document.getElementById('notifyBtn');
      if (!notifyBtn) return;
      const unread = loadNotifications().filter(item => Number(item.userId) === 9999 && !item.read).length;
      notifyBtn.textContent = unread ? `🔔 ${unread}` : '🔔';
    }

    // function showNotifications() {
    //   const existing = document.getElementById('notificationModal');
    //   if (existing) existing.remove();
    //   const notifications = loadNotifications();
    //   const myNotifications = notifications.filter(item => Number(item.userId) === 9999);
    //   const modal = document.createElement('div');
    //   modal.id = 'notificationModal';
    //   modal.className = 'modal notification-modal';
    //   modal.innerHTML = `
    //   <div class="modal-card notification-card">
    //     <h3>通知</h3>
    //     <div class="notification-list">
    //       ${myNotifications.length ? myNotifications.map(item => `
    //         <div class="notification-item ${item.read ? '' : 'unread'}">
    //           <strong>${escapeHtml(item.message)}</strong>
    //           <span>${formatDateTime(item.createdAt)}</span>
    //         </div>
    //       `).join('') : '<div class="empty-note">目前沒有通知</div>'}
    //     </div>
    //     <div class="modal-actions">
    //       <button id="closeNotificationModal" class="btn outline">關閉</button>
    //     </div>
    //   </div>
    // `;
    //   document.body.appendChild(modal);
    //   notifications.forEach(item => { if (Number(item.userId) === 9999) item.read = true; });
    //   saveNotifications(notifications);
    //   updateNotificationBadge();
    //   modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    //   document.getElementById('closeNotificationModal').addEventListener('click', () => modal.remove());
    // }

    function getTeamHref() {
      const userId = localStorage.getItem("userId");
      // new URLSearchParams(window.location.search).get('userId');
      const teamPath = window.location.protocol === 'file:' ? 'team.html' : '/team.html';
      return userId ? `${teamPath}?userId=${encodeURIComponent(userId)}` : teamPath;
    }

    // // 讀取隊伍資料，並移除展示用預設隊伍。
    // function loadTeams() {
    //   const defaultNames = ['AI 聯合隊', '機器人挑戰隊', '資料探勘小隊'];
    //   const teams = JSON.parse(localStorage.getItem('teams') || '[]').filter(team => !defaultNames.includes(team.name));
    //   localStorage.setItem('teams', JSON.stringify(teams));
    //   return teams;
    // }

    // // 讀取比賽資料，並補上預設比賽清單。
    // function loadContests() {
    //   const existing = JSON.parse(localStorage.getItem('contests') || '[]');
    //   const merged = [...existing];
    //   seed.forEach(contest => {
    //     if (!merged.some(item => Number(item.id) === Number(contest.id))) merged.push(contest);
    //   });
    //   localStorage.setItem('contests', JSON.stringify(merged));
    //   return merged;
    // }

    // 讓履歷首頁側欄同步顯示已加入隊伍與收藏隊伍。
    // function renderSyncedSidebar() {
    //   if (!myTeamsBox || !followedBox) return;
    //   const allTeams = loadTeams();
    //   const contests = loadContests();
    //   const userId = new URLSearchParams(window.location.search).get('userId');
    //   const currentUserId = userId && userId !== 'unknown' ? userId : '9999';
    //   const legacyJoined = JSON.parse(localStorage.getItem('myTeams') || '[]');
    //   if (legacyJoined.length) {
    //     const migrated = legacyJoined.map(item => item.id ?? item).filter(id => allTeams.some(team => Number(team.id) === Number(id)));
    //     localStorage.setItem(`myTeams:${currentUserId}`, JSON.stringify(migrated));
    //     localStorage.removeItem('myTeams');
    //   }
    //   const joinedIds = JSON.parse(localStorage.getItem(`myTeams:${currentUserId}`) || '[]');
    //   const joinedTeams = joinedIds.map(id => allTeams.find(team => Number(team.id) === Number(id))).filter(Boolean);
    //   const favoriteIds = JSON.parse(localStorage.getItem('favorites') || '[]');
    //   const favoriteTeams = favoriteIds.map(id => allTeams.find(team => Number(team.id) === Number(id))).filter(Boolean);

    //   myTeamsBox.innerHTML = joinedTeams.length ? joinedTeams.map(team => {
    //     const contest = contests.find(item => Number(item.id) === Number(team.contestId));
    //     return `<div class="sync-item">
    //     <strong>${escapeHtml(team.name)}</strong>
    //     <span>${contest ? escapeHtml(contest.name) : '未指定比賽'}</span>
    //   </div>`;
    //   }).join('') : '尚未加入隊伍';

    //   followedBox.innerHTML = favoriteTeams.length ? favoriteTeams.map(team => {
    //     const contest = contests.find(item => Number(item.id) === Number(team.contestId));
    //     return `<div class="sync-item">
    //     <strong>${escapeHtml(team.name)}</strong>
    //     <span>${contest ? `關注比賽：${escapeHtml(contest.name)}` : '已收藏隊伍'}</span>
    //   </div>`;
    //   }).join('') : '無';
    // }

    // 依照目前使用者與履歷 ID 組成履歷查看頁連結。
    function getResumeViewHref(id) {
      const userId = new URLSearchParams(window.location.search).get('userId');
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      params.set('resumeId', id);
      return `/resume-view.html?${params.toString()}`;
    }

    // 載入指定履歷並切換到編輯畫面。
    function loadProfile(id) {
      setActiveProfileId(id);
      loadEditorData();
      showEditor();
    }

    // 將目前選取履歷的資料填入表單。
    async function loadEditorData() {
      const activeId = getActiveProfileId();
      const ps = await loadProfiles();
      const profile = ps.find(x => String(x.id) === String(activeId)) || ps[0] || null;
      const data = profile ? profile.data : {};
      if (profile && !activeId) setActiveProfileId(profile.id);
      editorTitle.textContent = profile?.name || '新增履歷';
      $('name').value = profile?.name || '';
      $('school').value = profile?.school || '';
      $('grade').value = profile?.grade || '';
      // $('experience').value = profile?.experience || '';
      $('bio').value = profile?.intro || '';
      const tags = data.tags || []; renderTags(tags);
      window._tags = tags;
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
    async function showGallery() {
      resumeHome.hidden = false;
      resumeEditor.hidden = true;
      await renderResumeGallery();
      // renderSyncedSidebar();
    }

    // 顯示履歷編輯器。
    async function showEditor() {
      resumeHome.hidden = true;
      resumeEditor.hidden = false;
      await renderResumeGallery();
    }

    // 頁面初次載入時先讀資料，再顯示列表。
    async function load() {
      await loadEditorData();
      await showGallery();
    }

    addTag.addEventListener('click', () => {
      const v = newTag.value.trim(); if (!v) return; window._tags = window._tags || []; window._tags.push(v); newTag.value = ''; renderTags(window._tags);
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
    async function createResume() {
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


    viewResumeBtn.addEventListener('click', () => {
      const activeId = localStorage.getItem("userId");
      if (!activeId) { alert('請先新增或選擇一份履歷'); return; }
      window.location.href = getResumeViewHref(activeId);
    });

    // 刪除按鈕目前選取的履歷，並更新畫面。
    // 刪除按鈕：利用 card.dataset.id 抓出當前開啟的履歷並刪除
    delResume.addEventListener('click', async () => {
      // 1. 抓出畫面上目前被打開、蓋著「開啟」緞帶的那張履歷卡片
      const activeCard = document.querySelector('.resume-card.open');

      // 2. 防呆：萬一使用者還沒點任何卡片就按刪除，提示他
      if (!activeCard) {
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

    exportBtn.addEventListener('click', () => {
      // Inline validation: clear old errors
      const clearErrors = () => { $('error-name').textContent = ''; $('error-school').textContent = ''; $('error-intro').textContent = ''; };
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
        name: nameVal, school: schoolVal, grade: $('grade').value,
        experience: $('experience').value, intro: introVal, tags: window._tags || [],
      };
      const s = JSON.stringify(data, null, 2);
      const blob = new Blob([s], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'profile.json'; a.click(); URL.revokeObjectURL(url);
    });

    // 即時同步姓名欄位：主姓名輸入變更時，同步更新目前履歷資料。
    // $('name').addEventListener('input', async (e) => {
    //   const v = e.target.value;
    //   const activeId = getActiveProfileId();
    //   if (!activeId) return;
    //   const ps = await loadProfiles();
    //   const idx = ps.findIndex(p => String(p.id) === String(activeId));
    //   if (idx >= 0) { ps[idx].data = { ...(ps[idx].data || {}), name: v }; ps[idx].updatedAt = new Date().toISOString(); saveProfiles(ps); }
    // });

    saveBtn.addEventListener('click', async () => {
      // Inline validation on save: show errors and focus first empty
      const clearErrors2 = () => { $('error-name').textContent = ''; $('error-school').textContent = ''; $('error-intro').textContent = ''; };
      clearErrors2();

      const nameVal = $('name').value.trim();
      const schoolVal = $('school').value.trim();
      const gradeVal = $('grade').value.trim();
      const introVal = $('bio').value.trim();

      // if (!nameVal) { $('error-name').textContent = '姓名為必填'; invalids.push($('name')); }
      // if (!schoolVal) { $('error-school').textContent = '學校為必填'; invalids.push($('school')); }
      // if (!introVal) { $('error-intro').textContent = '請簡短介紹自己'; invalids.push($('intro')); }
      // if (invalids.length) { invalids[0].focus(); return; }
      const errorInputs = [];

      if (!nameVal) {
        $('error-name').textContent = '姓名為必填';
        errorInputs.push($('name'));
      }
      if (!schoolVal) {
        $('error-school').textContent = '學校為必填';
        errorInputs.push($('school'));
      }
      if (!introVal) {
        $('error-intro').textContent = '請簡短介紹自己';
        errorInputs.push($('bio'));
      }

      // 如果有欄位沒填，把游標焦點移到第一個漏填的欄位並中斷執行
      if (errorInputs.length) {
        errorInputs[0].focus();
        return;
      }

      const activeResumeId = getActiveProfileId();
      const payload = {
        resume_id: activeResumeId ? Number(activeResumeId) : undefined,
        resume_name: nameVal,
        user_school: schoolVal,
        department_grade: gradeVal,
        user_intro: introVal,
        tags: window._tags || []
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
        teamBtn.addEventListener('click', event => {
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
    window.addEventListener('storage', e => {
      if (['myTeams', 'favorites', 'teams', 'contests'].includes(e.key)) renderSyncedSidebar();
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

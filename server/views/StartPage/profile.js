import * as Data from './team-data.js';
(function () {
  const $ = id => document.getElementById(id);

  // 初始化履歷頁面，集中取得 DOM 元素並綁定互動事件。
  function init() {
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
        const path = '/api/pv/savePV';
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
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || '刪除失敗');
        }
        return true;
      } catch (err) {
        console.error(err);
        alert(err.message || '刪除履歷失敗');
        return false;
      }
    }
    // ================================== 以上是與後端 API 互動的函式 ==========================

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
            <!-- <button class="rename-btn" type="button" aria-label="重命名">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
                <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />
              </svg>
            </button> -->
          </div>
          <span class="resume-time">${formatDateTime(p.updatedAt || p.createdAt)}</span>
          <div class="resume-card-actions">
            <button class="icon-action view-resume" type="button" aria-label="查看履歷">查看</button>
          </div>
        </div>
        `;

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

    // 從履歷資料還原照片與照片調整設定。
    // function setPhotoFromData(data) {
    //   // Ignore any stored photo; keep default avatar
    //   photoState = { src: null };
    //   renderPhoto();
    // }

    // 將 ISO 時間字串轉成台灣常用的日期時間格式。
    function formatDateTime(value) {
      const date = value ? new Date(value) : new Date();
      if (Number.isNaN(date.getTime())) return '時間未記錄';
      return date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    // // 以下通知功能是備援：若共用 notifications.js 未載入，仍可顯示基本通知。
    // function loadNotifications() {
    //   return JSON.parse(localStorage.getItem('notifications') || '[]');
    // }

    // function updateNotificationBadge() {
    //   const notifyBtn = document.getElementById('notifyBtn');
    //   if (!notifyBtn) return;
    //   const unread = loadNotifications().filter(item => Number(item.userId) === 9999 && !item.read).length;
    //   notifyBtn.textContent = unread ? `🔔 ${unread}` : '🔔';
    // }

    function getTeamHref() {
      const userId = localStorage.getItem("userId");
      // new URLSearchParams(window.location.search).get('userId');
      const teamPath = window.location.protocol === 'file:' ? 'team.html' : '/team.html';
      return userId ? `${teamPath}?userId=${encodeURIComponent(userId)}` : teamPath;
    }
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

      // 🚀【防禦修正】如果 data 裡面沒 tags，就去外層把 tags 借過來用！
      if (profile && !profile.data.tags && profile.tags) {
        profile.data.tags = profile.tags;
      }
      const data = profile ? profile.data : {}; // 現在DB中的東西

      if (profile && !activeId) setActiveProfileId(profile.id);
      $('editorTitle').value = data.resume_name || '新增履歷';
      $('name').value = data.user_pv_name || '';
      $('school').value = data.school || '';
      $('grade').value = data.grade || '';
      // HTML 內自我介紹欄位的 id 是 intro；原本抓 bio 會讓初始化中斷，導致 gallery 不會渲染。
      $('intro').value = data.intro || '';
      const tags = data.tags || []; renderTags(tags);
      window._tags = tags;
      renderTags(window._tags);
    }

    // ================== ⚡ 事件綁定與控制邏輯 ==========================    
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
          resume_id: undefined,
          resume_name: '履歷',      // 🌟 傳 undefined，後端看到就知道這是「全新建立」
          user_pv_name: '',
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
      // 查看制式履歷要使用目前選取的履歷 ID，不是使用者 ID。
      const activeId = getActiveProfileId();
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
      // 🌟3. 精髓在這一行！直接從這張卡片的 HTML 號碼牌（data-id）把履歷 ID 挖出來！
      const resumeIdToDelete = activeCard.dataset.id;
      // 4. 跳出確認視窗，問使用者是不是真的要刪除
      if (!confirm('確定要刪除這份履歷嗎？')) return;
      try {
        // 5. 呼叫刪除 API，把剛剛挖到的「真．履歷 ID」傳給後端
        const success = await deleteProfile(resumeIdToDelete);
        if (success) {
          //  6. 清除全域的選取狀態（因為那份履歷已經在地球上消失了）
          setActiveProfileId(null);
          // 7. 重新整理列表，
          load();
        }
      } catch (err) {
        console.error('刪除過程中發生錯誤：', err);
        alert('刪除失敗，請檢查資料庫連線');
      }
    });

    saveBtn.addEventListener('click', async () => {
      // Inline validation on save: show errors and focus first empty
      const clearErrors2 = () => { $('error-name').textContent = ''; $('error-school').textContent = ''; $('error-intro').textContent = ''; };
      clearErrors2();

      const resNameVal = $('editorTitle').value.trim();
      const nameVal = $('name').value.trim();
      const schoolVal = $('school').value.trim();
      const gradeVal = $('grade').value.trim();
      // HTML 內欄位 id 是 intro，這裡必須保持一致，否則儲存時會讀不到欄位。
      const introVal = $('intro').value.trim();
      const errorInputs = [];

      if (!resNameVal) {
        alert('履歷名稱為必填');
        return;
      }
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
        errorInputs.push($('intro'));
      }

      // 如果有欄位沒填，把游標焦點移到第一個漏填的欄位並中斷執行
      if (errorInputs.length) {
        errorInputs[0].focus();
        return;
      }

      const activeResumeId = getActiveProfileId();
      const payload = {
        resume_id: activeResumeId ? Number(activeResumeId) : undefined,
        resume_name: resNameVal || '履歷',
        user_pv_name: nameVal,
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
        load(); // 儲存後回到列表頁，讓使用者看到更新後的狀態
      } catch (err) {
        console.error('儲存按鈕執行失敗：', err);
        alert('儲存失敗，請確認後端伺服器與資料庫是否正常連線');
      }

    });

    // Photo upload and editing removed; photoPreview kept only for display.

    // 右上角按鈕的防禦性綁定，避免缺少共用模組時整頁失效。
    try {
      const notifyBtn = document.getElementById('notifyBtn');
      // const avatarBtn = document.getElementById('avatarBtn');
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
    });

    load();

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

  const homeLink = $('homeLink');
  if (homeLink) homeLink.href = Data.withUserParam('/contests.html');

})();

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
    const photoPreview = $('photoPreview');
    const myTeamsBox = $('myTeams');
    const followedBox = $('followed');

    // 照片功能已移除，使用預設頭像（不儲存圖片）
    let photoState = { src: null };

    function getAuthHeader() {
      const token = localStorage.getItem('token');
      return token ? { 'Authorization': `${token}` } : {};
    }

    // 載入：【修正防禦】優先使用本機暫存，若 API 失敗不阻斷畫面渲染
    async function loadProfiles() {
      // 先拿到本機既有的資料作為保底
      let localData = [];
      try {
        localData = JSON.parse(localStorage.getItem('profiles') || '[]');
      } catch(e) {
        localData = [];
      }

      try {
        const path = '/api/pv/loadPV';
        // 設定 3 秒超時，防止請求無休止卡死網頁
        const controller = new AbController ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 3000) : null;
        
        const response = await fetch(path, { 
          headers: { ...getAuthHeader() },
          signal: controller ? controller.signal : undefined 
        });
        if (timeoutId) clearTimeout(timeoutId);

        if (response.ok) {
          const existProfiles = await response.json();
          if (Array.isArray(existProfiles)) {
            localStorage.setItem('profiles', JSON.stringify(existProfiles));
            return existProfiles;
          }
        }
        return localData;
      } catch (err) {
        console.warn('無法連線到後端伺服器 API，將直接展示本機快取履歷。', err);
        return localData;
      }
    }

    async function saveProfiles(p) {
      localStorage.setItem('profiles', JSON.stringify(p));
      try {
        const path = '/api/pv/savePV';
        await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(p)
        });
      } catch (err) {
        console.error('同步至伺服器失敗:', err);
      }
    }

    function setActiveProfileId(id) { localStorage.setItem('activeProfileId', String(id)); }

    function getActiveProfileId() { return localStorage.getItem('activeProfileId') || null; }

    // 將專長標籤渲染成可移除的 tag。
    function renderTags(tags) {
      if (!tagsWrap) return;
      tagsWrap.innerHTML = '';
      if (!Array.isArray(tags)) return;
      tags.forEach((t, i) => {
        const el = document.createElement('span');
        el.className = 'tag';
        el.innerHTML = `${escapeHtml(t)}<span class="remove" data-idx="${i}">&times;</span>`;
        tagsWrap.appendChild(el);
      });
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
    function renderSyncedSidebar() {
      const uId = getUserIdFromUrl();
      
      const savedName = localStorage.getItem('userName');
      if ($('profileUsername') && savedName) {
        $('profileUsername').textContent = savedName;
      }
      if ($('profileUserEmail')) {
        $('profileUserEmail').textContent = uId !== 'unknown' ? '已驗證參賽者' : '訪客身分';
      }

      if (myTeamsBox) {
        const teams = JSON.parse(localStorage.getItem('myTeams') || '[]');
        if (!teams.length) {
          myTeamsBox.innerHTML = '<li class="empty-item">尚未加入任何隊伍</li>';
        } else {
          myTeamsBox.innerHTML = teams.map(t => `
            <li onclick="window.location.href='${getTeamHref()}'">
              <span class="team-dot"></span>
              <div class="list-content">
                <strong>${escapeHtml(t.name)}</strong>
                <span>角色: ${escapeHtml(t.role || '隊員')}</span>
              </div>
            </li>
          `).join('');
        }
      }

      if (followedBox) {
        const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
        const contests = JSON.parse(localStorage.getItem('contests') || '[]');
        const myFavContests = contests.filter(c => favs.includes(c.id));

        if (!myFavContests.length) {
          followedBox.innerHTML = '<li class="empty-item">尚未關注任何比賽</li>';
        } else {
          followedBox.innerHTML = myFavContests.map(c => `
            <li onclick="window.location.href='${getTeamHref()}'">
              <span class="contest-dot"></span>
              <div class="list-content">
                <strong>${escapeHtml(c.name)}</strong>
                <span>時間: ${escapeHtml(c.date)}</span>
              </div>
            </li>
          `).join('');
        }
      }
    }

    // 主邏輯：載入並渲染履歷畫廊（✨ 修正結構對齊 profile.css）
    async function load() {
      renderSyncedSidebar();
      if (!resumeGallery) return;
      
      resumeGallery.innerHTML = '<div class="loading-placeholder">正在從伺服器安全載入履歷...</div>';
      const profiles = await loadProfiles();
      resumeGallery.innerHTML = '';

      // 1. 渲染已經儲存的履歷卡片
      if (Array.isArray(profiles)) {
        profiles.forEach((p, index) => {
          const card = document.createElement('div');
          // 第一張卡片顯示「開啟」絲帶
          card.className = `resume-card ${index === 0 ? 'open' : ''}`;
          card.innerHTML = `
            <div class="resume-cover">
              <div class="resume-ribbon">開啟</div>
            </div>
            <div class="resume-body">
              <h3 class="resume-title">${escapeHtml(p.name)}</h3>
              <span class="resume-time">${p.updatedAt || '2026/05/28 上午12:00'}</span>
              <div class="resume-card-actions">
                <button class="icon-action edit-btn" data-id="${p.id}" type="button">查看</button>
                <button class="icon-action" type="button">···</button>
              </div>
            </div>
          `;
          resumeGallery.appendChild(card);
        });
      }

      // 2. 渲染右側經典大橘色虛線「+ 新增履歷」按鈕
      const createCard = document.createElement('div');
      createCard.className = 'add-resume-card';
      createCard.innerHTML = `
        <strong>+ 新增履歷</strong>
        <span>針對不同工作客製化履歷，申請隊伍時可以選擇要附上的版本。</span>
      `;
      createCard.addEventListener('click', () => openEditor(null));
      resumeGallery.appendChild(createCard);

      // 3. 綁定卡片點擊查看事件
      resumeGallery.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditor(Number(btn.dataset.id));
        });
      });
    }

    // 切換至編輯器介面
    async function openEditor(id) {
      if (resumeHome) resumeHome.hidden = true;
      if (resumeEditor) resumeEditor.removeAttribute('hidden');

      const profiles = await loadProfiles();
      let current = null;

      if (id !== null) {
        current = profiles.find(p => p.id === id);
        setActiveProfileId(id);
      } else {
        setActiveProfileId('');
      }

      if (current) {
        if (editorTitle) editorTitle.textContent = current.name || '未命名履歷';
        if ($('name')) $('name').value = current.data?.name || '';
        if ($('school')) $('school').value = current.data?.school || '';
        if ($('bio')) $('bio').value = current.data?.bio || '';
        if ($('email')) $('email').value = current.data?.email || '';
        if ($('github')) $('github').value = current.data?.github || '';
        photoState.src = current.data?.photo || null;
        renderTags(current.data?.tags || []);
        if (delResume) delResume.style.display = 'inline-block';
        if (exportBtn) exportBtn.removeAttribute('hidden');
      } else {
        if (editorTitle) editorTitle.textContent = '新增專屬履歷';
        const form = $('profileForm');
        if (form) form.reset();
        photoState.src = null;
        renderTags([]);
        if (delResume) delResume.style.display = 'none';
        if (exportBtn) exportBtn.setAttribute('hidden', 'true');
      }

      if (photoPreview) {
        photoPreview.style.backgroundImage = photoState.src ? `url(${photoState.src})` : 'none';
        photoPreview.textContent = photoState.src ? '' : '無相片';
      }
    }

   // 綁定「返回列表」按鈕點擊事件（新增 e.preventDefault() 防止任何表單或網頁重新整理）
    if (backToGallery) {
      backToGallery.addEventListener('click', (e) => {
        if (e) e.preventDefault(); // 阻斷一切網頁原生提交/刷新行為
        
        if (resumeHome) resumeHome.hidden = false;       // 秀出列表主首頁
        if (resumeEditor) resumeEditor.setAttribute('hidden', 'true'); // 隱藏編輯器
        
        load(); // 重新載入最新履歷列表
      });
    }

    if (addTag) {
      addTag.addEventListener('click', () => {
        if (!newTag) return;
        const val = newTag.value.trim();
        if (!val) return;
        const tags = Array.from(tagsWrap ? tagsWrap.querySelectorAll('.tag') : []).map(el => el.textContent.replace('×', '').trim());
        if (!tags.includes(val)) {
          tags.push(val);
          renderTags(tags);
        }
        newTag.value = '';
      });
    }

    if (tagsWrap) {
      tagsWrap.addEventListener('click', e => {
        if (e.target.classList.contains('remove')) {
          const idx = Number(e.target.dataset.idx);
          const tags = Array.from(tagsWrap.querySelectorAll('.tag')).map(el => el.textContent.replace('×', '').trim());
          tags.splice(idx, 1);
          renderTags(tags);
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const titleStr = editorTitle ? editorTitle.textContent.trim() : '未命名履歷';
        if (!titleStr) { alert('請輸入履歷名稱！'); return; }

        const pId = getActiveProfileId();
        let profiles = await loadProfiles();

        const tags = Array.from(tagsWrap ? tagsWrap.querySelectorAll('.tag') : []).map(el => el.textContent.replace('×', '').trim());
        const dataObj = {
          name: $('name') ? $('name').value.trim() : '',
          school: $('school') ? $('school').value.trim() : '',
          bio: $('bio') ? $('bio').value.trim() : '',
          email: $('email') ? $('email').value.trim() : '',
          github: $('github') ? $('github').value.trim() : '',
          tags: tags,
          photo: photoState.src
        };

        const nowTime = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true });

        if (pId) {
          const idx = profiles.findIndex(p => p.id === Number(pId));
          if (idx !== -1) {
            profiles[idx].name = titleStr;
            profiles[idx].data = dataObj;
            profiles[idx].updatedAt = nowTime;
          }
        } else {
          profiles.push({
            id: Date.now(),
            name: titleStr,
            data: dataObj,
            updatedAt: nowTime
          });
        }

        await saveProfiles(profiles);
        alert('🎉 履歷變更已成功同步！');
        if (backToGallery) backToGallery.click();
      });
    }

    if (delResume) {
      delResume.addEventListener('click', async () => {
        const pId = getActiveProfileId();
        if (!pId) return;
        if (!confirm('確定要永久刪除此份履歷版本嗎？')) return;

        let profiles = await loadProfiles();
        profiles = profiles.filter(p => p.id !== Number(pId));
        await saveProfiles(profiles);

        alert('已成功移除該版本');
        if (backToGallery) backToGallery.click();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const titleStr = editorTitle ? editorTitle.textContent.trim() : 'resume';
        const tags = Array.from(tagsWrap ? tagsWrap.querySelectorAll('.tag') : []).map(el => el.textContent.replace('×', '').trim());
        const dataObj = {
          name: $('name') ? $('name').value.trim() : '',
          school: $('school') ? $('school').value.trim() : '',
          bio: $('bio') ? $('bio').value.trim() : '',
          email: $('email') ? $('email').value.trim() : '',
          github: $('github') ? $('github').value.trim() : '',
          tags: tags
        };
        const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${titleStr}.json`;
        a.click();
      });
    }

    if (viewResumeBtn) {
      viewResumeBtn.addEventListener('click', () => {
        const pId = getActiveProfileId() || 'new';
        window.open(`/resume-view.html?id=${pId}&userId=${encodeURIComponent(getUserIdFromUrl())}`, '_blank');
      });
    }

    function updateNotificationBadge() {
      const b = $('notificationBadge');
      if (!b) return;
      const list = JSON.parse(localStorage.getItem('notifications') || '[]');
      const unread = list.filter(n => !n.read).length;
      if (unread > 0) {
        b.textContent = unread;
        b.classList.remove('hide');
      } else {
        b.classList.add('hide');
      }
    }

    function showNotifications(e) {
      e.stopPropagation();
      const b = $('notificationBadge');
      if (b) b.classList.add('hide');
      const list = JSON.parse(localStorage.getItem('notifications') || '[]');
      if (!list.length) { alert('目前沒有任何組隊或系統通知。'); return; }
      alert('【系統最新通知】\n' + list.map(n => `🔔 [${n.time || '剛剛'}] ${n.text}`).join('\n'));
      localStorage.setItem('notifications', JSON.stringify(list.map(n => ({ ...n, read: true }))));
    }

    try {
      const notifyBtn = $('notifyBtn');
      const teamBtn = $('teamBtn');
      if (notifyBtn && !window.AppNotifications) notifyBtn.addEventListener('click', showNotifications);
      if (teamBtn) {
        const teamHref = getTeamHref();
        teamBtn.setAttribute('href', teamHref);
      }
    } catch (err) {
      console.error(err);
    }

    const logoLink = document.querySelector('.logo-link');
    if (logoLink) {
      logoLink.setAttribute('href', getTeamHref());
    }

    window.addEventListener('storage', e => {
      if (['myTeams', 'favorites', 'teams', 'contests'].includes(e.key)) renderSyncedSidebar();
      if (e.key === 'notifications' && !window.AppNotifications) updateNotificationBadge();
    });

    load();
    if (!window.AppNotifications) updateNotificationBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
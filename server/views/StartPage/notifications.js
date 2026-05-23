(function(){
  // 預設使用者 ID：網址沒有帶 userId 時會使用這個本機測試帳號。
  const CURRENT_USER_ID = 9999;
  let cachedNotifications = [];

  // 將通知文字轉成安全 HTML，避免通知內容破壞畫面結構。
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[char]));
  }

  function getCurrentUserId(){
    const raw = new URLSearchParams(location.search).get('userId');
    const saved = localStorage.getItem('userId');
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
    const savedParsed = Number(saved);
    return Number.isFinite(savedParsed) ? savedParsed : CURRENT_USER_ID;
  }

  // 本機備援：伺服器未啟動時仍保留原本的通知基本功能。
  function loadLocal(){
    return JSON.parse(localStorage.getItem('notifications') || '[]');
  }

  function saveLocal(notifications){
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }

  function matchesUser(notification, userId = getCurrentUserId()){
    return Number(notification.userId) === Number(userId);
  }

  function isRead(notification){
    return Boolean(notification.read);
  }

  // 從資料庫載入通知；後端會順便同步新比賽通知與清除已讀超過五天的通知。
  async function load(){
    const userId = getCurrentUserId();
    try {
      const res = await fetch(`/notifications?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error('load notifications failed');
      const data = await res.json();
      cachedNotifications = data.notifications || [];
      return cachedNotifications;
    } catch (err) {
      cachedNotifications = loadLocal().filter(item => matchesUser(item, userId));
      return cachedNotifications;
    }
  }

  // 新增通知，並用 sourceKey 避免同一來源重複產生通知。
  async function add(notification){
    const userId = Number(notification.userId ?? getCurrentUserId());
    const sourceKey = notification.sourceKey || `${notification.type || 'notice'}:${notification.sourceId || notification.message}`;
    const payload = {
      type: notification.type || 'notice',
      userId,
      message: notification.message,
      sourceId: notification.sourceId || null,
      sourceKey,
      action: notification.action || null
    };

    try {
      const res = await fetch('/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('create notification failed');
      await updateBadge();
    } catch (err) {
      const notifications = loadLocal();
      if (notifications.some(item => item.sourceKey === sourceKey && Number(item.userId) === userId)) return;
      notifications.unshift({
        id: Date.now() + Math.floor(Math.random() * 1000),
        ...payload,
        createdAt: new Date().toISOString(),
        read: false
      });
      saveLocal(notifications);
      await updateBadge();
    }
  }


  // 舊頁面仍會呼叫這個方法；實際同步新比賽已改由 GET /notifications 負責。
  async function ensureContestNotifications(){
    await updateBadge();
  }

  // 更新右上角通知按鈕上的未讀數字。
  async function updateBadge(){
    const notifyBtn = document.getElementById('notifyBtn');
    if (!notifyBtn) return;
    const notifications = await load();
    const unread = notifications.filter(item => !isRead(item)).length;
    notifyBtn.textContent = unread ? `🔔 ${unread}` : '🔔';
  }

  // 動態加入通知彈窗所需的樣式。
  function injectStyle(){
    if (document.getElementById('notificationsStyle')) return;
    const style = document.createElement('style');
    style.id = 'notificationsStyle';
    style.textContent = `
      .modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:900}
      .notification-card{max-width:520px;width:min(520px,calc(100vw - 28px));max-height:calc(100vh - 48px);display:flex;flex-direction:column}
      .modal-card{background:#fff;padding:24px;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
      .notification-list{display:flex;flex:1;flex-direction:column;gap:10px;margin-top:12px;overflow-y:auto;min-height:0;padding-right:4px}
      .notification-item{border:1px solid #eee;border-radius:8px;background:#fff;padding:10px}
      .notification-item.unread{border-color:#d4b283;background:#fff8ef}
      .notification-item strong{display:block;color:#3f342c;line-height:1.4}
      .notification-item span{display:block;color:#7b6a59;font-size:13px;margin-top:5px}
      .notification-action{margin-top:8px}
      .modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
      .btn{padding:10px 14px;border-radius:8px;border:none;cursor:pointer}
      .btn.outline{background:#fff;border:1px solid #ddd;color:#333}
      .empty-note{color:#8a735e;font-size:14px}
    `;
    document.head.appendChild(style);
  }

  // 使用者打開通知視窗後，將目前可見通知標記為已讀。
  async function markVisibleRead(visible){
    const unreadIds = visible.filter(item => !isRead(item)).map(item => Number(item.id)).filter(Number.isFinite);
    if (!unreadIds.length) return;

    try {
      await fetch('/notifications/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getCurrentUserId(), ids: unreadIds })
      });
      cachedNotifications = cachedNotifications.map(item => unreadIds.includes(Number(item.id)) ? { ...item, read: true } : item);
    } catch (err) {
      const ids = new Set(unreadIds);
      const notifications = loadLocal().map(item => ids.has(Number(item.id)) ? { ...item, read: true } : item);
      saveLocal(notifications);
      cachedNotifications = cachedNotifications.map(item => ids.has(Number(item.id)) ? { ...item, read: true } : item);
    }
  }

  function renderAction(item){
    if (item.action?.type === 'review-request') {
      return `<button class="btn outline notification-action" data-action="review-request" data-team="${escapeHtml(item.action.teamId)}">查看申請</button>`;
    }
    if (item.action?.type === 'application-approved') {
      return `<button class="btn outline notification-action" data-action="team-detail" data-team="${escapeHtml(item.action.teamId)}">查看隊伍</button>`;
    }
    if (item.action?.type === 'contest-detail') {
      return `<button class="btn outline notification-action" data-action="contest-detail" data-contest="${escapeHtml(item.action.contestId)}">查看比賽</button>`;
    }
    return '';
  }

  function goWithUser(path){
    const userId = new URLSearchParams(location.search).get('userId');
    location.href = `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId || localStorage.getItem('userId') || getCurrentUserId())}`;
  }

  // 顯示通知彈窗，並處理通知中的動作按鈕。
  async function show(){
    document.getElementById('notificationModal')?.remove();
    const visible = (await load()).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.className = 'modal notification-modal';
    modal.innerHTML = `
      <div class="modal-card notification-card">
        <h3>通知</h3>
        <div class="notification-list">
          ${visible.length ? visible.map(item => `
            <div class="notification-item ${isRead(item) ? '' : 'unread'}">
              <strong>${escapeHtml(item.message)}</strong>
              <span>${new Date(item.createdAt).toLocaleString('zh-TW')}</span>
              ${renderAction(item)}
            </div>
          `).join('') : '<div class="empty-note">目前沒有通知</div>'}
        </div>
        <div class="modal-actions">
          <button id="closeNotificationModal" class="btn outline">關閉</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    await markVisibleRead(visible);
    await updateBadge();

    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    modal.addEventListener('click', event => {
      const action = event.target.closest('.notification-action');
      if (!action) return;
      modal.remove();

      if (action.dataset.action === 'review-request') {
        const teamId = action.dataset.team;
        if (window.AppReview?.openTeamRequests) {
          window.AppReview.openTeamRequests(Number(teamId));
        } else {
          goWithUser(`/team.html?manageTeamId=${encodeURIComponent(teamId)}`);
        }
      }
      if (action.dataset.action === 'team-detail') {
        goWithUser(`/team-info.html?teamId=${encodeURIComponent(action.dataset.team)}`);
      }
      if (action.dataset.action === 'contest-detail') {
        goWithUser(`/contest.html?id=${encodeURIComponent(action.dataset.contest)}`);
      }
    });
    document.getElementById('closeNotificationModal').addEventListener('click', () => modal.remove());
  }

  // 綁定通知按鈕，並在頁面載入時先同步一次未讀數。
  function bind(){
    injectStyle();
    document.getElementById('notifyBtn')?.addEventListener('click', show);
    updateBadge();
  }

  // 對其他頁面公開通知相關方法。
  window.AppNotifications = { add, bind, ensureContestNotifications, updateBadge, getCurrentUserId };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.addEventListener('storage', event => {
    if (event.key === 'notifications') updateBadge();
  });
})();

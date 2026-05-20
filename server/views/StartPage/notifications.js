(function(){
  // 預設使用者 ID：網址沒有帶 userId 時會使用這個本機測試帳號。
  const CURRENT_USER_ID = 9999;

  // 將通知文字轉成安全 HTML，避免通知內容破壞畫面結構。
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[char]));
  }

  function getCurrentUserId(){
    const raw = new URLSearchParams(location.search).get('userId');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : CURRENT_USER_ID;
  }

  // 從 localStorage 讀取通知清單。
  function load(){
    return JSON.parse(localStorage.getItem('notifications') || '[]');
  }

  // 將通知清單寫回 localStorage。
  function save(notifications){
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }

  // 判斷通知是否屬於目前使用者，或是發給所有人的通知。
  function matchesUser(notification, userId = getCurrentUserId()){
    return notification.userId === 'all' || Number(notification.userId) === Number(userId);
  }

  // 全體通知用 readBy 紀錄已讀者；個人通知則使用 read 欄位。
  function isRead(notification, userId = getCurrentUserId()){
    if (notification.userId === 'all') {
      return Array.isArray(notification.readBy) && notification.readBy.includes(Number(userId));
    }
    return Boolean(notification.read);
  }

  // 新增通知，並用 sourceKey 避免同一來源重複產生通知。
  function add(notification){
    const notifications = load();
    const sourceKey = notification.sourceKey || `${notification.type || 'notice'}:${notification.sourceId || notification.message}`;
    if (notifications.some(item => item.sourceKey === sourceKey && String(item.userId) === String(notification.userId ?? getCurrentUserId()))) return;
    notifications.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      type: notification.type || 'notice',
      userId: notification.userId ?? getCurrentUserId(),
      message: notification.message,
      sourceId: notification.sourceId || null,
      sourceKey,
      action: notification.action || null,
      createdAt: notification.createdAt || new Date().toISOString(),
      read: false,
      readBy: []
    });
    save(notifications);
    updateBadge();
  }

  // 依照比賽清單產生比賽通知。
  function ensureContestNotifications(contests){
    contests.forEach(contest => {
      add({
        type: 'contest',
        userId: 'all',
        sourceId: contest.id,
        sourceKey: `contest:${contest.id}`,
        message: `新比賽：${contest.name}，比賽日期 ${contest.date || '未定'}`
      });
    });
  }

  // 更新右上角通知按鈕上的未讀數字。
  function updateBadge(){
    const notifyBtn = document.getElementById('notifyBtn');
    if (!notifyBtn) return;
    const userId = getCurrentUserId();
    const unread = load().filter(item => matchesUser(item, userId) && !isRead(item, userId)).length;
    notifyBtn.textContent = unread ? `🔔 ${unread}` : '🔔';
  }

  // 動態加入通知彈窗所需的樣式。
  function injectStyle(){
    if (document.getElementById('notificationsStyle')) return;
    const style = document.createElement('style');
    style.id = 'notificationsStyle';
    style.textContent = `
      .modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:900}
      .notification-card{max-width:520px;width:min(520px,calc(100vw - 28px))}
      .modal-card{background:#fff;padding:24px;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
      .notification-list{display:flex;flex-direction:column;gap:10px;margin-top:12px}
      .notification-item{border:1px solid #eee;border-radius:8px;background:#fff;padding:10px}
      .notification-item.unread{border-color:#d4b283;background:#fff8ef}
      .notification-item strong{display:block;color:#3f342c;line-height:1.4}
      .notification-item span{display:block;color:#7b6a59;font-size:13px;margin-top:5px}
      .modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
      .btn{padding:10px 14px;border-radius:8px;border:none;cursor:pointer}
      .btn.outline{background:#fff;border:1px solid #ddd;color:#333}
      .empty-note{color:#8a735e;font-size:14px}
    `;
    document.head.appendChild(style);
  }

  // 使用者打開通知視窗後，將目前可見通知標記為已讀。
  function markVisibleRead(){
    const userId = getCurrentUserId();
    const notifications = load().map(item => {
      if (!matchesUser(item, userId)) return item;
      if (item.userId === 'all') {
        const readBy = Array.isArray(item.readBy) ? item.readBy : [];
        return readBy.includes(Number(userId)) ? item : { ...item, readBy: [...readBy, Number(userId)] };
      }
      return { ...item, read: true };
    });
    save(notifications);
  }

  // 顯示通知彈窗，並處理通知中的動作按鈕。
  function show(){
    document.getElementById('notificationModal')?.remove();
    const visible = load().filter(item => matchesUser(item)).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
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
              ${item.action?.type === 'review-request' ? `<button class="btn outline notification-action" data-team="${escapeHtml(item.action.teamId)}">查看</button>` : ''}
            </div>
          `).join('') : '<div class="empty-note">目前沒有通知</div>'}
        </div>
        <div class="modal-actions">
          <button id="closeNotificationModal" class="btn outline">關閉</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    markVisibleRead();
    updateBadge();
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    modal.addEventListener('click', event => {
      const action = event.target.closest('.notification-action');
      if (!action) return;
      const teamId = action.dataset.team;
      modal.remove();
      if (window.AppReview?.openTeamRequests) {
        window.AppReview.openTeamRequests(Number(teamId));
      } else {
        const userId = new URLSearchParams(location.search).get('userId');
        location.href = `/team.html?${userId ? `userId=${encodeURIComponent(userId)}&` : ''}manageTeamId=${encodeURIComponent(teamId)}`;
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

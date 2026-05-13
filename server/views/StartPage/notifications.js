(function(){
  const CURRENT_USER_ID = 9999;

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

  function load(){
    return JSON.parse(localStorage.getItem('notifications') || '[]');
  }

  function save(notifications){
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }

  function matchesUser(notification, userId = getCurrentUserId()){
    return notification.userId === 'all' || Number(notification.userId) === Number(userId);
  }

  function isRead(notification, userId = getCurrentUserId()){
    if (notification.userId === 'all') {
      return Array.isArray(notification.readBy) && notification.readBy.includes(Number(userId));
    }
    return Boolean(notification.read);
  }

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
      createdAt: notification.createdAt || new Date().toISOString(),
      read: false,
      readBy: []
    });
    save(notifications);
    updateBadge();
  }

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

  function updateBadge(){
    const notifyBtn = document.getElementById('notifyBtn');
    if (!notifyBtn) return;
    const userId = getCurrentUserId();
    const unread = load().filter(item => matchesUser(item, userId) && !isRead(item, userId)).length;
    notifyBtn.textContent = unread ? `🔔 ${unread}` : '🔔';
  }

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
    document.getElementById('closeNotificationModal').addEventListener('click', () => modal.remove());
  }

  function bind(){
    document.getElementById('notifyBtn')?.addEventListener('click', show);
    updateBadge();
  }

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

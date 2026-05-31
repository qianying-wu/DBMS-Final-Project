(function(){

  const $ = id => document.getElementById(id);

  function withUser(path){
    const userId = new URLSearchParams(location.search).get('userId') || localStorage.getItem('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  function isLoggedIn(){
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId') || new URLSearchParams(location.search).get('userId');
    return Boolean(
      token &&
      token.trim() !== '' &&
      userId &&
      userId !== 'unknown' &&
      userId !== 'null' &&
      userId !== 'undefined'
    );
  }

  function askLogin(){
    const loginPromptModal = document.getElementById('loginPromptModal');
    const loginPromptMessage = document.getElementById('loginPromptMessage');
    if (loginPromptMessage) loginPromptMessage.textContent = '這個功能需要先登入，是否前往登入頁？';
    if (loginPromptModal) {
      loginPromptModal.classList.remove('hidden');
      document.body.classList.add('modal-open');

      const onCancel = () => {
        loginPromptModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
        cleanup();
      };
      const onLogin = () => {
        cleanup();
        location.href = '/auth.html';
      };

      function cleanup(){
        document.getElementById('loginPromptCancel')?.removeEventListener('click', onCancel);
        document.getElementById('loginPromptLogin')?.removeEventListener('click', onLogin);
      }

      document.getElementById('loginPromptCancel')?.addEventListener('click', onCancel);
      document.getElementById('loginPromptLogin')?.addEventListener('click', onLogin);
      return;
    }
    location.href = '/auth.html';
  }

  function closeMenu(){
    document.getElementById('accountMenu')?.remove();
  }

  function openMenu(button){
    closeMenu();
    const menu = document.createElement('div');
    menu.id = 'accountMenu';
    menu.className = 'account-menu';
    menu.innerHTML = `
      <a href="${withUser('/profile.html')}">我的履歷</a>
      <a href="${withUser('/account-info.html')}">帳號資訊</a>
      <a href="${withUser('/myTeam.html')}">隊伍管理</a>
      <button onclick="logout()" class="logout-btn">登出</button>
    `;
    document.body.appendChild(menu);
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
  }

  // 🌟 全站共用的漂亮確認彈窗
  function showLogoutConfirm(onConfirm) {
    const existingModal = document.getElementById('customConfirmModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'customConfirmModal';
    modal.className = 'modal';
    modal.style.zIndex = '9999';

    modal.innerHTML = `
      <div class="modal-card" style="text-align: center; min-width: 320px; padding: 36px 24px;">
        <div style="font-size: 56px; margin-bottom: 12px; line-height: 1;">👋</div>
        <h3 style="margin: 0 0 12px 0; color: #D9534F; font-size: 22px;">準備離開了嗎？</h3>
        <p style="color: #5C4F42; margin: 0 0 24px 0; font-size: 15px; line-height: 1.6;">確定要登出你的帳號嗎？</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="cancelLogoutBtn" style="flex: 1; border-radius: 99px; font-size: 15px; background: #F2EEE9; color: #5C4F42; border: none; padding: 12px 0; cursor: pointer; font-weight: 600;">取消</button>
          <button id="okLogoutBtn" style="flex: 1; border-radius: 99px; font-size: 15px; background: #D9534F; border: none; color: #fff; padding: 12px 0; cursor: pointer; font-weight: 600;">確定登出</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('cancelLogoutBtn').addEventListener('click', () => modal.remove());
    document.getElementById('okLogoutBtn').addEventListener('click', () => {
      modal.remove();
      onConfirm(); 
    });
  }

  // 🌟 新增：登出成功後的自動導航彈窗
  function showLogoutSuccess(onComplete) {
    const modal = document.createElement('div');
    modal.id = 'customSuccessModal';
    modal.className = 'modal';
    modal.style.zIndex = '9999';

    modal.innerHTML = `
      <div class="modal-card" style="text-align: center; min-width: 320px; padding: 36px 24px;">
        <div style="font-size: 56px; margin-bottom: 12px; line-height: 1;">✨</div>
        <h3 style="margin: 0 0 12px 0; color: #D48C5B; font-size: 22px;">您已成功登出</h3>
        <p style="color: #5C4F42; margin: 0; font-size: 15px; line-height: 1.6;">正在為您導向首頁，請稍候...</p>
      </div>
    `;

    document.body.appendChild(modal);

    // 設定 2 秒後自動執行跳轉動作
    setTimeout(() => {
      modal.remove();
      onComplete();
    }, 2000);
  }

  // 🚀 定義全域 logout 函式
  window.logout = function() {
    showLogoutConfirm(() => {
      // 1. 清除登入狀態
      localStorage.removeItem('token');
      localStorage.removeItem('userId'); 

      // 2. 把畫面上所有的紅色愛心變回灰色/空心
      const activeHearts = document.querySelectorAll('.fav-btn.active, .fav-btn.red');
      activeHearts.forEach(heart => {
          heart.classList.remove('active', 'red');
      });
      
      // 3. 呼叫成功彈窗，並在 2 秒後自動跳轉
      showLogoutSuccess(() => {
        window.location.href = 'contests.html'; 
      });
    });
  };

  function injectStyle(){
    if (document.getElementById('accountMenuStyle')) return;
    const style = document.createElement('style');
    style.id = 'accountMenuStyle';
    style.textContent = `
      .account-menu{position:fixed;z-index:1000;background:#fff;border:1px solid #eadfd2;border-radius:8px;box-shadow:0 16px 40px rgba(70,52,36,.16);min-width:150px;padding:6px}
      .account-menu a, .account-menu button{display:block;padding:10px 12px;border-radius:6px;color:#4f3827;text-decoration:none;font-weight:700;font-size:14px}
      .account-menu button{width:100%;text-align:left;background:none;border:none;cursor:pointer}
      .account-menu a:hover, .account-menu button:hover{background:#fff7ec}
    `;
    document.head.appendChild(style);
  }

  function bind(){
    injectStyle();

    document.addEventListener('click', event => {
      const avatar = event.target.closest('#avatarBtn');
      if (avatar) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (!isLoggedIn()) {
          closeMenu();
          askLogin();
          return;
        }
        if (document.getElementById('accountMenu')) closeMenu(); else openMenu(avatar);
        return;
      }
      if (!event.target.closest('#accountMenu')) closeMenu();
    }, true);
    window.addEventListener('resize', closeMenu);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
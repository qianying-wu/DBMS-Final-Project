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
      <div class="logout-modal-card">
        <div class="logout-modal-icon logout-modal-icon-warning" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <path d="M10 17l5-5-5-5"/>
            <path d="M15 12H3"/>
          </svg>
        </div>
        <h3>準備離開了嗎？</h3>
        <p>確定要登出你的帳號嗎？</p>
        <div class="logout-modal-actions">
          <button id="cancelLogoutBtn" class="logout-modal-btn secondary">取消</button>
          <button id="okLogoutBtn" class="logout-modal-btn danger">確定登出</button>
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
      <div class="logout-modal-card compact">
        <div class="logout-modal-icon logout-modal-icon-success" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        </div>
        <h3>您已成功登出</h3>
        <p>正在為您導向首頁，請稍候...</p>
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
      .modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(63,52,44,.32);backdrop-filter:blur(5px);z-index:9999}
      .logout-modal-card{width:min(420px,calc(100vw - 40px));background:#fffdf9;border:1px solid #eadfd2;border-radius:18px;box-shadow:0 24px 60px rgba(63,52,44,.18);padding:34px 32px;text-align:center;color:#4f3827}
      .logout-modal-card.compact{padding:36px 32px}
      .logout-modal-icon{width:64px;height:64px;border-radius:18px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center}
      .logout-modal-icon svg{width:34px;height:34px}
      .logout-modal-icon-warning{background:#fff4ea;color:#b8744f;border:1px solid #f0d5bd}
      .logout-modal-icon-success{background:#f6efe5;color:#c99d69;border:1px solid #ead8bf}
      .logout-modal-card h3{margin:0 0 10px;color:#4f3827;font-size:22px;font-weight:900;letter-spacing:0}
      .logout-modal-card p{margin:0 0 24px;color:#7b6a59;font-size:15px;line-height:1.6;font-weight:700}
      .logout-modal-card.compact p{margin-bottom:0}
      .logout-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .logout-modal-btn{height:48px;border-radius:14px;border:0;cursor:pointer;font-size:15px;font-weight:900;transition:transform .18s ease,filter .18s ease}
      .logout-modal-btn:hover{transform:translateY(-1px)}
      .logout-modal-btn.secondary{background:#f4eee8;color:#5f4734}
      .logout-modal-btn.danger{background:#b96a5f;color:#fff;box-shadow:0 10px 20px rgba(185,106,95,.18)}
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

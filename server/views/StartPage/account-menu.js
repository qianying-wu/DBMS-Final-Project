(function(){
  // 將目前網址上的 userId 附加到導頁連結。
  function withUser(path){
    const userId = new URLSearchParams(location.search).get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
  }

  // 只用網址上的 userId 判斷是否登入，避免讀到舊 localStorage 後誤開個人資料。
  function isLoggedIn(){
    const userId = new URLSearchParams(location.search).get('userId');
    return Boolean(userId && userId !== 'unknown');
  }

  function askLogin(){
    if (confirm('這個功能需要先登入，是否前往登入頁？')) {
      location.href = `/auth.html?redirect=${encodeURIComponent(location.pathname + location.search)}`;
    }
  }

  // 關閉已存在的帳號選單。
  function closeMenu(){
    document.getElementById('accountMenu')?.remove();
  }

  // 在頭像按鈕下方建立帳號選單。
  function openMenu(button){
    closeMenu();
    const menu = document.createElement('div');
    menu.id = 'accountMenu';
    menu.className = 'account-menu';
    menu.innerHTML = `
      <a href="${withUser('/profile.html')}">我的履歷</a>
      <a href="${withUser('/account-info.html')}">帳號資訊</a>
      <a href="${withUser('/history.html')}">歷史紀錄</a>
      <button onclick="logout()" class="logout-btn">登出</button>
    `;
    document.body.appendChild(menu);
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
  }

  // 登出功能：清除登入資訊並導回首頁。 
  window.logout = function() {
    
    // 1. 徹底清除瀏覽器上記錄的登入憑證
    localStorage.removeItem('token');   // 清除 JWT 通行證
    localStorage.removeItem('userId');  // 清除使用者 ID 紀錄

    // 2. 提示使用者已登出
    alert('👋 您已成功登出！');

    // 3. 🚀 導向回首頁
    location.href = '/team.html'; 
  };

  // 動態注入帳號選單樣式，避免每個頁面重複寫 CSS。
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

  // 綁定頭像按鈕、組隊按鈕與選單關閉事件。
  function bind(){
    injectStyle();
    const teamBtn = document.getElementById('teamBtn');
    if (teamBtn) teamBtn.href = withUser('/team.html');
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

  // DOM 完成後再綁定，確保頁面元素已存在。
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

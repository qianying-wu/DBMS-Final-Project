(function(){
  function withUser(path){
    const userId = new URLSearchParams(location.search).get('userId');
    return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
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
      <a href="${withUser('/history.html')}">歷史紀錄</a>
      <button type="button" onclick="logout()">登出</button>
      `;
    document.body.appendChild(menu);
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
  }

  function injectStyle(){
    if (document.getElementById('accountMenuStyle')) return;
    const style = document.createElement('style');
    style.id = 'accountMenuStyle';
    style.textContent = `
      .account-menu{position:fixed;z-index:1000;background:#fff;border:1px solid #eadfd2;border-radius:8px;box-shadow:0 16px 40px rgba(70,52,36,.16);min-width:150px;padding:6px}
      .account-menu a, .account-menu button{display:block;padding:10px 12px;border-radius:6px;color:#4f3827;text-decoration:none;font-size:14px;font-weight:500;transition:background 0.2s}
      .account-menu button{border:none;background:none;width:100%;text-align:left;cursor:pointer}
      .account-menu a:hover, .account-menu button:hover{background:#fff7ec}
    `;
    document.head.appendChild(style);
  }

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

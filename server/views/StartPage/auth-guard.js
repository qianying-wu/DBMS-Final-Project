// auth-guard.js
(function() {
    function syncAuthUI() {
      
      // 1. 先抓網址參數
      const params = new URLSearchParams(window.location.search);
      const urlUserId = params.get('userId');

      // 2. 如果網址有正確的 userId，但 LocalStorage 沒存，就自動幫它補存進去！
      if (urlUserId && urlUserId !== 'unknown') {
         localStorage.setItem('userId', urlUserId);
         sessionStorage.setItem('userId', urlUserId);
      }

      let userId = localStorage.getItem('userId');
      if (!userId || userId === 'unknown') {
         userId = sessionStorage.getItem('userId');
      }
      const token = localStorage.getItem('token');

      // 3. 這時候再去拿 LocalStorage，就絕對拿得到了
      const userArea = document.querySelector('.actions'); // 🔔👤 區塊
      const authArea = document.querySelector('.loginBtn');      // 登入按鈕區塊
  
      if (!userArea || !authArea) return; // 確保頁面上有這些元素才執行
  
      const hasValidLogin = Boolean(
        token &&
        token.trim() !== '' &&
        userId &&
        userId !== 'unknown' &&
        userId !== 'null' &&
        userId !== 'undefined'
      );

      if (hasValidLogin) {
        userArea.style.display = 'flex';
        authArea.style.display = 'none';
      } else {
        userArea.style.display = 'none';
        authArea.style.display = 'flex';
      }
    }
  
    // 登出功能
    window.logout = function() {
      // 清除標籤：把存好的 userId 刪掉
      localStorage.removeItem('userId');
    
      // 跳轉：導回首頁或登入頁
      window.location.href = '/contests.html'; 
    };
  
    // 確保一進頁面就執行同步
    document.addEventListener('DOMContentLoaded', syncAuthUI);
  })();

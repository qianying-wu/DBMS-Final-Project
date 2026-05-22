// auth-guard.js
(function() {
    function syncAuthUI() {
      // 1. 先抓網址參數
      const params = new URLSearchParams(window.location.search);
      const urlUserId = params.get('userId');

      // 2. 如果網址有正確的 userId，但 LocalStorage 沒存，就自動幫它補存進去！
      if (urlUserId && urlUserId !== 'unknown') {
         localStorage.setItem('userId', urlUserId);
      }

      // 3. 這時候再去拿 LocalStorage，就絕對拿得到了
      const userId = localStorage.getItem('userId');
      const userArea = document.querySelector('.actions'); // 🔔👤 區塊
      const authArea = document.querySelector('.loginBtn');      // 登入按鈕區塊
  
      if (!userArea || !authArea) return; // 確保頁面上有這些元素才執行
  
      if (userId && userId !== 'unknown') {
        userArea.style.display = 'flex';
        authArea.style.display = 'none';
      } else {
        userArea.style.display = 'none';
        authArea.style.display = 'block';
      }
    }
  
    // 登出功能
    window.logout = function() {
        // 1. 清除標籤：把存好的 userId 刪掉
        localStorage.removeItem('userId');
        
        // 2. 選擇性：也可以清空所有 LocalStorage
        // localStorage.clear(); 
    
        // 3. 跳轉：導回首頁或登入頁
        window.location.href = '/team.html'; 
    };
  
    // 確保一進頁面就執行同步
    document.addEventListener('DOMContentLoaded', syncAuthUI);
  })();
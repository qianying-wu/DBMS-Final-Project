// navbar.js
(function() {
    function syncAuthUI() {
      const userId = localStorage.getItem('userId');
      const userArea = document.querySelector('.actions'); // 🔔👤 區塊
      const authArea = document.querySelector('.loginBtn');      // 登入按鈕區塊
  
      if (!userArea || !authArea) return; // 確保頁面上有這些元素才執行
  
      if (userId) {
        userArea.style.display = 'flex';
        authArea.style.display = 'none';
      } else {
        userArea.style.display = 'none';
        authArea.style.display = 'block';
      }
    }
  
    // 登出功能 (給組員參考：只要清空 localStorage 就是登出)
    window.logout = function() {
      localStorage.removeItem('userId');
      window.location.href = '/team.html';
    };
  
    document.addEventListener('DOMContentLoaded', syncAuthUI);
  })();


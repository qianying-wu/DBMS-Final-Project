// auth.js 負責登入/註冊畫面切換與 API 呼叫。
(function(){
  // 取得登入/註冊頁面需要操作的 DOM 元素。
  const qs = new URLSearchParams(location.search);
  const title = document.getElementById('title');
  const toLogin = document.getElementById('toLogin');
  const toRegister = document.getElementById('toRegister');
  const account = document.getElementById('account');
  const password = document.getElementById('password');
  const submit = document.getElementById('submit');
  const back = document.getElementById('back');
  const out = document.getElementById('out');
  const username = document.getElementById('username');
  const userEmail = document.getElementById('userEmail');

  // mode 控制目前畫面是登入或註冊。
  let mode = 'login';

  // 依照目前模式更新標題、按鈕文字、欄位顯示與分頁樣式。
  function render() {
    if (mode === 'login') {
      title.textContent = '歡迎回來';
      submit.textContent = '登入';
      toLogin.classList.add('active');
      toRegister.classList.remove('active');
      
      // 登入模式隱藏不需要的欄位
      username.classList.add('hide');
      userEmail.classList.add('hide');
    } else {
      title.textContent = '建立新帳號';
      submit.textContent = '註冊並登入';
      toLogin.classList.remove('active');
      toRegister.classList.add('active');
      
      // 註冊模式顯示完整欄位
      username.classList.remove('hide');
      userEmail.classList.remove('hide');
    }
    out.textContent = '';
  }

  // 監聽分頁切換按鈕
  toLogin.addEventListener('click', () => { mode = 'login'; render(); });
  toRegister.addEventListener('click', () => { mode = 'register'; render(); });

  // 處理返回首頁或重導向路徑
  function buildLoginTarget(userId) {
    const redirect = qs.get('redirect');
    if (redirect) {
      const url = new URL(redirect, location.origin);
      url.searchParams.set('userId', userId);
      return url.pathname + url.search;
    }
    return '/contests.html?userId=' + encodeURIComponent(userId);
  }

  back.addEventListener('click', () => {
    location.href = '/contests.html';
  });

  // 點擊送出按鈕時，驗證欄位並發送 POST 請求給後端 API。
  submit.addEventListener('click', async () => {
    const a = account.value.trim();
    const p = password.value.trim();
    const u = username.value.trim();
    const e = userEmail.value.trim();

    if (!a || !p) { out.textContent = '請填寫帳號與密碼'; return; }
    if (mode === 'register' && !u) { out.textContent = '註冊模式下請填寫暱稱'; return; }

    out.textContent = (mode === 'login') ? '正在登入中...' : '帳號建立中...';
    
    const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = { account: a, userName: u, userPsw: p, userEmail: e };

    try {
      const resp = await fetch(path, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const json = await resp.json().catch(() => ({}));

      if (resp.ok || json.ok) {
        if (json.token) {
          localStorage.setItem('token', json.token);
        }
        
        if (mode === 'login') {
          const id = json.userId || json.userId === 0 ? json.userId : '';
          localStorage.setItem('userId', id);
          out.style.color = '#2f7a44';
          out.textContent = '🎉 登入成功！正在導向首頁...';
          setTimeout(() => location.href = buildLoginTarget(id), 800);
        } else {
          mode = 'login'; 
          render();
          out.style.color = '#2f7a44';
          out.textContent = '✨ 註冊成功！請輸入密碼進行登入。';
        }
      } else {
        out.style.color = '#b64d45';
        out.textContent = json.error || json.message || '連線伺服器失敗，請稍後再試';
      }
    } catch (err) {
      out.style.color = '#b64d45';
      out.textContent = '伺服器維護中，已為您跳轉本地測試模式';
      // 測試環境 Fallback 處理

    }
  });

  // 初始渲染
  render();
})();

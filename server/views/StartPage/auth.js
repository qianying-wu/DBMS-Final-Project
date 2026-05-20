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
    title.textContent = (mode === 'login') ? '登入' : '註冊';
    submit.textContent = (mode === 'login') ? '登入' : '註冊';
    out.textContent = '';
      // update tab styles
      if (mode === 'login') {
        toLogin.classList.add('active'); toRegister.classList.remove('active');
        username.classList.add('hide'); userEmail.classList.add('hide');
      } else {
        toRegister.classList.add('active'); toLogin.classList.remove('active');
        username.classList.remove('hide'); userEmail.classList.remove('hide');
      }
  }

  // 切換登入/註冊模式與返回首頁。
  toLogin.addEventListener('click', () => { mode='login'; render(); });
  toRegister.addEventListener('click', () => { mode='register'; render(); });
  back.addEventListener('click', () => { window.location.href = '/startPage.html'; });

  // 送出登入或註冊請求，依模式呼叫不同 API。
  submit.addEventListener('click', async () => {
    const a = account.value; const p = password.value; const u = username.value; const e = userEmail.value;
    try {
      const path = mode === 'login' ? '/login' : '/register';      

      const resp = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ account: a, userName: u, userPsw: p, userEmail: e}) });
      const json = await resp.json().catch(()=>({}));
      if (resp.ok) {
        out.textContent = JSON.stringify(json, null, 2);
        if (mode === 'login') {
          // 登入成功後帶著 userId 進入使用者首頁。
          const id = json.userId || json.userId === 0 ? json.userId : '';
          const target = `/user.html?id=${id}`;
          setTimeout(()=> location.href = target, 500);
        } else {
          // 註冊成功後切回登入模式，讓使用者以新帳號登入。
          mode = 'login'; render();
          out.textContent += '\n註冊成功，請以新帳號登入';
        }

      } else {
        out.textContent = JSON.stringify({ status: resp.status, body: json }, null, 2);
      }
    } catch (err) { out.textContent = String(err); }
  });

  render();
})();

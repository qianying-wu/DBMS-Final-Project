// auth.js handles login/register UI and API calls
(function(){
  const qs = new URLSearchParams(location.search);
  const role = qs.get('role') || 'user';
  const title = document.getElementById('title');
  const toLogin = document.getElementById('toLogin');
  const toRegister = document.getElementById('toRegister');
  const username = document.getElementById('username');
  const password = document.getElementById('password');
  const submit = document.getElementById('submit');
  const back = document.getElementById('back');
  const out = document.getElementById('out');

  let mode = 'login';

  function render() {
    title.textContent = (mode === 'login') ? '登入' : '註冊';
    submit.textContent = (mode === 'login') ? '登入' : '註冊';
    out.textContent = '';
      // update tab styles
      if (mode === 'login') {
        toLogin.classList.add('active'); toRegister.classList.remove('active');
      } else {
        toRegister.classList.add('active'); toLogin.classList.remove('active');
      }
  }

  toLogin.addEventListener('click', () => { mode='login'; render(); });
  toRegister.addEventListener('click', () => { mode='register'; render(); });
  back.addEventListener('click', () => { window.location.href = '/startPage.html'; });

  submit.addEventListener('click', async () => {
    const u = username.value; const p = password.value;
    if (!u || !p) { out.textContent = '請填入 username/password'; return; }
    try {
      const path = mode === 'login' ? '/login' : '/register';
      const resp = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: u, password: p, role }) });
      const json = await resp.json().catch(()=>({}));
      if (resp.ok) {
        out.textContent = JSON.stringify(json, null, 2);
        if (mode === 'login') {
          // redirect to role page with userId
          const id = json.userId || json.userId === 0 ? json.userId : '';
          const target = (role === 'maintenance') ? `/maintenance.html?userId=${encodeURIComponent(id)}` : `/user.html?userId=${encodeURIComponent(id)}`;
          setTimeout(()=> location.href = target, 500);
        } else {
          // after successful register (stub) switch to login mode
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

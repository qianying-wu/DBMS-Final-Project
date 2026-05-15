// auth.js handles login/register UI and API calls
(function(){
  const qs = new URLSearchParams(location.search);
  const title = document.getElementById('title');
  const toLogin = document.getElementById('toLogin');
  const toRegister = document.getElementById('toRegister');
  const account = document.getElementById('account');
  const password = document.getElementById('password');
  const submit = document.getElementById('submit');
  const out = document.getElementById('out');
  const username = document.getElementById('username');
  const userEmail = document.getElementById('userEmail');


  let mode = 'login';

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

  toLogin.addEventListener('click', () => { mode='login'; render(); });
  toRegister.addEventListener('click', () => { mode='register'; render(); });

  submit.addEventListener('click', async () => {
    const a = account.value; const p = password.value; const u = username.value; const e = userEmail.value;
    try {
      const path = mode === 'login' ? '/login' : '/register';      

      const resp = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ account: a, userName: u, userPsw: p, userEmail: e}) });
      const json = await resp.json().catch(()=>({}));
      if (resp.ok) {
        out.textContent = JSON.stringify(json, null, 2);
        if (mode === 'login') {
          // redirect to role page with userId
          const id = json.userId || json.userId === 0 ? json.userId : '';
          localStorage.setItem('userId', id);
          const target = `/team.html?id=${id}`;
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

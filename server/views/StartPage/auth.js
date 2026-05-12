// auth.js handles login/register UI and API calls
(function(){
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
  back.addEventListener('click', () => { window.location.href = '/startPage.html'; });

  submit.addEventListener('click', async () => {
    const u = account.value; const p = password.value;
    if (!u || !p) { out.textContent = '請填寫完整！'; return; }
    try {
      const path = mode === 'login' ? '/login' : '/register';      
       const body = (mode === 'login')
         ? { account: u, password: p }
         : { account: u, password: p, displayName: username.value || '', email: userEmail.value || '' };
       const resp = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const json = await resp.json().catch(()=>({}));
      if (resp.ok) {
        out.textContent = JSON.stringify(json, null, 2);
        // on success (both login and register) redirect to competition main page
        const id = (typeof json.userId !== 'undefined') ? json.userId : '';
        // give user a tiny pause so they see the response, then redirect
        setTimeout(() => {
          const dest = '/team.html' + (id !== '' ? '?userId=' + encodeURIComponent(id) : '');
          location.href = dest;
        }, 500);
        return;
      } else {
        out.textContent = JSON.stringify({ status: resp.status, body: json }, null, 2);
      }
    } catch (err) { out.textContent = String(err); }
  });

  render();
})();

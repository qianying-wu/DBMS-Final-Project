// ==========================================
// 1. 全域變數與網址參數解析
// ==========================================
const qs = new URLSearchParams(location.search);
const userId = qs.get('userId') || 'unknown';
const resumeId = qs.get('resumeId'); // 從網址列獲取要看哪一份 resumeId

// 自動修正 Logo 連結
if (document.querySelector('.logo-link')) {
  document.querySelector('.logo-link').href = '/team.html?userId=' + encodeURIComponent(userId);
}

// 取得與 profile.js 完全相同的 Token 驗證標頭
function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `${token}` } : {};
}

// XSS 防禦：跳脫 HTML 特殊字元
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

// ==========================================
// 2. 主力函數：對齊 `/api/pv/loadPV` 撈取資料庫資料
// ==========================================
async function loadProfile() {
  try {
    const path = '/api/pv/loadPV';
    // 發送與 profile.js 完全相同的 fetch 請求（帶有 Token）
    const response = await fetch(path, { headers: { ...getAuthHeader() } });

    if (!response.ok) throw new Error('無法取得履歷資料');

    const existProfiles = await response.json(); // 這是一個履歷陣列

    // 從陣列中，撈出 id 與網址列傳進來的 `resumeId` 相同的特定履歷
    // 如果網址沒傳，預設撈第一份 (existProfiles[0])
    const profile = existProfiles.find(x => String(x.id) === String(resumeId)) || existProfiles[0] || null;

    console.log("=== 【DEBUG】從後端撈到的特定履歷整筆資料 ===", profile); // 👈 加這一行
    if (profile && profile.data) {
      if (!profile.data.tags && profile.tags) {
        profile.data.tags = profile.tags;
      }
      renderResume(profile.data);
    } else {
      renderEmpty();
    }
  } catch (error) {
    console.error("載入履歷失敗，顯示空狀態:", error);
    renderEmpty();
  }
}

// ==========================================
// 3. 渲染畫面函數 (Render)
// ==========================================
function renderResume(data) {
  const resumeViewEl = document.getElementById('resumeView');
  if (!resumeViewEl) return;

  // 根據另一份檔案的對應：
  // 名字是 data.user_pv_name、學校是 data.school、年級是 data.grade、自介是 data.intro
  resumeViewEl.innerHTML = `
    <div class="resume-template-head" style="background: linear-gradient(135deg, #fffcf7 0%, #fcf7f0 100%); padding: 36px 40px; display: flex; gap: 28px; align-items: center;">
      <div class="resume-avatar" style="width: 90px; height: 90px; border-radius: 50%; background: #f3ede4; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); flex-shrink: 0;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a17851" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <div style="flex: 1;">
        <h3 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 800; color: #3f342c;">
          ${data.user_pv_name ? esc(data.user_pv_name) : '<span class="no-data" style="color: #b1a79b; font-weight: 400; font-style: italic;">未填寫姓名</span>'}
        </h3>
        <p style="margin: 0; color: #7b6a59; font-size: 15px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path></svg>
          ${data.school ? esc(data.school) : '<span class="no-data" style="color: #b1a79b;">未填寫學校</span>'} 
          ${data.grade ? `<span style="color: #7b6a59; font-weight: 500; margin-left: 2px;">${esc(data.grade)}</span>` : ''}
        </p>
      </div>
    </div>

    <div style="padding: 40px; display: flex; flex-direction: column; gap: 32px; background: #fff;">
      
      <section class="view-section">
        <h4 style="margin: 0 0 14px 0; font-size: 15px; color: #a17851; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 700; border-left: 3px solid #d4b188; padding-left: 10px;">專業技能 / 專長</h4>
        <div class="template-tags" style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${(data.tags || []).length ? data.tags.map(tag => `<span style="background: #fbf6ef; border: 1px solid #efe1cf; color: #5d4937; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: 600;">${esc(tag)}</span>`).join('') : '<p class="no-data" style="color: #b1a79b; margin: 0; font-size: 14px; font-style: italic;">暫無填寫專長技能</p>'}
        </div>
      </section>

      <section class="view-section">
        <h4 style="margin: 0 0 14px 0; font-size: 15px; color: #a17851; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 700; border-left: 3px solid #d4b188; padding-left: 10px;">自我介紹</h4>
        <div style="padding: 4px 12px;">
          ${data.intro ? `<p style="margin:0; color: #332d28; line-height: 1.8; font-size: 15px; white-space: pre-line;">${esc(data.intro)}</p>` : '<p class="no-data" style="color: #b1a79b; margin: 0; font-size: 14px; font-style: italic;">尚未填寫自我介紹...</p>'}
        </div>
      </section>

    </div>
  `;
}

// 查無資料時顯示的畫面
function renderEmpty() {
  const resumeViewEl = document.getElementById('resumeView');
  if (resumeViewEl) {
    resumeViewEl.innerHTML = '<div class="empty-note" style="padding: 40px; text-align: center; color: #b1a79b;">尚未建立履歷檔案</div>';
  }
}

// ==========================================
// 4. 初始化執行與事件綁定
// ==========================================
// 網頁載入後打 API 撈資料並渲染
loadProfile();

// 返回上一頁按鈕邏輯
const backBtn = document.getElementById('backBtnResume');
if (backBtn) {
  backBtn.addEventListener('click', function () {
    window.location.href = '/profile.html';
  });
}


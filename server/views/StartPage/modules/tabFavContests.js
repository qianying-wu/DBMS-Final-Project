import * as Data from '../team-data.js';

export async function render(gridContainer, allContestsData, setAllContestsData) {
  const currentToken = localStorage.getItem('token');
  if (!currentToken) {
    gridContainer.innerHTML = `<div class="empty-text">請先登入以查看收藏比賽。</div>`;
    return;
  }

  // 輔助函式：確保帶上標準的 Bearer 前綴
  function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `${token}` } : {};
  }

  gridContainer.innerHTML = `<div class="empty-text">正在載入收藏比賽...</div>`;

  try {
    // 🚀 1. 戳你寫好、有 JOIN 雙表聯查的保護 API 入口
    const res = await fetch('/api/contests/getFavorites', {
      method: 'GET',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) throw new Error('伺服器回應錯誤');

    const resResult = await res.json();

    // 🚀 2. 直接拿到 Controller 幫你打包好的完整比賽卡片資料
    const favContests = resResult.data || [];

    if (favContests.length === 0) {
      gridContainer.innerHTML = `<div class="empty-text">目前暫無收藏的比賽。快去首頁逛逛吧！</div>`;
      return;
    }

    // 🚀 3. 直接對齊你 SQL 查出來的欄位（c.com_id, c.com_name, c.com_intro）
    gridContainer.innerHTML = favContests.map(c => {
      const cId = c.com_id;
      const cName = c.com_name || '未命名比賽';
      const cIntro = c.com_intro || '尚未填寫比賽說明';

      return `
        <div class="team-manage-card" style="border-left: 4px solid #caa77a;">
            <div class="card-top">
              <h3 class="team-title" style="margin-top: 5px;">${Data.escapeHtml(cName)}</h3>
            </div>
            <div class="card-mid">
                <div class="info-row">
                  <span class="label">簡介：</span>
                  <span class="val" style="font-weight:400; color:#666;">${Data.escapeHtml(cIntro.substring(0, 50))}...</span>
                </div>
            </div>
            <div class="card-bottom">
              <button class="btn-contest-action" data-contest-id="${cId}" style="width: 100%; background-color: #caa77a; color: white; border: none; padding: 10px 0; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer;">
                前往比賽詳情 →
              </button>
            </div>
        </div>
      `;
    }).join('');

    // 4. 綁定「前往比賽詳情」點擊事件
    gridContainer.querySelectorAll('.btn-contest-action').forEach(btn => {
      btn.addEventListener('click', () => {
        location.href = Data.withUserParam(`/contest.html?id=${btn.dataset.contestId}`);
      });
    });

  } catch (error) {
    console.error('❌ 模組載入比賽收藏清單失敗:', error);
    gridContainer.innerHTML = '<div class="empty-text" style="color:red;">無法載入收藏清單，請稍後再試。</div>';
  }
}
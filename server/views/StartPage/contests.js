// 取得 DOM 元素的簡寫工具函式，方便後續快速抓取 ID
const $ = id => document.getElementById(id);

// 🚀 修正 1：只保留一個全域變數，存放後端撈回來的「全部比賽原始資料」
let contests = [];

// 將字串轉成安全 HTML，避免資料庫文字影響頁面結構。
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

// 導頁時保留目前登入使用者的 userId。
function withUserParam(path) {
  const userId = new URLSearchParams(location.search).get('userId') || localStorage.getItem('userId');
  return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
}

// 從後端讀取資料庫 Competition 表的全部比賽。
async function loadContests() {
  try {
    const res = await fetch('/api/contests/competitions');
    if (!res.ok) throw new Error('無法取得比賽資料');
    const result = await res.json();
    
    // 🚀 修正 2：拿掉 const，直接把資料指定給全域變數 contests！
    contests = result.competitions || result;
    console.log('成功載入比賽資料：', contests);
    
    return contests; // 確保後續的 .then(applyFilters) 沒拿到空東西
  } catch (err) {
    console.error('讀取比賽失敗:', err);
    contests = [];
    return [];
  }
}

// 依照比賽名稱與說明做簡單分類，維持原本頁面上的分類篩選體驗。
function inferCategory(contest) {
  const text = `${contest.com_name || ''} ${contest.com_intro || ''}`.toLowerCase();
  if (text.includes('ai') || text.includes('資料') || text.includes('機器') || text.includes('智慧')) return 'AI';
  if (text.includes('設計') || text.includes('創意') || text.includes('黑客松')) return 'Design';
  if (text.includes('商業') || text.includes('創業') || text.includes('金融')) return 'Business';
  return 'Other';
}

function categoryLabel(category) {
  return {
    AI: '人工智慧',
    Design: '設計與創意',
    Business: '商業競賽',
    Other: '其他'
  }[category] || category;
}


// 核心渲染函式：負責將比賽資料陣列轉換成 HTML 卡片。
function renderContests(dataList = []) {
  const grid = $('contestsGrid');
  if (!grid) return;

  grid.innerHTML = dataList.length ? dataList.map(contest => {
    const category = inferCategory(contest);

    const displayDate = (contest.com_date && contest.com_date.includes('T')) 
                        ? contest.com_date.split('T')[0] 
                        : contest.com_date;
                        
    return `
      <article class="contest-card" data-id="${contest.com_id}">
        <div class="card-tag">${categoryLabel(category)}</div>
        <h3>${escapeHtml(contest.com_name)}</h3>
        <p class="category">分類：${categoryLabel(category)}</p>
        <p class="desc">${escapeHtml(contest.com_intro || '尚未填寫比賽說明')}</p>
        <div class="card-footer">
          <span>${escapeHtml(/*contest.com_date*/displayDate || '日期未定')}</span>
          <span class="more-link">查看更多 →</span>
        </div>
      </article>
    `;
  }).join('') : '<div class="empty-note">目前資料庫沒有可瀏覽的比賽。</div>';
}

// 🚀 修正 3：把原本被你封印的篩選功能復活！並且對齊全域變數 contests
function applyFilters() {
  const q = $('contestSearch')?.value.trim().toLowerCase() || '';
  const category = $('categoryFilter')?.value || 'all';
  
  // 根據搜尋關鍵字與下拉選單分類，去過濾全域變數 contests
  const filtered = contests.filter(contest => {
    const matchedText = `${contest.com_name || ''} ${contest.com_intro || ''}`.toLowerCase().includes(q);
    const matchedCategory = category === 'all' || inferCategory(contest) === category;
    return matchedText && matchedCategory;
  });
  
  // 將篩選後的乾淨資料餵給渲染函式
  renderContests(filtered);
}

// 監聽搜尋與分類
$('contestSearch')?.addEventListener('input', applyFilters);
$('categoryFilter')?.addEventListener('change', applyFilters);

// 點擊卡片跳轉詳情
$('contestsGrid')?.addEventListener('click', event => {
  const card = event.target.closest('[data-id]');
  if (!card) return;
  location.href = withUserParam(`/contest.html?id=${encodeURIComponent(card.dataset.id)}`);
});

const homeLink = $('homeLink');
if (homeLink) homeLink.href = withUserParam('/contests.html');

// 頁面初始載入時，先從後端讀取資料庫，再執行篩選渲染。
document.addEventListener('DOMContentLoaded', () => {
  loadContests().then(applyFilters);
});


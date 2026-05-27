// 取得 DOM 元素的簡寫工具函式，方便後續快速抓取 ID
const $ = id => document.getElementById(id);

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
    const res = await fetch('/competitions');
    if (!res.ok) throw new Error('無法取得比賽資料');
    const data = await res.json();
    contests = data.competitions || [];
  } catch (err) {
    console.error(err);
    contests = [];
  }
}

// 依照比賽名稱與說明做簡單分類，維持原本頁面上的分類篩選體驗。
function inferCategory(contest) {
  const text = `${contest.name || ''} ${contest.info || ''}`.toLowerCase();
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

// 產生目前比賽列表中每個分類的數量
function computeCategoryCounts(list) {
  const counts = {};
  (list || []).forEach(c => {
    const key = inferCategory(c) || 'Other';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

// 核心渲染函式：負責將資料庫比賽轉換成 HTML 卡片並呈現在畫面上。
function renderContests(data) {
  const grid = $('contestsGrid');
  if (!grid) return;

  grid.innerHTML = data.length ? data.map(contest => {
    const category = inferCategory(contest);
    return `
      <article class="contest-card" data-id="${contest.id}">
        <div class="card-tag">${categoryLabel(category)}</div>
        <h3>${escapeHtml(contest.name)}</h3>
        <p class="category">分類：${categoryLabel(category)}</p>
        <p class="desc">${escapeHtml(contest.info || '尚未填寫比賽說明')}</p>
        <div class="card-footer">
          <span>${escapeHtml(contest.date || '日期未定')}</span>
          <span class="more-link">查看更多 →</span>
        </div>
      </article>
    `;
  }).join('') : '<div class="empty-note">目前資料庫沒有可瀏覽的比賽。</div>';
}

// 依照搜尋關鍵字與分類篩選重新顯示比賽。
function applyFilters() {
  const q = $('contestSearch')?.value.trim().toLowerCase() || '';
  const category = $('categoryFilter')?.value || 'all';
  const filtered = contests.filter(contest => {
    const matchedText = `${contest.name || ''} ${contest.info || ''}`.toLowerCase().includes(q);
    const matchedCategory = category === 'all' || inferCategory(contest) === category;
    return matchedText && matchedCategory;
  });
  renderContests(filtered);
}

$('contestSearch')?.addEventListener('input', applyFilters);
$('categoryFilter')?.addEventListener('change', applyFilters);

$('contestsGrid')?.addEventListener('click', event => {
  const card = event.target.closest('[data-id]');
  if (!card) return;
  location.href = withUserParam(`/contest.html?id=${encodeURIComponent(card.dataset.id)}`);
});

const homeLink = $('homeLink');
if (homeLink) homeLink.href = withUserParam('/team.html');

// 頁面初始載入時，先讀取資料庫，再顯示所有比賽，並建立分類下拉的動態選單。
// 頁面初始載入時，先讀取資料庫，再顯示所有比賽。
loadContests().then(applyFilters);

// 取得 DOM 元素的簡寫工具函式，方便後續快速抓取 ID
const $ = id => document.getElementById(id);

// 模擬的競賽資料陣列（假資料），包含比賽的基本資訊與標籤
const mockContests = [
  { id: 10, name: '全國資料科學競賽', category: 'AI', date: '2026-07-20', shortDesc: '針對資料科學專題的校內外競賽。', tag: '熱門' },
  { id: 11, name: '全國機器人盃', category: 'Design', date: '2026-09-10', shortDesc: '實作機器人並進行對抗賽。', tag: '推薦' },
  { id: 12, name: '創業創新黑客松', category: 'Business', date: '2026-10-05', shortDesc: '48小時內提出商業解決方案。', tag: '新賽事' }
];

// 核心渲染函式：負責將傳入的資料陣列 (data) 轉換成 HTML 卡片結構並呈現在畫面上
function renderContests(data) {
  const grid = $('contestsGrid');
  // 使用 map 產生每個比賽的 HTML 字串，並用 join('') 合併後塞入網格容器中
  grid.innerHTML = data.map(c => `
    <div class="contest-card" onclick="location.href='contests-detail.html?id=${c.id}'">
      <div class="card-tag">${c.tag}</div>
      <h3>${c.name}</h3>
      <p class="category">分類：${c.category}</p>
      <p class="desc">${c.shortDesc}</p>
      <div class="card-footer">
        <span>📅 ${c.date}</span>
        <span class="more-link">查看更多 →</span>
      </div>
    </div>
  `).join('');
}

// 簡易搜尋過濾功能：監聽搜尋框的輸入事件
$('contestSearch').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase(); // 取得使用者輸入的值並轉為小寫
  // 比對比賽名稱，若包含輸入的關鍵字則保留
  const filtered = mockContests.filter(c => c.name.toLowerCase().includes(q));
  // 重新渲染過濾後的結果
  renderContests(filtered);
});

// 頁面初始載入時，執行第一次渲染，顯示所有比賽
renderContests(mockContests);
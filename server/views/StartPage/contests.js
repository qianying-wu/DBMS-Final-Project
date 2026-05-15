const $ = id => document.getElementById(id);

const mockContests = [
  { id: 10, name: '全國資料科學競賽', category: 'AI', date: '2026-07-20', shortDesc: '針對資料科學專題的校內外競賽。', tag: '熱門' },
  { id: 11, name: '全國機器人盃', category: 'Design', date: '2026-09-10', shortDesc: '實作機器人並進行對抗賽。', tag: '推薦' },
  { id: 12, name: '創業創新黑客松', category: 'Business', date: '2026-10-05', shortDesc: '48小時內提出商業解決方案。', tag: '新賽事' }
];

function renderContests(data) {
  const grid = $('contestsGrid');
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

// 簡易搜尋過濾
$('contestSearch').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = mockContests.filter(c => c.name.toLowerCase().includes(q));
  renderContests(filtered);
});

renderContests(mockContests);
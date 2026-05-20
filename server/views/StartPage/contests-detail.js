(function() {
  const $ = id => document.getElementById(id);

  // 1. 從網址取得比賽 ID (例如: contest-detail.html?id=10)
  const urlParams = new URLSearchParams(window.location.search);
  const contestId = Number(urlParams.get('id'));

  // 2. 取得比賽資料 (優先從 localStorage 拿，跟你的 team.js 同步)
  function loadContests() {
    const raw = localStorage.getItem('contests');
    if (raw) return JSON.parse(raw);
    
    // 如果 localStorage 是空的，預備一組預設資料
    return [
      { id: 10, name: '全國資料科學競賽', category: 'AI', date: '2026-07-20', info: '針對資料科學專題的校內外隊伍競賽，重點在於數據分析與機器學習的應用。', rules: '1. 每隊 3-4 人。\n2. 需繳交計畫書與程式碼。\n3. 決賽需進行現場簡報。' },
      { id: 11, name: '全國機器人盃', category: 'Design', date: '2026-09-10', info: '機器人實作與競賽，挑戰自動化控制與機構設計。', rules: '1. 需自備機器人硬體。\n2. 需符合尺寸規定。' },
      { id: 12, name: '創業創新黑客松', category: 'Business', date: '2026-10-05', info: '48小時內提出商業解決方案。', rules: '1. 限大專院校學生參加。' }
    ];
  }

  // 3. 渲染頁面內容
  function renderDetail() {
    const contests = loadContests();
    const contest = contests.find(c => c.id === contestId);

    if (!contest) {
      alert('找不到該比賽資訊！');
      location.href = 'contests.html';
      return;
    }

    // 替換標題與基本資訊
    $('cd-title').textContent = contest.name;
    $('cd-category').textContent = contest.category || '一般競賽';
    $('cd-date').textContent = `📅 比賽日期：${contest.date}`;
    $('contestInfo').textContent = contest.info;
    $('contestRules').textContent = contest.rules || '請參考官方公告之詳細規則。';

    // 模擬一個時間軸資料
    const timeline = [
      { date: '2026-05-01', event: '開放報名' },
      { date: '2026-06-15', event: '初賽資料截止' },
      { date: contest.date, event: '決賽與評審' }
    ];

    $('timelineList').innerHTML = timeline.map(item => `
      <li>
        <span class="timeline-date">${item.date}</span>
        <span class="timeline-event">${item.event}</span>
      </li>
    `).join('');

    // 4. 按鈕功能：點擊後去 team.html 並自動篩選這場比賽的隊伍
    $('goToTeamBtn').onclick = () => {
      // 這裡你可以搭配 localStorage 把選擇的比賽存起來
      localStorage.setItem('selectedContest', contestId);
      location.href = 'team.html'; 
    };
  }

  renderDetail();
})();
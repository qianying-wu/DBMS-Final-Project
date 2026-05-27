import { currentUserId, withUserParam, escapeHtml } from './team-data.js';

(function() {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const currentTeamId = Number(params.get('teamId') || params.get('id'));
  
  // 統一使用 team-data 規範的使用者資訊
  const ME = { id: currentUserId, name: '你自己' };

  // 1. 渲染隊伍詳細資訊
  function renderTeamInfo() {
    // 從本地快取中撈取所有隊伍與競賽資料
    const teams = JSON.parse(localStorage.getItem('teams') || '[]');
    const contests = JSON.parse(localStorage.getItem('contests') || '[]');
    
    const team = teams.find(t => Number(t.id) === currentTeamId);
    if (!team) {
      alert('找不到該隊伍資訊！');
      history.back();
      return;
    }

    const contest = contests.find(c => Number(c.id) === Number(team.contestId));

    // 填入前端畫面元素
    $('teamName').textContent = team.name;
    $('teamDesc').textContent = team.desc || '無詳細描述';
    $('currentMembers').textContent = team.members || 1;
    $('maxSlots').textContent = team.slots || 4;

    if (contest) {
      $('contestName').textContent = contest.name;
      $('contestDate').textContent = contest.date || '未定';
      $('contestInfo').textContent = contest.info || '';
      if (contest.officialUrl) {
        $('contestLink').href = contest.officialUrl;
        $('contestLink').style.display = 'inline-block';
      }
    }
  }

  // 2. 綁定事件處理器
  function setupEventListeners() {
    // 點擊「我要申請」顯示申請表單
    $('applyBtn').addEventListener('click', () => {
      $('applyForm').style.display = 'block';
      $('actionButtons').style.display = 'none';
    });

    // 點擊「取消」隱藏申請表單
    $('cancelApplyBtn').addEventListener('click', () => {
      $('applyForm').style.display = 'none';
      $('actionButtons').style.display = 'flex';
    });

    // 處理送出申請表單
    $('teamApplyForm').addEventListener('submit', (e) => {
      e.preventDefault();

      // 模擬將申請需求送入通知系統中
      const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
      notifications.push({
        id: Date.now(),
        type: 'team-request',
        title: '新加入申請',
        message: `${ME.name} 申請加入你的隊伍`,
        action: { type: 'review-request', teamId: currentTeamId }
      });
      localStorage.setItem('notifications', JSON.stringify(notifications));

      alert('已送出加入申請！隊長審核後會發送通知。');
      $('applyForm').style.display = 'none';
      $('actionButtons').style.display = 'flex';
      $('applyBtn').textContent = '審核中...';
      $('applyBtn').disabled = true;
    });

    $('contactBtn').addEventListener('click', () => { alert('聯絡功能開發中'); });
    $('backBtn').addEventListener('click', () => { history.back(); });
    
    // 修正 Logo 導回首頁帶有身分識別
    document.querySelector('.logo-link')?.setAttribute('href', withUserParam('/team.html'));
  }

  // 3. 執行初始化
  renderTeamInfo();
  setupEventListeners();
})();
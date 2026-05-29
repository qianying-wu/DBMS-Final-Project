(function(){
  const $ = id => document.getElementById(id);
  const container = $('applicationsList');

  // 工具函式：跳脫字元，防止 XSS 攻擊
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  // 1. 從後端載入申請資料
  async function loadApplications() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('請先登入！');
        return [];
      }

      // 換成後端撈取申請名單的 API 路徑
      const path = '/api/teams/applications'; 
      const response = await fetch(path, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('無法取得資料');
      const data = await response.json();
      return data; 
      
    } catch (error) {
      console.error('❌ 載入申請資料失敗:', error);
      return []; 
    }
  }

  // 2. 渲染卡片畫面
  async function render() {
    const applications = await loadApplications();

    if (applications.length === 0) {
      container.innerHTML = '<div class="empty-state">目前沒有任何待審核的申請喔！</div>';
      return;
    }

    container.innerHTML = applications.map(app => `
      <div class="application-card" id="appCard-${app.apply_id}">
        <div class="applicant-info">
          <div class="applicant-header">
            <h2 class="applicant-name">${escapeHtml(app.user_name || '未知使用者')}</h2>
            <span class="apply-target">申請加入：${escapeHtml(app.team_name)}</span>
          </div>
          <div class="applicant-message">
            <strong>留言：</strong><br>
            ${escapeHtml(app.message || '沒有留下訊息')}
          </div>
        </div>
        <div class="action-group">
          <button class="btn primary btn-approve" data-id="${app.apply_id}">同意</button>
          <button class="btn outline btn-reject" data-id="${app.apply_id}">拒絕</button>
        </div>
      </div>
    `).join('');
  }

  // 3. 處理「同意 / 拒絕」的 API 呼叫
  async function handleApplication(applyId, action) {
    const token = localStorage.getItem('token');
    
    const endpoint = action === 'approve' 
      ? `/api/teams/applications/${applyId}/approve`
      : `/api/teams/applications/${applyId}/reject`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST', 
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('操作失敗');
      
      const result = await response.json();
      if (result.success) {
        const card = $(`appCard-${applyId}`);
        if (card) {
          card.style.opacity = '0';
          setTimeout(() => card.remove(), 300);
        }
        
        if (document.querySelectorAll('.application-card').length === 1) {
          setTimeout(() => render(), 300);
        }
      } else {
        alert(result.message || '處理失敗，請稍後再試');
      }
    } catch (error) {
      console.error(`❌ ${action} 失敗:`, error);
      alert('伺服器連線異常');
    }
  }

  // 4. 統一監聽按鈕點擊 (Event Delegation)
  container.addEventListener('click', (e) => {
    if (e.target.closest('.btn-approve')) {
      const id = e.target.closest('.btn-approve').dataset.id;
      if(confirm('確定要「同意」這個申請嗎？')) {
        handleApplication(id, 'approve');
      }
    }
    
    if (e.target.closest('.btn-reject')) {
      const id = e.target.closest('.btn-reject').dataset.id;
      if(confirm('確定要「拒絕」這個申請嗎？')) {
        handleApplication(id, 'reject');
      }
    }
  });

  // 綁定返回按鈕
  $('backBtn').addEventListener('click', () => { location.href = '/team.html'; });

  // 啟動頁面
  render();

})();
import * as Data from '../team-data.js'; //

export async function render(gridContainer, token, userId) { //[cite: 5]
  // 1. 純前端直接從 localStorage 抓取被標記為 'completed' 的歷史隊伍[cite: 5]
  const historyTeams = JSON.parse(localStorage.getItem('local_history_teams') || '[]'); //[cite: 5]

  if (historyTeams.length === 0) { //[cite: 5]
    gridContainer.innerHTML = `<div class="empty-text">目前沒有已完賽的歷史紀錄隊伍。</div>`; //[cite: 5]
    return; //[cite: 5]
  } //[cite: 5]

  // 渲染歷史隊伍卡片列表，並動態加上一個隱藏的「隊友名單彈窗」HTML[cite: 5]
  gridContainer.innerHTML = `
    ${historyTeams.map(t => { //[cite: 5]
      const teamId = t.team_id; //[cite: 5]
      const teamName = t.team_name || '未命名隊伍'; //[cite: 5]
      const contestName = t.com_name || '未指定特定競賽'; //[cite: 5]

      return `
        <div class="team-manage-card" style="border-left: 4px solid #caa77a; margin-bottom: 20px; position: relative;">
            <div class="card-top" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <h3 class="team-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #4f3827;">${Data.escapeHtml(teamName)}</h3>
              <span style="font-size: 11px; font-weight: 700; background: #fbf4e7; color: #b08953; border: 1px solid #f3e3cc; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; letter-spacing: 0.5px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" /><path d="M12 2a6 6 0 0 1 6 6v3.5c0 1.62-1.03 3-2.45 3.55L12 17l-3.55-1.95A4 4 0 0 1 6 11.5V8a6 6 0 0 1 6-6z" /></svg>
                已完賽
              </span>
            </div>
            <div class="card-mid" style="border-top: 1px solid #fcfaf7; padding-top: 12px; margin-bottom: 18px;">
                <div class="info-row" style="display: flex; font-size: 13.5px;"><span class="label" style="color: #8a735e; min-width: 70px;">競賽項目：</span><span class="val" style="color: #4f3827; font-weight: 600;">${Data.escapeHtml(contestName)}</span></div>
            </div>
            <div class="card-bottom">
                <button class="btn-manage-action review-teammate-btn" data-team-id="${teamId}" data-team-name="${Data.escapeHtml(teamName)}" style="width: 100%; background: #ffffff; border: 1px solid #caa77a; color: #caa77a; padding: 11px 0; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 8px;">
                   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                   評價此隊伍成員
                </button>
            </div>
        </div>
      `;
    }).join('')}

    <!-- 高質感評價彈出視窗 -->
    <div id="historyMembersModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(79, 56, 39, 0.4); backdrop-filter: blur(4px); z-index:9999; align-items:center; justify-content:center; animation: fadeIn 0.2s ease-out;">
      <div style="background:#ffffff; padding:32px; border-radius:16px; width:90%; max-width:460px; box-shadow:0 20px 40px rgba(79, 56, 39, 0.15); border: 1px solid #eadfd2; color:#4f3827; max-height: 80vh; display: flex; flex-direction: column;">
        <h3 id="historyModalTitle" style="margin:0 0 8px 0; border-bottom:1px solid #f0ebe5; padding-bottom:14px; font-size:18px; font-weight:800; display:flex; align-items:center; gap:10px;">隊友評價名單</h3>
        
        <div id="historyMembersList" style="display:flex; flex-direction:column; gap:12px; margin:20px 0; overflow-y: auto; flex: 1; padding-right: 4px;">
          <!-- 這裡會動態載入組員名單 -->
        </div>
        
        <div style="display:flex; justify-content:end; border-top: 1px solid #f0ebe5; padding-top: 16px;">
          <button id="btnCloseHistoryModal" type="button" style="padding:10px 20px; background:#ffffff; border:1px solid #d6c2ad; color:#8a7a6e; border-radius:10px; cursor:pointer; font-weight:600; font-size:14px; transition:all 0.2s ease;">關閉</button>
        </div>
      </div>
    </div>
  `; //[cite: 5]

  const modal = gridContainer.querySelector('#historyMembersModal'); //[cite: 5]
  const modalTitle = gridContainer.querySelector('#historyModalTitle'); //[cite: 5]
  const membersListContainer = gridContainer.querySelector('#historyMembersList'); //[cite: 5]

  // 關閉視窗事件[cite: 5]
  gridContainer.querySelector('#btnCloseHistoryModal').addEventListener('click', () => { //[cite: 5]
    modal.style.display = 'none'; //[cite: 5]
  }); //[cite: 5]

  // 點擊「評價此隊伍成員」[cite: 5]
  gridContainer.querySelectorAll('.review-teammate-btn').forEach(btn => { //[cite: 5]
    btn.addEventListener('click', async () => { //[cite: 5]
      const teamId = btn.dataset.teamId; //[cite: 5]
      const teamName = btn.dataset.teamName; //[cite: 5]

      modalTitle.innerHTML = `
        <div class="title-icon" style="width:32px; height:32px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; color:#ffffff; background:#caa77a; box-shadow:0 6px 14px rgba(202, 167, 122, 0.25); flex-shrink: 0;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">評價 ${Data.escapeHtml(teamName)} 的隊友</span>
      `; //[cite: 5]
      membersListContainer.innerHTML = '<p style="color:#8a735e; font-size:13.5px; text-align:center; padding: 20px 0;">🔍 正在載入成員名單...</p>'; //[cite: 5]
      modal.style.display = 'flex'; //[cite: 5]

      try {
        // 🚀 關鍵：呼叫組員原有的 /api/teams/detail 拿名單，不需要自己寫後端[cite: 5]
        const response = await fetch(`/api/teams/detail?teamId=${teamId}`, { //[cite: 5]
          headers: { 'Authorization': ` ${token}` } //[cite: 5]
        }); //[cite: 5]

        if (!response.ok) throw new Error('無法取得隊伍成員'); //[cite: 5]
        const result = await response.json(); //[cite: 5]
        
        // 抓出成員陣列 (相容你們資料庫的格式 rows.members 或 result.members)[cite: 5]
        const members = result.members || []; //[cite: 5]

        // 過濾掉目前登入者自己（因為不能自己評價自己）[cite: 5]
        const teammates = members.filter(m => String(m.user_id) !== String(userId)); //[cite: 5]

        if (teammates.length === 0) { //[cite: 5]
          membersListContainer.innerHTML = '<p style="color:#8a735e; font-size:13.5px; text-align:center; padding: 20px 0;">🎉 此隊伍目前沒有其他隊友可供評價。</p>'; //[cite: 5]
          return; //[cite: 5]
        }

        // 渲染隊友名單，並直接附帶「前往評價」的超連結連結到 review.html[cite: 5]
        membersListContainer.innerHTML = teammates.map(member => { //[cite: 5]
          const mUserId = member.user_id; //[cite: 5]
          const mName = member.user_name || member.applicantName || `未命名用戶(${mUserId})`; //[cite: 5]
          
          // 串接至你們原本的 review.html，並帶入對應的參數[cite: 5]
          const reviewUrl = `/review.html?targetUserId=${mUserId}&teamId=${teamId}&teamName=${encodeURIComponent(teamName)}&userId=${userId}`; //[cite: 5]

          return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:#fbf9f6; border:1px solid #eadfd2; border-radius:10px; transition: all 0.2s ease;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 36px; height: 36px; background: rgba(202, 167, 122, 0.12); color: #9b8065; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div>
                  <strong style="color:#4f3827; font-size:15px; font-weight: 700;">${Data.escapeHtml(mName)}</strong>
                  <div style="font-size:12px; color:#8a735e; margin-top:2px; font-weight: 500;">隊伍夥伴</div>
                </div>
              </div>
              <a href="${reviewUrl}" style="text-decoration:none; background:#caa77a; color:#ffffff; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:700; box-shadow: 0 4px 10px rgba(202, 167, 122, 0.15); transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px;" onmouseover="this.style.background='#4f3827'; this.style.boxShadow='0 4px 12px rgba(79, 56, 39, 0.2)';" onmouseout="this.style.background='#caa77a'; this.style.boxShadow='0 4px 10px rgba(202, 167, 122, 0.15)';">
                給予評價
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
              </a>
            </div>
          `;
        }).join(''); //[cite: 5]

      } catch (error) { //[cite: 5]
        console.error('撈取歷史隊員錯誤:', error); //[cite: 5]
        membersListContainer.innerHTML = '<p style="color:#b05353; font-size:13.5px; text-align:center; padding: 20px 0;">名單載入失敗，請確認網路或稍後再試。</p>'; //[cite: 5]
      }
    });
  });
}
import * as Data from './team-data.js';

// 這裡加上了 async，才能在內部使用 await 等待資料
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const getValidParam = name => {
    const value = params.get(name);
    if (!value) return '';
    const trimmed = value.trim();
    return trimmed && !['undefined', 'null', 'unknown'].includes(trimmed) ? trimmed : '';
  };
  const getValidStoredId = key => {
    const value = localStorage.getItem(key);
    if (!value) return '';
    const trimmed = value.trim();
    return trimmed && !['undefined', 'null', 'unknown'].includes(trimmed) ? trimmed : '';
  };

  // targetUserId 是「被評價的人」，userId 則保留給目前登入者，避免兩者混在一起。
  const currentUserId = getValidStoredId('userId') || getValidParam('userId') || Data.currentUserId || '';
  const targetUserId = getValidParam('targetUserId') || getValidParam('revieweeId') || currentUserId || 'default_user';
  // 新增：嘗試從網址抓履歷 ID（例如 ?resumeId=xxx）
  const resumeId = params.get('resumeId') || '';
  const mode = params.get('mode') || 'write';
  const teamId = getValidParam('teamId');
  let contestId = getValidParam('comId');
  const teamName = getValidParam('teamName');
  const storageKey = `userReviews_${targetUserId}`;

  const starRating = $('starRating');
  const stars = starRating ? starRating.querySelectorAll('.star') : [];
  const reviewComment = $('reviewComment');
  const submitReviewBtn = $('submitReviewBtn');
  const reviewList = $('reviewList');
  const reviewFormCard = document.querySelector('.review-form-card');
  let currentRating = 0;
  let targetProfile = null;
  let teamDetailCache = null;
  let canWriteReview = mode !== 'view';

  function showCustomAlert(message, type = 'success') {
    // 檢查是不是已經有打開的視窗，有的話先清掉
    const existingModal = document.getElementById('customAlertModal');
    if (existingModal) existingModal.remove();

    // 建立外層的半透明黑色背景
    const modal = document.createElement('div');
    modal.id = 'customAlertModal';
    modal.className = 'modal';
    modal.style.zIndex = '9999';

    // 根據成功或失敗，決定圖示跟顏色
    const icon = type === 'error' ? '🥺' : '✨';
    const title = type === 'error' ? '哎呀！' : '太棒了！';
    const titleColor = type === 'error' ? '#d9534f' : '#a17851';

    // 塞入裡面的卡片內容
    modal.innerHTML = `
      <div class="modal-card" style="text-align: center; min-width: 320px; padding: 36px 24px;">
        <div style="font-size: 56px; margin-bottom: 12px; line-height: 1;">${icon}</div>
        <h3 style="margin: 0 0 12px 0; color: ${titleColor}; font-size: 22px;">${title}</h3>
        <p style="color: #55483d; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">${message}</p>
        <button id="closeAlertBtn" class="btn primary" style="width: 100%; border-radius: 99px; font-size: 16px;">我知道了</button>
      </div>
    `;

    document.body.appendChild(modal);

    // 綁定「我知道了」按鈕，點下去就把視窗關掉
    document.getElementById('closeAlertBtn').addEventListener('click', () => {
      modal.remove();
    });
  }

  function showCustomConfirm(message, onConfirm) {
    const existingModal = document.getElementById('customConfirmModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'customConfirmModal';
    modal.className = 'modal';
    modal.style.zIndex = '9999';

    modal.innerHTML = `
      <div class="modal-card" style="text-align: center; min-width: 320px; padding: 36px 24px;">
        <div style="font-size: 56px; margin-bottom: 12px; line-height: 1;">🗑️</div>
        <h3 style="margin: 0 0 12px 0; color: #d9534f; font-size: 22px;">確認刪除？</h3>
        <p style="color: #55483d; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">${message}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="cancelConfirmBtn" class="btn" style="flex: 1; border-radius: 99px; font-size: 16px; background: #f1e8dd; color: #55483d; border: none;">取消</button>
          <button id="okConfirmBtn" class="btn primary" style="flex: 1; border-radius: 99px; font-size: 16px; background: #d9534f; border: none; color: #fff;">確定刪除</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 按下取消：直接關閉視窗，什麼都不做
    document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
      modal.remove();
    });

    // 按下確定：關閉視窗，並執行傳進來的刪除邏輯
    document.getElementById('okConfirmBtn').addEventListener('click', () => {
      modal.remove();
      onConfirm();
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[match]);
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function normalizeSkills(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
      return value.split(/[、,，\n]/).map(item => item.trim()).filter(Boolean);
    }
    return [];
  }

  function extractResume(raw) {
    const resume = raw?.resume?.data || raw?.resume || raw?.data || raw || {};
    const skills = [
      ...normalizeSkills(raw?.skills),
      ...normalizeSkills(raw?.tags),
      ...normalizeSkills(raw?.specialty),
      ...normalizeSkills(raw?.specialties),
      ...normalizeSkills(raw?.resume?.tags),
      ...normalizeSkills(resume.tags),
      ...normalizeSkills(resume.skills),
      ...normalizeSkills(resume.user_skill)
    ];

    return {
      title: raw?.applicantName || raw?.name || resume.user_pv_name || resume.resume_name || resume.name || `使用者 ${targetUserId}`,
      name: raw?.applicantName || resume.user_name || resume.name || raw?.name || `使用者 ${targetUserId}`,
      school: resume.school || resume.user_school || raw?.school || '',
      grade: resume.grade || resume.department_grade || raw?.grade || '',
      experience: resume.experience || resume.user_experience || raw?.experience || '',
      intro: resume.intro || resume.user_intro || raw?.intro || raw?.applicantReason || '尚未填寫自我介紹',
      skills: [...new Set(skills)]
    };
  }

  // 新增：透過 API 向後端獲取目標用戶的履歷資料
  async function fetchTargetUserResume() {
    try {
      let url = `/api/pv/getTargetResume?userId=${targetUserId}`;
      if (resumeId) {
        url += `&resumeId=${resumeId}`; // 如果網址有傳履歷 ID，就一起帶給後端
      }

      // 如果拿別人的履歷也需要你的登入驗證，就把 token 塞進去
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': token } : {};

      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('無法取得該用戶履歷');

      const data = await response.json();
      return extractResume(data);

    } catch (error) {
      console.error('抓取履歷失敗：', error);
      // 萬一壞掉（例如後端掛了或找不到），給個預設值，畫面才不會一片白
      return extractResume({
        name: localStorage.getItem(`nickname:${targetUserId}`) || `使用者 ${targetUserId}`,
        intro: '目前無法取得履歷資料，可能已被隱藏或刪除。'
      });
    }
  }

  function safeSetText(id, text) {
    const el = $(id);
    if (el) el.textContent = text || '-';
  }

  function setOptionalTextBlock(id, text) {
    const el = $(id);
    if (!el) return;
    const block = el.closest('.info-block');
    const cleanText = String(text || '').trim();
    if (!cleanText) {
      if (block) block.hidden = true;
      return;
    }
    if (block) block.hidden = false;
    el.textContent = cleanText;
  }

  // 改為非同步函式 (async)
  async function loadResumeData() {
    // 這裡變成等待後端回傳資料
    targetProfile = await fetchTargetUserResume();

    safeSetText('r-title', targetProfile.title);
    safeSetText('r-school', targetProfile.school);
    safeSetText('r-name', targetProfile.name);
    safeSetText('r-grade', [targetProfile.school, targetProfile.grade].filter(Boolean).join(' / '));
    setOptionalTextBlock('r-exp', targetProfile.experience);
    safeSetText('r-intro', targetProfile.intro);

    const skillsContainer = $('r-skills');
    if (!skillsContainer) return;
    skillsContainer.innerHTML = '';

    if (targetProfile.skills.length === 0) {
      skillsContainer.innerHTML = '<span class="empty-note">尚未填寫專長</span>';
      return;
    }

    targetProfile.skills.forEach(skill => {
      const span = document.createElement('span');
      span.className = 'skill-tag';
      span.textContent = skill;
      skillsContainer.appendChild(span);
    });
  }

  function getReviewerName() {
    return localStorage.getItem(`nickname:${currentUserId}`) || `使用者 ${currentUserId}`;
  }

  async function fetchTeamDetail() {
    if (!teamId) return '';

    if (teamDetailCache) return teamDetailCache;

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': token } : {};
      const response = await fetch(`/api/teams/detail?teamId=${encodeURIComponent(teamId)}`, { headers });
      if (!response.ok) return null;

      const result = await response.json();
      teamDetailCache = result.team || result.data || result;
      return teamDetailCache;
    } catch (error) {
      console.error('讀取隊伍狀態失敗：', error);
      return null;
    }
  }

  async function resolveContestId() {
    if (contestId) return contestId;
    if (!teamId) return '';

    try {
      const team = await fetchTeamDetail();
      if (!team) return '';

      contestId = String(team.com_id || team.contestId || team.contest_id || '').trim();
      return contestId;
    } catch (error) {
      console.error('解析比賽 ID 失敗：', error);
      return '';
    }
  }

  function updateStars(value) {
    stars.forEach(star => {
      const active = parseInt(star.getAttribute('data-value'), 10) <= value;
      star.classList.toggle('active', active);
    });
  }

  stars.forEach(star => {
    star.addEventListener('mouseover', function () {
      updateStars(parseInt(this.getAttribute('data-value'), 10));
    });
    star.addEventListener('mouseout', () => updateStars(currentRating));
    star.addEventListener('click', function () {
      currentRating = parseInt(this.getAttribute('data-value'), 10);
      updateStars(currentRating);
    });
  });

  async function loadReviews() {
    if (!reviewList) return;
    reviewList.innerHTML = '讀取中...';

    try {
      // 呼叫我們剛剛在後端寫好的 API
      const response = await fetch(`/api/review/list/${targetUserId}`);
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error('無法取得評價資料');
      }

      const reviews = result.data;

      // ==========================================
      // 🌟 計算並顯示平均星數 (動態精準比例版)
      // ==========================================
      let totalStars = 0;
      reviews.forEach(r => {
        totalStars += (Number(r.star) || 0);
      });

      // 算出平均值 (算到小數點第一位)
      const avgStar = reviews.length > 0 ? (totalStars / reviews.length).toFixed(1) : 0;

      // 準備畫星星的 HTML
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(avgStar)) {
          starsHtml += '<span class="star-full">★</span>'; // 實星
        } else if (i === Math.ceil(avgStar) && !Number.isInteger(Number(avgStar))) {
          // 🌟 魔法在這裡：動態計算小數點的百分比 (例如 2.3 取 0.3 -> 30%)
          const fillPercentage = Math.round((avgStar % 1) * 100);
          starsHtml += `<span class="star-partial" style="background: linear-gradient(90deg, #F28E2B ${fillPercentage}%, #E6DFD5 ${fillPercentage}%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">★</span>`;
        } else {
          starsHtml += '<span class="star-empty">★</span>'; // 空星
        }
      }

      // 把算好的數字與星星塞進 HTML
      const scoreEl = document.getElementById('r-avg-score');
      const starsEl = document.getElementById('r-avg-stars');
      const countEl = document.getElementById('r-avg-count');

      if (scoreEl) scoreEl.textContent = avgStar > 0 ? avgStar : '-.-';
      if (starsEl) starsEl.innerHTML = avgStar > 0 ? starsHtml : '<span class="star-empty">★</span>'.repeat(5);
      if (countEl) countEl.textContent = `(${reviews.length} 則評價)`;
      // ==========================================

      reviewList.innerHTML = '';

      if (reviews.length === 0) {
        reviewList.innerHTML = '<div class="empty-note">目前還沒有人留下評價。</div>';
        return;
      }

      // 把資料庫撈出來的資料一筆一筆畫在畫面上
      reviews.forEach(review => {
        const item = document.createElement('div');
        item.className = 'review-item';
        const rating = Math.max(0, Math.min(5, Number(review.star) || 0));
        const starString = '★'.repeat(rating) + '☆'.repeat(5 - rating);

        // 邏輯：判斷這則留言的作者，是不是現在正在看網頁的人
        const isMyReview = String(review.userWrite_id) === String(currentUserId);

        const deleteBtnHtml = isMyReview
          ? `<button class="delete-review-btn" data-revid="${review.rev_id}">🗑️ 刪除</button>`
          : '';

        item.innerHTML = `
          <div class="review-item-header">
            <span class="review-item-author">${escapeHtml(review.reviewer_name || '匿名隊友')}</span>
            ${deleteBtnHtml}
          </div>
          <div class="review-item-stars">${starString}</div>
          <p class="review-item-content">${escapeHtml(review.rev_content)}</p>
        `;
        reviewList.appendChild(item);
      });

      const deleteBtns = reviewList.querySelectorAll('.delete-review-btn');
      deleteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const revId = e.target.getAttribute('data-revid');

          // 呼叫自訂確認視窗，把 fetch 刪除的動作包進去
          showCustomConfirm('確定要刪除這則評價嗎？此動作無法復原。', async () => {
            try {
              const token = localStorage.getItem('token');
              const response = await fetch(`/api/review/delete/${revId}`, {
                method: 'DELETE',
                headers: { 'Authorization': token ? token : '' }
              });

              if (response.status === 401) {
                throw new Error('登入已過期，請重新登入！');
              }
              const data = await response.json();
              if (!response.ok || !data.ok) throw new Error(data.error || '刪除失敗');

              showCustomAlert('評價已成功刪除！');
              await loadReviews();

            } catch (error) {
              console.error('刪除評價失敗:', error);
              showCustomAlert(error.message, 'error');
            }
          });
        });
      });

    } catch (error) {
      console.error('讀取歷史評價失敗：', error);
      reviewList.innerHTML = '<div class="empty-note">目前無法載入評價，請稍後再試。</div>';
    }
  }

  function setSubmitState(isChecking) {
    if (!submitReviewBtn) return;
    submitReviewBtn.disabled = isChecking;
    submitReviewBtn.textContent = isChecking ? '內容審查中...' : '發布評價';
    submitReviewBtn.style.opacity = isChecking ? '0.6' : '1';
  }

  function lockReviewForm(message) {
    canWriteReview = false;
    if (reviewFormCard) {
      reviewFormCard.innerHTML = `
        <h3 class="card-title">撰寫評價</h3>
        <div class="empty-note">${escapeHtml(message)}</div>
      `;
    }
  }

  async function initMode() {
    // mode=view 用在只看歷史評價，不顯示撰寫表單
    if (mode === 'view' && reviewFormCard) {
      reviewFormCard.hidden = true;
      canWriteReview = false;
      return;
    }

    if (!teamId) {
      lockReviewForm('請從已完賽隊伍的歷史紀錄進入評價。');
      return;
    }

    const team = await fetchTeamDetail();
    const status = team?.team_status || team?.teamStatus || team?.status || '';
    if (status !== 'completed') {
      lockReviewForm('這支隊伍尚未標記為完賽，完賽後才能評價隊友。');
    }
  }

  if (submitReviewBtn) {
    submitReviewBtn.addEventListener('click', async () => {
      if (!canWriteReview) {
        showCustomAlert('這支隊伍尚未完賽，暫時不能送出評價。', 'error');
        return;
      }

      const comment = reviewComment.value.trim();

      if (String(currentUserId) === String(targetUserId)) {
        showCustomAlert('不能評價自己，請選擇隊友進行評價。', 'error');
        return;
      }
      if (currentRating === 0) {
        showCustomAlert('請先選擇星級評分！', 'error');
        return;
      }
      if (!comment) {
        showCustomAlert('請輸入評價內容！', 'error');
        return;
      }

      setSubmitState(true);
      const resolvedContestId = await resolveContestId();
      if (!resolvedContestId) {
        setSubmitState(false);
        showCustomAlert('找不到這支隊伍對應的比賽，請從歷史隊伍重新進入評價。', 'error');
        return;
      }

      const reviewPayload = {
        com_id: resolvedContestId,
        team_id: teamId || null,
        userWrite_id: currentUserId,
        userRec_id: targetUserId,
        star: currentRating,
        rev_content: comment
      };

      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/review/submit-review', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? token : ''
          },
          body: JSON.stringify(reviewPayload)
        });

        // 先檢查是不是被 401 擋在門外
        if (response.status === 401) {
          throw new Error('登入已過期或未登入，請重新登入後再試一次！');
        }

        // 確認沒被擋，再來解析 JSON
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error || '後端儲存評價失敗');
        }

        currentRating = 0;
        updateStars(0);
        reviewComment.value = '';
        setSubmitState(false);

        showCustomAlert('評價發布成功！');
        await loadReviews();

      } catch (error) {
        console.error('發送評價失敗：', error);
        showCustomAlert(error.message || '評價送出失敗，請檢查網路連線或稍後再試。', 'error');
        setSubmitState(false);
      }
    });
  }
  const homeLink = document.querySelector('.logo-link');
  if (homeLink) homeLink.href = Data.withUserParam('/contests.html');

  await initMode();

  // 已經拿掉多餘的 loadReviews() 呼叫
  await loadReviews();
  await loadResumeData();
});

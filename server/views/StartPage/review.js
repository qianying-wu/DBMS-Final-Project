import * as Data from './team-data.js';

// 這裡加上了 async，才能在內部使用 await 等待資料
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);

  // targetUserId 是「被評價的人」，userId 則保留給目前登入者，避免兩者混在一起。
  const currentUserId = localStorage.getItem('userId') || params.get('userId') || Data.currentUserId || '';
  const targetUserId = params.get('targetUserId') || params.get('revieweeId') || currentUserId || 'default_user';
  // 新增：嘗試從網址抓履歷 ID（例如 ?resumeId=xxx）
  const resumeId = params.get('resumeId') || ''; 
  const mode = params.get('mode') || 'write';
  const teamId = params.get('teamId') || '';
  const teamName = params.get('teamName') || '';
  const storageKey = `userReviews_${targetUserId}`;

  const starRating = $('starRating');
  const stars = starRating ? starRating.querySelectorAll('.star') : [];
  const reviewComment = $('reviewComment');
  const submitReviewBtn = $('submitReviewBtn');
  const reviewList = $('reviewList');
  const reviewFormCard = document.querySelector('.review-column .editor-card');
  let currentRating = 0;
  let targetProfile = null;

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
      experience: resume.experience || resume.user_experience || raw?.experience || '尚未填寫經歷',
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

  // 改為非同步函式 (async)
  async function loadResumeData() {
    // 這裡變成等待後端回傳資料
    targetProfile = await fetchTargetUserResume();

    safeSetText('r-title', targetProfile.title);
    safeSetText('r-school', targetProfile.school);
    safeSetText('r-name', targetProfile.name);
    safeSetText('r-grade', [targetProfile.school, targetProfile.grade].filter(Boolean).join(' / '));
    safeSetText('r-exp', targetProfile.experience);
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

  function updateStars(value) {
    stars.forEach(star => {
      const active = parseInt(star.getAttribute('data-value'), 10) <= value;
      star.classList.toggle('active', active);
    });
  }

  stars.forEach(star => {
    star.addEventListener('mouseover', function() {
      updateStars(parseInt(this.getAttribute('data-value'), 10));
    });
    star.addEventListener('mouseout', () => updateStars(currentRating));
    star.addEventListener('click', function() {
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

        item.innerHTML = `
          <div class="review-item-header">
            <span class="review-item-author">${escapeHtml(review.reviewer_name || '匿名隊友')}</span>
          </div>
          <div class="review-item-stars">${starString}</div>
          <p class="review-item-content">${escapeHtml(review.rev_content)}</p>
        `;
        reviewList.appendChild(item);
      });

    } catch (error) {
      console.error('讀取歷史評價失敗：', error);
      reviewList.innerHTML = '<div class="empty-note">目前無法載入評價，請稍後再試。</div>';
    }
  }

  async function checkIsBadContent(text) {
    const gasUrl = 'https://script.google.com/macros/s/AKfycbz4ifJzx6YFG7SroCncE5gcbXp17GyYeGbqJPXGWAeRIMazlifaeJT3ijeDZ5cVqnu-Lw/exec';

    try {
      const response = await fetch(`${gasUrl}?text=${encodeURIComponent(text)}`);
      const data = await response.json();
      return data.flagged === true;
    } catch (error) {
      console.error('評價內容審查服務連線失敗:', error);
      return false;
    }
  }

  function setSubmitState(isChecking) {
    if (!submitReviewBtn) return;
    submitReviewBtn.disabled = isChecking;
    submitReviewBtn.textContent = isChecking ? '內容審查中...' : '發布評價';
    submitReviewBtn.style.opacity = isChecking ? '0.6' : '1';
  }

  function initMode() {
    // mode=view 用在只看歷史評價，不顯示撰寫表單
    if (mode === 'view' && reviewFormCard) {
      reviewFormCard.hidden = true;
    }
  }

  if (submitReviewBtn) {
    submitReviewBtn.addEventListener('click', async () => {
      const comment = reviewComment.value.trim();

      if (String(currentUserId) === String(targetUserId)) {
        alert('不能評價自己，請選擇隊友進行評價。');
        return;
      }
      if (currentRating === 0) {
        alert('請先選擇星級評分！');
        return;
      }
      if (!comment) {
        alert('請輸入評價內容！');
        return;
      }

      setSubmitState(true);
      
      const isBad = await checkIsBadContent(comment);
      if (isBad) {
        alert('系統檢測到您的留言包含不文明用語，請修改後再發布！');
        setSubmitState(false);
        return;
      }

      // ==========================================
      // 🌟 配合後端規定，打包新的評價資料格式
      // ==========================================
      const reviewPayload = {
        com_id: teamId || 1, // ⚠️ 注意：你們後端必填 com_id(比賽ID)，如果你從網址抓不到，可能要先塞個預設值(如 1)避免報錯
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
        
        alert('評價發布成功！');
        await loadReviews(); 
        
      } catch (error) {
        console.error('發送評價失敗：', error);
        alert(error.message || '評價送出失敗，請檢查網路連線或稍後再試。');
        setSubmitState(false);
      }
    });
  }
  const homeLink = document.querySelector('.logo-link');
  if (homeLink) homeLink.href = Data.withUserParam('/contests.html');

  initMode();
  loadReviews();
  
  await loadReviews();
  await loadResumeData();
});
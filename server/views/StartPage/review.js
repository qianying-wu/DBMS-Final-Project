import * as Data from './team-data.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);

  // targetUserId 是「被評價的人」，userId 則保留給目前登入者，避免兩者混在一起。
  const currentUserId = localStorage.getItem('userId') || params.get('userId') || Data.currentUserId || '';
  const targetUserId = params.get('targetUserId') || params.get('revieweeId') || currentUserId || 'default_user';
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

  function findProfileFromLocalData() {
    // 先從隊伍申請與已核准隊友資料找，讓審核申請時能看到同一位申請者的資料。
    const applications = readJson('teamApplications:v1', []);
    const matchedApplication = applications.find(app => String(app.userId) === String(targetUserId));
    if (matchedApplication) return extractResume(matchedApplication);

    const memberKeys = Object.keys(localStorage).filter(key => key.startsWith('teamMembers:v1:'));
    for (const key of memberKeys) {
      const matchedMember = readJson(key, []).find(member => String(member.userId) === String(targetUserId));
      if (matchedMember) return extractResume(matchedMember);
    }

    // 若是在看自己的評價，補抓個人履歷 gallery 中目前啟用的履歷。
    if (String(currentUserId) === String(targetUserId)) {
      const profiles = readJson('profiles', []);
      const activeProfileId = localStorage.getItem('activeProfileId');
      const activeProfile = profiles.find(item => String(item.id) === String(activeProfileId)) || profiles[0];
      if (activeProfile) return extractResume(activeProfile);
    }

    return extractResume({
      name: localStorage.getItem(`nickname:${targetUserId}`) || `使用者 ${targetUserId}`,
      intro: '目前尚未留下更多個人資料'
    });
  }

  function safeSetText(id, text) {
    const el = $(id);
    if (el) el.textContent = text || '-';
  }

  function loadResumeData() {
    targetProfile = findProfileFromLocalData();
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

  function loadReviews() {
    if (!reviewList) return;
    const reviews = readJson(storageKey, []);
    reviewList.innerHTML = '';

    if (reviews.length === 0) {
      reviewList.innerHTML = '<div class="empty-note">目前還沒有人留下評價。</div>';
      return;
    }

    reviews.forEach(review => {
      const item = document.createElement('div');
      item.className = 'review-item';
      const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));
      const starString = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      const sourceText = review.teamName ? `來自 ${review.teamName}` : '隊友評價';

      item.innerHTML = `
        <div class="review-item-header">
          <span class="review-item-author">${escapeHtml(review.reviewerName || '匿名隊友')}</span>
          <span class="review-item-time">${new Date(review.date).toLocaleDateString('zh-TW')}</span>
        </div>
        <div class="review-item-meta">${escapeHtml(sourceText)}</div>
        <div class="review-item-stars">${starString}</div>
        <p class="review-item-content">${escapeHtml(review.content)}</p>
      `;
      reviewList.appendChild(item);
    });
  }

  async function checkIsBadContent(text) {
    const gasUrl = 'https://script.google.com/macros/s/AKfycbz4ifJzx6YFG7SroCncE5gcbXp17GyYeGbqJPXGWAeRIMazlifaeJT3ijeDZ5cVqnu-Lw/exec';

    try {
      const response = await fetch(`${gasUrl}?text=${encodeURIComponent(text)}`);
      const data = await response.json();
      return data.flagged === true;
    } catch (error) {
      // 外部審查服務失敗時，不阻擋使用者送出，避免整個評價功能不可用。
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
    // mode=view 用在隊長審核申請者時，只看歷史評價，不顯示撰寫表單。
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

      // 先存 localStorage，未來後端 review API 完整後可以在這裡同步送出資料庫。
      const reviews = readJson(storageKey, []);
      reviews.unshift({
        rating: currentRating,
        content: comment,
        date: new Date().toISOString(),
        reviewerId: currentUserId,
        reviewerName: getReviewerName(),
        targetUserId,
        targetName: targetProfile?.name || `使用者 ${targetUserId}`,
        teamId,
        teamName
      });
      localStorage.setItem(storageKey, JSON.stringify(reviews));

      currentRating = 0;
      updateStars(0);
      reviewComment.value = '';
      setSubmitState(false);

      alert('評價發布成功！');
      loadReviews();
    });
  }

  const homeLink = document.querySelector('.logo-link');
  if (homeLink) homeLink.href = Data.withUserParam('/contests.html');

  loadResumeData();
  initMode();
  loadReviews();
});

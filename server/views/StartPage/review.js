import * as Data from './team-data.js';

document.addEventListener('DOMContentLoaded', () => {

  const $ = id => document.getElementById(id);

  // 1. 從網址取得用戶 ID
  const urlParams = new URLSearchParams(window.location.search);
  const targetUserId = urlParams.get('userId') || 'default_user'; 
  
  // 依據用戶 ID 設定專屬的 localStorage Key
  const storageKey = `userReviews_${targetUserId}`;


  // 載入資料防呆功能
  function loadResumeData() {
    const userData = mockDatabase[targetUserId] || mockDatabase['default_user'];
    
    const safeSetText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    safeSetText('r-title', userData.title);
    safeSetText('r-school', userData.school);
    safeSetText('r-name', userData.name);
    safeSetText('r-grade', userData.school); 
    safeSetText('r-exp', userData.experience);
    safeSetText('r-intro', userData.intro);

    const skillsContainer = document.getElementById('r-skills');
    if (skillsContainer) {
      skillsContainer.innerHTML = '';
      userData.skills.forEach(skill => {
        const span = document.createElement('span');
        span.className = 'skill-tag';
        span.textContent = skill;
        skillsContainer.appendChild(span);
      });
    }
  }

  // 星級與留言邏輯
  const starRating = document.getElementById('starRating');
  const stars = starRating ? starRating.querySelectorAll('.star') : [];
  const reviewComment = document.getElementById('reviewComment');
  const submitReviewBtn = document.getElementById('submitReviewBtn');
  const reviewList = document.getElementById('reviewList');
  let currentRating = 0;

  stars.forEach(star => {
    star.addEventListener('mouseover', function() {
      updateStars(parseInt(this.getAttribute('data-value')));
    });
    star.addEventListener('mouseout', function() {
      updateStars(currentRating);
    });
    star.addEventListener('click', function() {
      currentRating = parseInt(this.getAttribute('data-value'));
      updateStars(currentRating);
    });
  });

  function updateStars(value) {
    stars.forEach(star => {
      if (parseInt(star.getAttribute('data-value')) <= value) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function(match) {
      const escape = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      };
      return escape[match];
    });
  }

  // 載入歷史評價
  function loadReviews() {
    if (!reviewList) return;
    const reviews = JSON.parse(localStorage.getItem(storageKey) || '[]');
    reviewList.innerHTML = '';

    if (reviews.length === 0) {
      reviewList.innerHTML = '<div class="empty-note" style="color:#8a735e; padding: 16px;">目前還沒有人留下評價。</div>';
      return;
    }

    reviews.forEach(review => {
      const item = document.createElement('div');
      item.className = 'review-item';
      const starString = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      
      item.innerHTML = `
        <div class="review-item-header">
          <span class="review-item-author">匿名隊友</span>
          <span class="review-item-time">${new Date(review.date).toLocaleDateString('zh-TW')}</span>
        </div>
        <div class="review-item-stars">${starString}</div>
        <p class="review-item-content">${escapeHtml(review.content)}</p>
      `;
      reviewList.appendChild(item);
    });
  }

  async function checkIsBadContent(text) {
    const YOUR_GOOGLE_GAS_URL = 'https://script.google.com/macros/s/AKfycbz4ifJzx6YFG7SroCncE5gcbXp17GyYeGbqJPXGWAeRIMazlifaeJT3ijeDZ5cVqnu-Lw/exec';

    try {
      const url = `${YOUR_GOOGLE_GAS_URL}?text=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error('後端發生錯誤:', data.error);
        return false; 
      }

      return data.flagged === true;

    } catch (error) {
      console.error('連線失敗:', error);
      return false; 
    }
  }

  // --- 提交評價按鈕邏輯 ---
  if (submitReviewBtn) {
    submitReviewBtn.addEventListener('click', async () => {
      const comment = reviewComment.value.trim();

      if (currentRating === 0) { alert('請先選擇星級評分！'); return; }
      if (comment === '') { alert('請輸入評價內容！'); return; }

      submitReviewBtn.disabled = true;
      submitReviewBtn.textContent = '內容審查中...';
      submitReviewBtn.style.opacity = '0.6';

      const isBad = await checkIsBadContent(comment);

      if (isBad) {
        alert('系統檢測到您的留言包含不文明用語，請修改後再發布！');
        submitReviewBtn.disabled = false;
        submitReviewBtn.textContent = '發布評價';
        submitReviewBtn.style.opacity = '1';
        return; 
      }

      const newReview = {
        rating: currentRating,
        content: comment,
        date: new Date().toISOString()
      };

      const reviews = JSON.parse(localStorage.getItem(storageKey) || '[]');
      reviews.unshift(newReview);
      localStorage.setItem(storageKey, JSON.stringify(reviews));

      currentRating = 0;
      updateStars(0);
      reviewComment.value = '';
      
      submitReviewBtn.disabled = false;
      submitReviewBtn.textContent = '發布評價';
      submitReviewBtn.style.opacity = '1';

      alert('評價發布成功！');
      loadReviews();
    });
  }
  const homeLink = $('homeLink');
  if (homeLink) homeLink.href = Data.withUserParam('/contests.html');
  
  loadResumeData();
  loadReviews();
});
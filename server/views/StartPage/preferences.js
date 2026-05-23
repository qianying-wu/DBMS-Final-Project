(function(){
  // 預設標籤：API 暫時無法連線時，前端仍可用這組資料正常顯示。
  const DEFAULT_TAGS = [
    { key: 'ai', label: 'AI / 機器學習' },
    { key: 'data', label: '資料分析' },
    { key: 'web', label: '網頁開發' },
    { key: 'app', label: 'App 開發' },
    { key: 'robotics', label: '機器人' },
    { key: 'security', label: '資安' },
    { key: 'medical', label: '醫療科技' },
    { key: 'fintech', label: '金融科技' },
    { key: 'sustainability', label: '永續議題' },
    { key: 'startup', label: '創業提案' },
    { key: 'design', label: 'UI/UX' },
    { key: 'presentation', label: '簡報企劃' }
  ];

  // 目前本機種子比賽對應的推薦標籤，用來計算前端推薦分數。
  const CONTEST_TAGS = {
    10: ['data', 'ai'],
    11: ['robotics', 'ai'],
    12: ['web', 'app', 'startup', 'presentation'],
    13: ['medical', 'ai', 'data'],
    14: ['sustainability', 'startup', 'presentation'],
    15: ['fintech', 'data', 'security']
  };

  function getCurrentUserId(){
    const params = new URLSearchParams(location.search);
    return params.get('userId') || params.get('id') || 'unknown';
  }

  function storageKey(userId = getCurrentUserId()){
    return `preferences:${userId || 'unknown'}`;
  }

  function getFallbackPreferences(userId = getCurrentUserId()){
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
  }

  function setFallbackPreferences(preferences, userId = getCurrentUserId()){
    localStorage.setItem(storageKey(userId), JSON.stringify(preferences));
  }

  function labelFor(key){
    return (DEFAULT_TAGS.find(tag => tag.key === key) || {}).label || key;
  }

  // 從 API 讀標籤；失敗時回傳預設標籤。
  async function loadTags(){
    try {
      const resp = await fetch('/api/auth/preference-tags');
      const json = await resp.json();
      if (resp.ok && Array.isArray(json.tags)) return json.tags;
    } catch (err) {
      console.warn('Preference tags fallback:', err.message || err);
    }
    return DEFAULT_TAGS;
  }

  // 從 API 讀使用者偏好；失敗時回到 localStorage 備援。
  async function loadUserPreferences(userId = getCurrentUserId()){
    try {
      if (!userId || userId === 'unknown') return getFallbackPreferences(userId);
      const resp = await fetch(`/api/auth/users/${encodeURIComponent(userId)}/preferences`);
      const json = await resp.json();
      if (resp.ok && Array.isArray(json.preferences)) {
        setFallbackPreferences(json.preferences, userId);
        return json.preferences;
      }
    } catch (err) {
      console.warn('User preferences fallback:', err.message || err);
    }
    return getFallbackPreferences(userId);
  }

  // 將偏好寫入 API，同時也寫一份 localStorage，方便離線或 API 失敗時使用。
  async function saveUserPreferences(userId, preferences){
    setFallbackPreferences(preferences, userId);
    if (!userId || userId === 'unknown') return { ok: true, preferences, localOnly: true };

    try {
      const resp = await fetch(`/users/${encodeURIComponent(userId)}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences })
      });
      const json = await resp.json().catch(() => ({}));
      if (resp.ok) return json;
      return { ok: true, warning: json.error || '偏好已先儲存在本機', preferences, localOnly: true };
    } catch (err) {
      console.warn('Save preferences fallback:', err.message || err);
      return { ok: true, preferences, localOnly: true };
    }
  }

  // 若比賽沒有明確標籤，依名稱和介紹簡單推測，讓自建比賽也能被推薦。
  function inferContestTags(contest){
    const text = `${contest.name || ''} ${contest.info || ''}`.toLowerCase();
    const tags = new Set(CONTEST_TAGS[Number(contest.id)] || contest.preferenceKeys || []);
    if (/ai|人工智慧|機器學習|智慧/.test(text)) tags.add('ai');
    if (/資料|data|分析/.test(text)) tags.add('data');
    if (/網頁|前端|web/.test(text)) tags.add('web');
    if (/app|手機|行動/.test(text)) tags.add('app');
    if (/機器人|robot/.test(text)) tags.add('robotics');
    if (/資安|security/.test(text)) tags.add('security');
    if (/醫療|medical/.test(text)) tags.add('medical');
    if (/金融|fintech|支付/.test(text)) tags.add('fintech');
    if (/永續|能源|sustain/.test(text)) tags.add('sustainability');
    if (/創業|提案|黑客松|hackathon/.test(text)) tags.add('startup');
    if (/設計|ui|ux/.test(text)) tags.add('design');
    if (/簡報|企劃|pitch/.test(text)) tags.add('presentation');
    return [...tags];
  }

  function scoreContest(contest, preferences){
    const contestTags = inferContestTags(contest);
    const matches = contestTags.filter(tag => preferences.includes(tag));
    return { score: matches.length, matches, contestTags };
  }

  window.AppPreferences = {
    DEFAULT_TAGS,
    getCurrentUserId,
    getFallbackPreferences,
    setFallbackPreferences,
    labelFor,
    loadTags,
    loadUserPreferences,
    saveUserPreferences,
    inferContestTags,
    scoreContest
  };
})();

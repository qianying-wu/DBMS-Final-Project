// 本機測試用的預設使用者資料
export const ME = { id: 9999, name: '你自己' };

// 取得網址列參數，若有傳遞有效的 userId 則使用，否則使用預設使用者的 ID
const params = new URLSearchParams(location.search);
export const currentUserId = params.get('userId') && params.get('userId') !== 'unknown' ? params.get('userId') : String(ME.id);

// 工具函式：將字串中的特殊字元編碼，防止 XSS 攻擊
export function escapeHtml(value) {
  if (!value) return '';
  return String(value).replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match]));
}

// 工具函式：在指定的網址路徑後方，自動補上目前的 userId 參數，確保頁面跳轉時身分不遺失
export function withUserParam(path) {
  const userId = params.get('userId');
  return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
}

// 從 localStorage 讀取隊伍列表；如果沒有資料，則寫入預設的種子資料 (seed) 並回傳
export function loadTeams() {
  const seed = [
    { id: 101, name: '機器學習實戰', desc: '徵求對影像辨識有經驗的隊友', members: 2, slots: 4, owner: 1, contestId: 10 },
    { id: 102, name: '醫療大數據分析', desc: '需要熟練 Pandas 的資料科學家', members: 1, slots: 3, owner: 2, contestId: 13 },
    { id: 103, name: 'FinTech 創新', desc: '目標是區塊鏈支付，缺前端', members: 3, slots: 5, owner: 3, contestId: 15 }
  ];
  const raw = localStorage.getItem('teams');
  if (!raw) {
    localStorage.setItem('teams', JSON.stringify(seed));
    return seed;
  }
  
  // 過濾掉舊有不必要的預設隊伍，並確保基本的種子資料存在
  const defaultNames = ['AI 聯合隊', '機器人挑戰隊', '資料探勘小隊'];
  const teams = JSON.parse(raw).filter(team => !defaultNames.includes(team.name));
  if (!teams.length) teams.push(...seed);
  localStorage.setItem('teams', JSON.stringify(teams));
  return teams;
}

// 將最新的隊伍陣列存回 localStorage
export function saveTeams(teams) {
  localStorage.setItem('teams', JSON.stringify(teams));
}

// 從 localStorage 讀取比賽列表；沒有資料時會載入預設的 seed，並補齊缺失的預設屬性
export function loadContests() {
  const seed = [
    { id: 10, name: '全國資料科學競賽', date: '2026-07-20', info: '針對資料科學專題的校內外隊伍競賽', preferenceKeys: ['data', 'ai'] },
    { id: 11, name: '全國機器人盃', date: '2026-09-10', info: '機器人實作與競賽', preferenceKeys: ['robotics', 'ai'] },
    { id: 12, name: '校園創新黑客松', date: '2026-08-15', info: '48 小時產品原型、簡報與實作挑戰', preferenceKeys: ['web', 'app', 'startup', 'presentation'] },
    { id: 13, name: '智慧醫療應用競賽', date: '2026-10-02', info: '結合資料分析、AI 與醫療場景的跨域競賽', preferenceKeys: ['medical', 'ai', 'data'] },
    { id: 14, name: '永續科技提案賽', date: '2026-11-18', info: '以永續、能源與社會影響為主題的提案競賽', preferenceKeys: ['sustainability', 'startup', 'presentation'] },
    { id: 15, name: '金融科技創意賽', date: '2026-12-05', info: '金融資料、風控、支付與數位服務創新競賽', preferenceKeys: ['fintech', 'data', 'security'] },
    { id: 16, name: '區塊鏈創新應用賽', date: '2026-12-20', info: 'Web3 與智能合約應用開發', preferenceKeys: ['fintech', 'web', 'security'] },
    { id: 17, name: '智慧城市盃', date: '2027-01-10', info: '透過物聯網改善城市問題的實作賽', preferenceKeys: ['app', 'sustainability', 'data'] },
    { id: 18, name: 'AI 語音應用黑客松', date: '2027-02-15', info: '挑戰 AI 語音辨識與合成應用', preferenceKeys: ['ai', 'app'] },
    { id: 19, name: '資安防禦競賽', date: '2027-03-10', info: '實戰模擬網路攻擊與防禦', preferenceKeys: ['security'] }
  ];

  const raw = localStorage.getItem('contests');
  if (!raw) {
    localStorage.setItem('contests', JSON.stringify(seed));
    return seed;
  }

  const existing = JSON.parse(raw);
  const merged = existing.map(contest => {
    const defaults = seed.find(item => Number(item.id) === Number(contest.id));
    return defaults ? { ...defaults, ...contest, preferenceKeys: contest.preferenceKeys || defaults.preferenceKeys } : contest;
  });
  seed.forEach(contest => {
    if (!merged.some(item => Number(item.id) === Number(contest.id))) merged.push(contest);
  });
  localStorage.setItem('contests', JSON.stringify(merged));
  return merged;
}

// 取得目前使用者在側邊欄選擇的「比賽 ID」
export function getSelectedContestId() {
  return localStorage.getItem('selectedContest') ? Number(localStorage.getItem('selectedContest')) : null;
}

// 設定或清除目前選擇的「比賽 ID」
export function setSelectedContestId(id) {
  if (id == null) localStorage.removeItem('selectedContest');
  else localStorage.setItem('selectedContest', String(id));
}

// 讀寫使用者的「隊伍收藏」名單 (儲存的是隊伍 ID 的陣列)
export function loadFavorites() {
  return JSON.parse(localStorage.getItem('favorites') || '[]');
}
export function saveFavorites(favorites) {
  localStorage.setItem('favorites', JSON.stringify(favorites));
}

// 讀寫使用者的「比賽收藏」名單 (儲存的是比賽 ID 的陣列)
export function loadContestFavorites() {
  return JSON.parse(localStorage.getItem('favoriteContests') || '[]').map(Number);
}
export function saveContestFavorites(favs) {
  localStorage.setItem('favoriteContests', JSON.stringify(favs));
}

// 清理舊版的「我的隊伍」儲存格式，將其轉換並綁定為特定使用者的格式 (myTeams:userId)
export function cleanupLegacyMyTeams(teams) {
  const raw = JSON.parse(localStorage.getItem('myTeams') || '[]');
  if (!raw.length) return;
  const validIds = raw.map(item => item.id ?? item).filter(id => teams.some(team => Number(team.id) === Number(id)));
  localStorage.setItem(`myTeams:${currentUserId}`, JSON.stringify(validIds));
  localStorage.removeItem('myTeams');
}
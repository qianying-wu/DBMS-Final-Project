// 本機測試用的預設使用者資料 (保留作為防護備用)
export const ME = { id: 9999, name: '你自己' };

// 取得網址列參數，若有傳遞有效的 userId 則使用，否則使用預設使用者的 ID
const params = new URLSearchParams(location.search);
export const currentUserId = params.get('userId') && params.get('userId') !== 'unknown' ? params.get('userId') : String(ME.id);

// 工具函式：將字串中的特殊字元編碼，防止 XSS 攻擊
export function escapeHtml(value) {
  if (!value) return '';
  return String(value).replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&#39;', '"': '&quot;' }[match]));
}

// 工具函式：在指定的網址路徑後方，自動補上目前的 userId 參數，確保頁面跳轉時身分不遺失
export function withUserParam(path) {
  const userId = params.get('userId');
  return userId ? `${path}${path.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}` : path;
}

// 🚀 轉正版：從真實後端資料庫讀取全部隊伍
export async function loadTeams() {
  try {
    const res = await fetch('/api/teams/all');
    if (!res.ok) throw new Error('無法取得資料庫隊伍資料');

    const result = await res.json();
    const dbTeams = result.data || result.teams || result;
    const activeTeams = dbTeams.filter(team => (team.teamStatus || team.team_status || team.status || 'active') === 'active');

    console.log('📦 資料庫原始隊伍資料：', dbTeams);

    // 🛠️ 變數對齊：對應你之前調整過的資料庫欄位
    const mappedTeams = activeTeams.map(team => ({
      id: team.team_id || team.id,                  // 雙重保險相容
      team_id: team.team_id,                        // 隊伍 ID
      team_name: team.team_name,                    // 隊伍名稱
      com_id: team.com_id,                          // 隸屬比賽 ID
      demand: team.demand || '尚未填寫說明', // 招募需求
      current_member_count: team.current_member_count || 0,     // 目前人數
      num_limit: team.num_limit || 0                // 最大人數上限
    }));

    return mappedTeams;
  } catch (err) {
    console.error('❌ 讀取隊伍資料庫失敗，啟用空陣列防護:', err);
    return [];
  }
}

// 🚀 轉正版：從真實後端資料庫讀取全部比賽
export async function loadContests() {
  try {
    const res = await fetch('/api/contests/competitions');
    if (!res.ok) throw new Error('無法取得資料庫比賽資料');

    const result = await res.json();
    const dbContests = result.competitions || result;

    console.log('📦 資料庫原始比賽資料：', dbContests);

    // 🛠️ 變數對齊：完全對接你之前在 contest.html 內寫的變數
    const mappedContests = dbContests.map(contest => ({
      id: contest.com_id,
      name: contest.com_name,
      com_date: contest.com_date || '日期未定',
      com_intro: contest.com_intro || '尚未填寫說明',
      officialUrl: contest.com_link || '#',
      com_category: contest.comType || '未分類'
    }));

    return mappedContests;
  } catch (err) {
    console.error('❌ 讀取比賽資料庫失敗，啟用空陣列防護:', err);
    return [];
  }
}

// 💡 備註：因為已經全面同步至後端資料庫，此函式在專案中不再需要，保留空函式避免其他頁面 import 時崩潰
export function saveTeams(teams) {
  console.log('💡 提示：隊伍已由資料庫接管，略過本地儲存。');
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

// 讀寫使用者的「隊伍收藏」名單 (儲存的是隊伍 ID 的陣列，維持在 local 合情合理)
export function loadFavorites() {
  return JSON.parse(localStorage.getItem('favorites') || '[]');
}
export function saveFavorites(favorites) {
  localStorage.setItem('favorites', JSON.stringify(favorites));
}

// 讀寫使用者的「比賽收藏」名單 (儲存的是比賽 ID 的陣列，維持在 local 合情合理)
export function loadContestFavorites() {
  return JSON.parse(localStorage.getItem('favoriteContests') || '[]').map(Number);
}
export function saveContestFavorites(favs) {
  localStorage.setItem('favoriteContests', JSON.stringify(favs));
}

// 清理舊版的儲存格式 (升級資料庫後，此防護可安全略過)
export function cleanupLegacyMyTeams(teams) {
  // 資料庫環境已無 legacy myTeams 問題
}

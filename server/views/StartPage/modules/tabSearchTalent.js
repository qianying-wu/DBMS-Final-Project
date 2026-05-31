import * as Data from '../team-data.js';

export async function render(gridContainer, token, userId) {
  gridContainer.innerHTML = `
    <div class="talent-search-page">
      <div class="search-main-area">
        <p class="search-subtitle-full">輸入人名、專長或隊伍關鍵字，尋找志同道合的夥伴</p>
        <div class="search-input-group-expanded">
          <input type="text" id="talentSearchInput" placeholder="請輸入關鍵字...">
          <button class="btn-search-solid" id="btnDoSearch">立即搜尋</button>
        </div>
        <div id="talentSearchResults">
          <p id="searchStatusMsg" class="status-msg-no-wrap" style="display:none;"></p>
          <div id="resultsGrid" class="teams-management-grid"></div>
        </div>
      </div>
    </div>
  `;

  const btnDoSearch = document.getElementById('btnDoSearch');
  if (btnDoSearch) {
    btnDoSearch.addEventListener('click', () => handleTalentSearchAction());
  }
}

async function handleTalentSearchAction() {
  const input = document.getElementById('talentSearchInput');
  const statusMsg = document.getElementById('searchStatusMsg');
  const resultGrid = document.getElementById('resultsGrid');
  
  if (!statusMsg) return;
  const query = input.value.trim();

  if (!query) {
    alert("請輸入關鍵字再進行搜尋喔！");
    return;
  }

  if (resultGrid) resultGrid.innerHTML = ''; 
  statusMsg.innerText = '正在搜尋媒合人才...';
  statusMsg.style.display = 'block';

  try {
    setTimeout(() => {
      const hasResults = false; // 測試模擬切換
      if (!hasResults) {
        statusMsg.innerText = `找不到與「${query}」相關的人才或隊伍，換個關鍵字試試看？`;
      } else {
        statusMsg.innerText = '';
      }
    }, 1500);
  } catch (err) {
    statusMsg.innerText = '搜尋服務暫時無法連線。';
  }
}
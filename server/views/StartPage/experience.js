const $ = (id) => document.getElementById(id);

let editingIdx = null;

// 開啟 Modal
function openModal() {
  $('expModal').hidden = false;
}

// 關閉 Modal
function closeModal() {
  $('expModal').hidden = true;
  editingIdx = null;
}

// 等頁面載入完成
document.addEventListener('DOMContentLoaded', () => {

  console.log('experience.js loaded');

  // 新增經歷
  $('addExpBtn').addEventListener('click', () => {
    openModal();
  });

  // 取消按鈕
  $('cancelExpBtn').addEventListener('click', () => {
    console.log('cancel clicked');
    closeModal();
  });

  // 儲存按鈕
  $('saveExpBtn').addEventListener('click', () => {

    const type = $('expType').value;
    const title = $('expTitle').value;
    const date = $('expDate').value;
    const desc = $('expDesc').value;

    console.log({
      type,
      title,
      date,
      desc
    });

    closeModal();
  });

});
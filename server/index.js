const express = require('express'); // 引入 Express 框架
const path = require('path');
const app = express();
const port = 3000;

// 1. 解析前端傳來的 JSON 資料 (這行一定要加，否則 API 抓不到資料)
app.use(express.json());

// 2. 設定靜態檔案路徑 (指向你存放 HTML/CSS/前端JS 的地方)
// 假設你之後把前端檔案移到名為 public 的資料夾
app.use(express.static(path.join(__dirname, '../public')));

// 3. 測試用 API：檢查後端有沒有跑起來
app.get('/api/test', (req, res) => {
    res.json({ message: "後端伺服器已連線！" });
});

// 4. 啟動伺服器
app.listen(port, () => {
    console.log(`伺服器啟動成功：http://localhost:${port}`);
});
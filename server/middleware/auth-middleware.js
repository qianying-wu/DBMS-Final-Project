// middleware/auth-middleware.js

// 🎯 改用 export const 直接導出
export const requireLogin = (req, res, next) => {
  // passport 驗證完之後，會把使用者資料存進 req.user
  // 如果 req.user 是空的，代表沒有登入或 Token 無效
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "請先登入才能執行此操作",
    });
  }
  // 有登入 → 放行，繼續往下走
  next();
};


// export { requireLogin };
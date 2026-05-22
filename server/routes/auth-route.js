// routes/auth-route.js
import express from 'express';
import passport from 'passport'; 
import * as authController from '../controllers/authController.js';
import { requireLogin } from '../middleware/auth-middleware.js';  

const router = express.Router();

// 🔓 這些是公開 API（不需要登入）
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/preference-tags', authController.getPreferenceTags);

// 🔒 這些是保護 API（必須登入）
// 運作流程：先經過 passport.authenticate 檢查 Token → 再經過 requireLogin 檢查 req.user → 最後才進入 controller
router.get(
  '/users/:userId/preferences', 
  passport.authenticate('jwt', { session: false }), // 1. 驗證 Token 並注入 req.user
  requireLogin,                                    // 2. 你的檢查哨
  authController.getUserPreferences                // 3. 真正的邏輯
);

router.put(
  '/users/:userId/preferences', 
  passport.authenticate('jwt', { session: false }), 
  requireLogin, 
  authController.updateUserPreferences
);

export default router;
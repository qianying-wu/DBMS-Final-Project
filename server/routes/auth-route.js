// routes/auth-route.js
import express from 'express';
import passport from 'passport';
import * as authController from '../controllers/authController.js';
import { requireLogin } from '../middleware/auth-middleware.js';

const router = express.Router();

// 公開 API（不需要登入）
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/preference-tags', authController.getPreferenceTags);

//  這些是保護 API（必須登入）
router.use(passport.authenticate("jwt", { session: false }));    // 驗證 Token 並注入 req.user

// 運作流程：先經過 passport.authenticate 檢查 Token → 再經過 requireLogin 檢查 req.user → 最後才進入 controller
router.get('/users/search', authController.searchUsers);
router.get('/users/:userId/preferences', authController.getUserPreferences);
router.put('/users/:userId/preferences', authController.updateUserPreferences);
router.get('/account', authController.getUserAccount);  // 這個路由會從 req.user 拿 userId
router.get('/userName', authController.getUserName);  // 這個路由會從 req.user 拿 userId
router.put('/password', authController.updatePsw);  // 更新密碼的路由

export default router;

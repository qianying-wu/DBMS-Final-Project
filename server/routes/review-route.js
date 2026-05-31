// server/routes/review-route.js
import express from 'express';
import passport from 'passport'; 
import { requireLogin } from '../middleware/auth-middleware.js';  // 這行是為了保護 API，確保使用者必須登入才能存取 不一定用到
import * as reviewController from '../controllers/reviewController.js';

const router = express.Router();

// 公開 API：取得目標使用者的歷史評價
router.get('/list/:userId', reviewController.getReviews);

//  這些是保護 API（必須登入）
router.use(passport.authenticate("jwt", { session: false }));    // 驗證 Token 並注入 req.user

router.post('/submit-review', reviewController.submitReview);

export default router;
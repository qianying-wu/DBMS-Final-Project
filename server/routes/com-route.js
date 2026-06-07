import express from 'express';
import * as contestController from '../controllers/contestController.js';

import passport from 'passport';

const router = express.Router();


// 公開 API（不需要登入）
router.get('/competitions', contestController.getAllContests);
router.post('/toggle-favorite', contestController.toggleFavorite); // 收藏 / 取消收藏比賽

//  底下是保護 API（必須登入）
router.use(passport.authenticate("jwt", { session: false }));    // 驗證 Token 並注入 req.user
router.get('/getFavorites', contestController.getMyFavoriteContests); // 取得使用者收藏的比賽列表


export default router;
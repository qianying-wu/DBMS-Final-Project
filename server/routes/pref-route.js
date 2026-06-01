import express from 'express';
import * as prefController from '../controllers/prefController.js';

import passport from 'passport';

const router = express.Router();


// 公開 API（不需要登入）
router.get('/allPrefTags', prefController.getAvailableTags); // 取得所有可選的偏好標籤列表，讓前端渲染用

//  底下是保護 API（必須登入）
router.use(passport.authenticate("jwt", { session: false }));    // 驗證 Token 並注入 req.user
router.get('/getpref', prefController.getUserPreferences); // 取得使用者收藏的比賽列表
router.post('/savepref', prefController.saveUserPreferences); // 儲存使用者偏好設定



export default router;
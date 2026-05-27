//這個檔案是為了處理 /api/contests 相關的 API，現在裡面還沒有任何 API，等到需要的時候再來寫

import express from 'express';
import * as comController from '../controllers/comController.js';

import passport from 'passport'; 
import { requireLogin } from '../middleware/auth-middleware.js';  // 這行是為了保護 API，確保使用者必須登入才能存取 不一定用到

const router = express.Router();

// 公開 API（不需要登入）
router.get('/all', comController.getComData); // 當前端呼叫 /api/com/all 時，執行 getAllData

//  底下是保護 API（必須登入）
// router.use(passport.authenticate("jwt", { session: false }));    // 驗證 Token 並注入 req.user

export default router;
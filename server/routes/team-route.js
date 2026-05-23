import express from 'express';
import passport from 'passport'; 
import * as teamController from '../controllers/teamController.js';
import { requireLogin } from '../middleware/auth-middleware.js';  

import { getAllData } from '../controllers/teamController.js';
const router = express.Router();

// 公開 API（不需要登入）
router.get('/all', teamController.getAllData);  //這個之後要拆開（有時間的話）
router.get('/teamDetail', teamController.getTeamDetail);

//  底下都是保護 API（必須登入）
router.use(passport.authenticate("jwt", { session: false }));    // 驗證 Token 並注入 req.user

router.post(
    '/create', 
    requireLogin, 
    teamController.createTeam
);
router.post(
    '/join', 
    requireLogin, 
    teamController.applyToTeam
);

export default router;
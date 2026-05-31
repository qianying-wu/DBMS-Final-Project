import express from 'express';
import passport from 'passport'; 
import * as teamController from '../controllers/teamController.js';
import { requireLogin } from '../middleware/auth-middleware.js';  

const router = express.Router();

// 公開 API（不需要登入）
router.get('/all', teamController.getAllData);  //這個之後要拆開（有時間的話）
router.get('/teamDetail', teamController.getTeamDetail);
router.get('/contests/search', teamController.contestsResult);
router.post('/create', teamController.createTeam);
router.post('/apply', teamController.applyToTeam);
router.get('/my-joined', teamController.getMyJoinedTeams);
router.get('/my-owned', teamController.getMyOwnedTeams);
router.get('/my-favorites', teamController.getMyFavoriteTeams);
router.post('/toggle-favorite', teamController.toggleFavorite);
router.get('/detail', teamController.getTeamMember);
router.post('/review', teamController.reviewApplication);

//  底下都是保護 API（必須登入）
router.use(passport.authenticate("jwt", { session: false }));    // 驗證 Token 並注入 req.user


router.post(
    '/join', 
    requireLogin, 
    teamController.applyToTeam
);

export default router;
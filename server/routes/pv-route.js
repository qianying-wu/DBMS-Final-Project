// routes/pv-route.js
import express from 'express';
import passport from 'passport';
import * as PVController from '../controllers/PVController.js';
import { requireLogin } from '../middleware/auth-middleware.js';

const router = express.Router();

// 公開 API（不需要登入）
router.get('/getMyResumeList', PVController.getMyResumeList);

// 這些是保護 API（必須登入）
router.use(passport.authenticate("jwt", { session: false }));    // 驗證 Token 並注入 req.user

router.get('/getTargetResume', PVController.getTargetResume);
router.get('/loadPV', PVController.loadResumes);
router.post('/savePV', PVController.saveResume);
router.delete('/deletePV/:id', PVController.deleteResume);

export default router;



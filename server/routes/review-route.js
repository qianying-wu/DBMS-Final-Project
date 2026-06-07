// server/routes/review-route.js
import express from 'express';
import passport from 'passport'; 
import * as reviewController from '../controllers/reviewController.js';

const router = express.Router();

router.use(passport.authenticate("jwt", { session: false }));    // 驗證 Token 並注入 req.user
router.get('/list/:userId', reviewController.getReviews);
router.post('/submit-review', reviewController.submitReview);
router.delete('/delete/:revId', reviewController.deleteReview);

export default router;

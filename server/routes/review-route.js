// server/routes/review-route.js
import express from 'express';
import * as reviewController from '../controllers/reviewController.js';

const router = express.Router();

// 🎯 把留在 index 的那行搬過來，改用 router.post
router.post('/submit-review', reviewController.submitReview);

export default router;
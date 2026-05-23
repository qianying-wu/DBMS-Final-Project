import express from 'express';
import { getAllData } from '../controllers/teamController.js';
const router = express.Router();

router.get('/all', getAllData); // 當前端呼叫 /api/teams/all 時，執行 getAllData
export default router;
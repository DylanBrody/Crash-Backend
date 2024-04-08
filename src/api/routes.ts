import { Router } from 'express';
import { getGameInfo, myInfo, updateGameInfo, dayHistory, monthHistory, yearHistory } from '../api/controllers/client';
import { totalHistory, totalUsers } from './controllers/admin';
const router = Router();

router.get('/get-total-history', totalHistory);
router.get('/get-day-history', dayHistory);
router.get('/get-month-history', monthHistory);
router.get('/get-year-history', yearHistory);
router.get('/get-total-users', totalUsers);
router.get('/get-game-info', getGameInfo);

router.post('/my-info', myInfo);
router.post("/update-game-info", updateGameInfo);

export default router;
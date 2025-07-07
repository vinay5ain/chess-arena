// backend/routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// 1. 🏆 Get leaderboard
router.get('/leaderboard/:tournamentId', adminController.getLeaderboard);

// 2. 🧭 Set total number of rounds (can be set only once)
router.put('/rounds/:tournamentId', adminController.setRounds);

// 3. 🔁 Auto matchmaking (one match per player per round, auto-checks round state)
router.post('/auto-match/:tournamentId', adminController.autoMatchmaking);

// 4. ✍️ Manual matchmaking (admin creates match manually)
router.post('/manual-match', adminController.manualMatchmaking);

// 5. ✅ Set winner manually (admin picks a winner)
router.post('/set-winner/:matchId', adminController.setMatchWinner);

// 6. 🥊 Progress knockout stage (recursive elimination until winner)
router.post('/knockout/progress/:tournamentId', adminController.progressKnockouts);

// 7. 📜 Full match history for the tournament
router.get('/history/:tournamentId', adminController.getMatchHistory);

module.exports = router;

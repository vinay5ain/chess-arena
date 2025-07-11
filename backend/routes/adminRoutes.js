const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// 1. 🏆 Get leaderboard
router.get('/leaderboard/:tournamentId', adminController.getLeaderboard);

// 2. 🧭 Set total number of rounds
router.put('/rounds/:tournamentId', adminController.setRounds);

// 3. 🔁 Auto matchmaking
router.post('/auto-match/:tournamentId', adminController.autoMatchmaking);

// 4. ✍️ Manual match creation (NOW WORKS)
router.post('/manual-match', adminController.manualMatchmaking);

// 5. ✅ Set winner manually
router.post('/set-winner/:matchId', adminController.setMatchWinner);

// 6. 🥊 Progress knockout stage
router.post('/knockout/progress/:tournamentId', adminController.progressKnockouts);

// 7. 📜 Full match history
router.get('/history/:tournamentId', adminController.getMatchHistory);

module.exports = router;

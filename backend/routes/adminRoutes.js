// backend/routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// 1. 🏆 Get leaderboard
router.get('/leaderboard/:tournamentId', adminController.getLeaderboard);

// 2. 🧭 Set total number of rounds (locked after first set)
router.put('/rounds/:tournamentId', adminController.setRounds);

// 3. 🔁 Auto matchmaking (Rounds + Knockout + Finals)
router.post('/auto-match/:tournamentId', adminController.autoMatchmaking);

// 4. ✅ Set winner manually
router.post('/set-winner/:matchId', adminController.setMatchWinner);

// 5. 🥊 Progress knockout stage
router.post('/knockout/progress/:tournamentId', adminController.progressKnockouts);

// 6. 📜 Full match history
router.get('/history/:tournamentId', adminController.getMatchHistory);

module.exports = router;

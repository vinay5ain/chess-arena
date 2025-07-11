const express = require('express');
const router = express.Router();

const {
  getLeaderboard,
  qualifyPlayers,
  setMatchWinner,
  generateKnockoutMatches,
  progressKnockouts
} = require('../controllers/roundController');

// 🏆 Leaderboard
router.get('/leaderboard/:tournamentId', getLeaderboard);

// ✅ Qualify top players
router.post('/qualify', qualifyPlayers);

// ✍️ Manually set match winner
router.put('/match/:matchId/result', setMatchWinner);

// 🔁 Generate knockout matches from topN players
router.post('/knockout/generate', generateKnockoutMatches);

// 🥊 Progress knockout stage until final winner
router.post('/knockout/progress/:tournamentId', progressKnockouts);

module.exports = router;

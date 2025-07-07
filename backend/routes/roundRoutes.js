// backend/routes/roundRoutes.js
const express = require('express');
const router = express.Router();
const {
  getLeaderboard,
  qualifyPlayers,
  setMatchWinner
} = require('../controllers/roundController');

// Leaderboard by tournament
router.get('/leaderboard/:tournamentId', getLeaderboard);

// Qualify players for knockout
router.post('/qualify', qualifyPlayers);

// Admin override to set match result
router.put('/match/:matchId/result', setMatchWinner);

module.exports = router;

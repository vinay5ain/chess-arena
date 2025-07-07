const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');

// ✅ Match tab APIs for admin panel
router.get('/live/:tournamentId', matchController.getLiveMatches);
router.get('/upcoming/:tournamentId', matchController.getUpcomingMatches);
router.get('/past/:tournamentId', matchController.getPastMatches);

// ✅ Specific routes (must be before generic ones)
router.get('/player/:playerId', matchController.getMatchesForPlayer);
router.get('/id/:id', matchController.getMatchById);

// ✅ General match routes (must come last)
router.get('/:tournamentId', matchController.getMatchesByTournament);
router.post('/', matchController.createMatch);

module.exports = router;

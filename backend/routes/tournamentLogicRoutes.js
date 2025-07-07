const express = require('express');
const router = express.Router();
const logic = require('../controllers/tournamentLogicController');

// Run the full tournament with qualifyingCount
router.post('/run-full/:tournamentId', logic.runTournament);

module.exports = router;

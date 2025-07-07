const express = require('express');
const router = express.Router();

const {
  createTournament,
  getAllTournaments,
  getTournamentById,
  joinTournament,
  deleteTournament,
  getTournamentsByOrganizer,
  filterTournaments,
  adminLogin
} = require('../controllers/tournamentController');

router.post('/create', createTournament);
router.get('/all', getAllTournaments);
router.get('/:id', getTournamentById);
router.post('/join', joinTournament);
router.delete('/:id', deleteTournament);
router.get('/organizer/:name', getTournamentsByOrganizer);
router.get('/filter/:type', filterTournaments);
router.post('/login', adminLogin); // ✅ Admin login endpoint

module.exports = router;

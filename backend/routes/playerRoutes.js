const express = require('express');
const router = express.Router();
const Player = require('../models/player');
const Match = require('../models/match');

// ✅ Player Profile – used for login and profile
router.get('/profile/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await Player.findOne({ playerId });
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // ✅ Send minimal required data
    res.status(200).json({
      name: player.name,
      playerId: player.playerId,
      tournamentId: player.tournamentId
    });
  } catch (err) {
    console.error('❌ Error fetching player profile:', err.message);
    res.status(500).json({ message: 'Error loading player profile' });
  }
});

// ✅ Matches by Player ID – grouped by status (used in profile page)
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await Player.findOne({ playerId });
    if (!player) return res.status(404).json({ message: 'Player not found' });

    const matches = await Match.find({
      tournamentId: player.tournamentId,
      $or: [
        { player1: player.name },
        { player2: player.name }
      ]
    });

    const grouped = {
      ongoing: [],
      upcoming: [],
      history: []
    };

    for (const match of matches) {
      const formatted = {
        matchId: match._id,
        player1Name: match.player1,
        player2Name: match.player2,
        round: match.round ?? 'N/A',
        status: match.status,
        winner: match.winner ?? null
      };

      if (match.status === 'live') grouped.ongoing.push(formatted);
      else if (match.status === 'upcoming') grouped.upcoming.push(formatted);
      else if (match.status === 'completed') grouped.history.push(formatted);
    }

    res.status(200).json(grouped);
  } catch (err) {
    console.error('❌ Error fetching matches for player:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

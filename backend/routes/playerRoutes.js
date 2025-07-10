const express = require('express');
const router = express.Router();
const Player = require('../models/player');
const Match = require('../models/match');
const Tournament = require('../models/tournament');
const shortid = require('shortid'); // Install with: npm install shortid

// ✅ Add player (main fix)
router.post('/add', async (req, res) => {
  try {
    const { tournamentId, playerName } = req.body;

    if (!tournamentId || !playerName) {
      return res.status(400).json({ message: 'tournamentId and playerName are required.' });
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found.' });
    }

    const playerId = shortid.generate();

    const player = new Player({
      name: playerName,
      playerId,
      tournamentId
    });

    await player.save();

    res.status(201).json({
      message: 'Player added successfully',
      name: player.name,
      playerId: player.playerId
    });
  } catch (err) {
    console.error('❌ Error adding player:', err.message);
    res.status(500).json({ message: 'Failed to add player.' });
  }
});

// ✅ Get player profile
router.get('/profile/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await Player.findOne({ playerId });
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

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

// ✅ Get player matches (grouped)
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await Player.findOne({ playerId });
    if (!player) return res.status(404).json({ message: 'Player not found' });

    const matches = await Match.find({
      tournamentId: player.tournamentId,
      $or: [{ player1: player.name }, { player2: player.name }]
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

// ✅ Disqualify player
router.post('/disqualify', async (req, res) => {
  try {
    const { playerId } = req.body;

    const player = await Player.findOneAndUpdate(
      { playerId },
      { disqualified: true },
      { new: true }
    );

    if (!player) {
      return res.status(404).json({ message: 'Player not found.' });
    }

    res.status(200).json({ message: 'Player disqualified successfully.' });
  } catch (err) {
    console.error('❌ Disqualification error:', err.message);
    res.status(500).json({ message: 'Failed to disqualify player.' });
  }
});

// ✅ Remove points from player
router.post('/updatePoints', async (req, res) => {
  try {
    const { playerId, points } = req.body;

    const player = await Player.findOne({ playerId });
    if (!player) return res.status(404).json({ message: 'Player not found' });

    player.points = (player.points || 0) + points;
    if (player.points < 0) player.points = 0;

    await player.save();
    res.status(200).json({ message: 'Points updated', points: player.points });
  } catch (err) {
    console.error('❌ Point update error:', err.message);
    res.status(500).json({ message: 'Failed to update points.' });
  }
});

module.exports = router;

// backend/controllers/roundController.js
const Tournament = require('../models/Tournament');
const Player = require('../models/Player');
const Match = require('../models/Match');

// Get leaderboard for a tournament (sorted by points)
const getLeaderboard = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const players = await Player.find({ tournamentId }).sort({ points: -1 });
    res.json(players);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Qualify top N players for knockout
const qualifyPlayers = async (req, res) => {
  try {
    const { tournamentId, roundLimit } = req.body;

    const players = await Player.find({ tournamentId }).sort({ points: -1 });

    const cutoff = players[roundLimit - 1]?.points;

    // Handle tie-breaker group
    const qualified = players.filter(p => p.points > cutoff);
    const tieBreakers = players.filter(p => p.points === cutoff);

    const top = qualified.concat(tieBreakers);

    res.json({
      message: 'Qualification stage complete',
      qualified: top.map(p => ({ name: p.name, playerId: p.playerId, points: p.points })),
      needsTieBreaker: tieBreakers.length > 1
    });

  } catch (err) {
    console.error('Error during qualification:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin decides match winner (for offline matches)
const setMatchWinner = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner } = req.body;

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    match.result = winner;
    match.status = 'completed';

    // Award 2 points to the winner
    await Player.findOneAndUpdate(
      { name: winner, tournamentId: match.tournamentId },
      { $inc: { points: 2 } }
    );

    await match.save();
    res.json({ message: 'Match result updated by admin', match });

  } catch (err) {
    console.error('Admin result update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getLeaderboard,
  qualifyPlayers,
  setMatchWinner
};

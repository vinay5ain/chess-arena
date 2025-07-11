const Player = require('../models/player');
const Match = require('../models/match');

// Helper to shuffle players randomly
const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

// 1. Get leaderboard
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

// 2. Qualify top N players for knockout (with tie-breaker logic)
const qualifyPlayers = async (req, res) => {
  try {
    const { tournamentId, roundLimit } = req.body;
    const players = await Player.find({ tournamentId }).sort({ points: -1 });

    const cutoff = players[roundLimit - 1]?.points;
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

// 3. Admin manually sets match winner
const setMatchWinner = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner } = req.body;

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    match.result = winner;
    match.status = 'completed';

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

// 4. Generate knockout matches from top N players
const generateKnockoutMatches = async (req, res) => {
  try {
    const { tournamentId, topN } = req.body;
    if (!tournamentId || !topN) {
      return res.status(400).json({ message: 'tournamentId and topN are required' });
    }

    const topPlayers = await Player.find({ tournamentId }).sort({ points: -1 }).limit(topN);
    if (topPlayers.length < 2) {
      return res.status(400).json({ message: 'Not enough players for knockout' });
    }

    const shuffledPlayers = shuffle(topPlayers.map(p => p.name));
    const matches = [];

    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      if (!shuffledPlayers[i + 1]) {
        // Odd player: auto-advance
        await Match.create({
          tournamentId,
          player1: shuffledPlayers[i],
          player2: 'BYE',
          status: 'completed',
          winner: shuffledPlayers[i],
          result: 'player1'
        });
        await Player.findOneAndUpdate({ name: shuffledPlayers[i], tournamentId }, { $inc: { points: 2 } });
        continue;
      }

      const match = new Match({
        tournamentId,
        player1: shuffledPlayers[i],
        player2: shuffledPlayers[i + 1],
        status: 'upcoming',
        result: null
      });

      await match.save();
      matches.push(match);
    }

    res.status(201).json({
      message: 'Knockout round 1 matches created.',
      matches
    });

  } catch (err) {
    console.error('💥 Knockout Error:', err);
    res.status(500).json({ message: 'Server error during knockout generation' });
  }
};

// 5. Progress knockout rounds (until winner)
const progressKnockouts = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const completed = await Match.find({
      tournamentId,
      round: 'knockout',
      status: 'completed'
    });

    const winners = completed.map(m => m.winner).filter(w => w && w !== 'BYE');
    if (winners.length < 2) {
      return res.json({ message: '🏆 Tournament winner declared', winner: winners[0] || null });
    }

    const today = new Date();
    const matches = [];
    const shuffled = shuffle(winners);

    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) {
        const match = await Match.create({
          tournamentId,
          round: 'knockout',
          player1: shuffled[i],
          player2: shuffled[i + 1],
          scheduledTime: today,
          status: 'upcoming'
        });
        matches.push(match);
      } else {
        await Match.create({
          tournamentId,
          round: 'knockout',
          player1: shuffled[i],
          player2: 'BYE',
          scheduledTime: today,
          status: 'completed',
          winner: shuffled[i],
          result: 'player1'
        });
        await Player.findOneAndUpdate({ name: shuffled[i], tournamentId }, { $inc: { points: 2 } });
      }
    }

    res.json({ message: 'Next knockout round scheduled', matches });
  } catch (err) {
    console.error('Knockout progression error:', err);
    res.status(500).json({ message: 'Error progressing knockout' });
  }
};

module.exports = {
  getLeaderboard,
  qualifyPlayers,
  setMatchWinner,
  generateKnockoutMatches,
  progressKnockouts
};

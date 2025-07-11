const Player = require('../models/player');
const Match = require('../models/match');
const Tournament = require('../models/tournament');

// Helper to shuffle players
const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

// 1. Get Leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const players = await Player.find({ tournamentId }).sort({ points: -1 });
    res.json(players);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// 2. Set Rounds
exports.setRounds = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { rounds } = req.body;
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.rounds) return res.status(400).json({ message: 'Rounds already set' });

    tournament.rounds = rounds;
    await tournament.save();
    res.json({ message: 'Rounds set', rounds });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// 3. Auto Matchmaking (Rounds + Knockout + Finals)
exports.autoMatchmaking = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    const players = await Player.find({ tournamentId });
    if (players.length < 2) return res.status(400).json({ message: 'Not enough players to create matches.' });

    const allMatches = await Match.find({ tournamentId });
    const matchCount = {};
    players.forEach(p => matchCount[p.name] = 0);
    allMatches.forEach(m => {
      if (typeof m.round === 'number') {
        matchCount[m.player1]++;
        matchCount[m.player2]++;
      }
    });

    const currentRound = Math.max(0, ...Object.values(matchCount));

    if (currentRound >= tournament.rounds) {
      const unfinished = await Match.find({ tournamentId, round: currentRound, status: { $ne: 'completed' } });
      if (unfinished.length === 0) {
        const topPlayers = await Player.find({ tournamentId }).sort({ points: -1 }).limit(8);
        if (topPlayers.length < 2) {
          return res.json({ message: '🏆 Tournament winner declared automatically', winner: topPlayers[0]?.name || null });
        }

        const today = new Date();
        const matches = [];
        const shuffledTop = shuffle(topPlayers.map(p => p.name));

        for (let i = 0; i < shuffledTop.length; i += 2) {
          if (shuffledTop[i + 1]) {
            const match = await Match.create({
              tournamentId,
              round: 'knockout',
              player1: shuffledTop[i],
              player2: shuffledTop[i + 1],
              scheduledTime: today,
              status: 'upcoming'
            });
            matches.push(match);
          } else {
            await Match.create({
              tournamentId,
              round: 'knockout',
              player1: shuffledTop[i],
              player2: 'BYE',
              scheduledTime: today,
              status: 'completed',
              winner: shuffledTop[i],
              result: 'player1'
            });
            await Player.findOneAndUpdate({ name: shuffledTop[i], tournamentId }, { $inc: { points: 2 } });
          }
        }

        return res.json({ message: '✅ All rounds done. Knockout matches started.', matches });
      } else {
        return res.status(400).json({ message: `Round ${currentRound} still has matches pending.` });
      }
    }

    const unfinished = await Match.find({ tournamentId, round: currentRound, status: { $ne: 'completed' } });
    if (unfinished.length > 0) {
      return res.status(400).json({ message: `Round ${currentRound} is not completed yet.` });
    }

    const eligiblePlayers = players.filter(p => matchCount[p.name] === currentRound);
    const shuffled = shuffle(eligiblePlayers.map(p => p.name));
    const today = new Date();
    const matches = [];

    while (shuffled.length >= 2) {
      const p1 = shuffled.pop();
      const p2 = shuffled.pop();
      const match = await Match.create({
        tournamentId,
        round: currentRound + 1,
        player1: p1,
        player2: p2,
        scheduledTime: today,
        status: 'live'
      });
      matches.push(match);
    }

    if (shuffled.length === 1) {
      const byePlayer = shuffled.pop();
      await Match.create({
        tournamentId,
        round: currentRound + 1,
        player1: byePlayer,
        player2: 'BYE',
        scheduledTime: today,
        status: 'completed',
        winner: byePlayer,
        result: 'player1'
      });
      await Player.findOneAndUpdate({ name: byePlayer, tournamentId }, { $inc: { points: 2 } });
    }

    if (currentRound + 1 === tournament.rounds) {
      return res.json({ message: `Final round ${currentRound + 1} matches created. Knockout will start after it's completed.`, matches });
    }

    res.json({ message: `Round ${currentRound + 1} matches created`, matches });
  } catch (err) {
    console.error('AutoMatchmaking error:', err);
    res.status(500).json({ message: 'Server error during matchmaking' });
  }
};

// 4. Manual Matchmaking (now added)
exports.manualMatchmaking = async (req, res) => {
  try {
    const { tournamentId, player1, player2, scheduledTime, round } = req.body;

    if (!player1 || !player2 || !tournamentId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const match = await Match.create({
      tournamentId,
      player1,
      player2,
      round: round || 1,
      scheduledTime: scheduledTime || new Date(),
      status: 'upcoming'
    });

    res.json({ message: 'Manual match created', match });
  } catch (err) {
    console.error('Manual matchmaking error:', err);
    res.status(500).json({ message: 'Server error during manual match creation' });
  }
};

// 5. Set Match Winner
exports.setMatchWinner = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner } = req.body;
    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    if (![match.player1, match.player2].includes(winner)) {
      return res.status(400).json({ message: 'Invalid winner name' });
    }

    match.winner = winner;
    match.result = winner === match.player1 ? 'player1' : 'player2';
    match.status = 'completed';
    await match.save();

    if (winner !== 'BYE') {
      await Player.findOneAndUpdate({ name: winner, tournamentId: match.tournamentId }, { $inc: { points: 2 } });
    }

    res.json({ message: 'Winner set', match });
  } catch (err) {
    res.status(500).json({ message: 'Error setting winner' });
  }
};

// 6. Progress Knockout Rounds
exports.progressKnockouts = async (req, res) => {
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
    res.status(500).json({ message: 'Error progressing knockout' });
  }
};

// 7. Get Match History
exports.getMatchHistory = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({ tournamentId }).sort({ createdAt: -1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching match history' });
  }
};

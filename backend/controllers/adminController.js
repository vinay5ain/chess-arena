const Player = require('../models/player');
const Match = require('../models/match');
const Tournament = require('../models/tournament');

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

// 2. Set Rounds (locked permanently)
exports.setRounds = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { rounds } = req.body;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    if (tournament.roundsLocked) {
      return res.status(400).json({ message: 'Rounds already locked and cannot be changed' });
    }

    tournament.rounds = rounds;
    tournament.roundsLocked = true;
    await tournament.save();

    res.json({ message: 'Rounds set and locked', rounds });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// 3. Auto Matchmaking
exports.autoMatchmaking = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    const players = await Player.find({ tournamentId });
    if (players.length < 2) return res.status(400).json({ message: 'Not enough players to create matches.' });

    const totalRounds = tournament.rounds;
    const existingMatches = await Match.find({ tournamentId });
    const hasRounds = existingMatches.some(m => typeof m.round === 'number');

    // 1. Generate all rounds only once
    if (!hasRounds) {
      const allMatches = [];
      const today = new Date();

      for (let round = 1; round <= totalRounds; round++) {
        const eligiblePlayers = shuffle(players.map(p => p.name));
        while (eligiblePlayers.length >= 2) {
          const p1 = eligiblePlayers.pop();
          const p2 = eligiblePlayers.pop();
          const match = await Match.create({
            tournamentId,
            round,
            player1: p1,
            player2: p2,
            scheduledTime: today,
            status: round === 1 ? 'live' : 'upcoming'
          });
          allMatches.push(match);
        }

        if (eligiblePlayers.length === 1) {
          const byePlayer = eligiblePlayers.pop();
          await Match.create({
            tournamentId,
            round,
            player1: byePlayer,
            player2: 'BYE',
            scheduledTime: today,
            status: round === 1 ? 'completed' : 'upcoming',
            winner: round === 1 ? byePlayer : null,
            result: round === 1 ? 'player1' : null
          });

          if (round === 1) {
            await Player.findOneAndUpdate({ name: byePlayer, tournamentId }, { $inc: { points: 2 } });
          }
        }
      }

      return res.json({ message: '✅ All rounds generated. Round 1 is live.', matches: allMatches });
    }

    // 2. Check if current round is complete
    const roundMatches = existingMatches.filter(m => typeof m.round === 'number');
    const maxRound = Math.max(...roundMatches.map(m => m.round));
    const uncompleted = await Match.find({ tournamentId, round: maxRound, status: { $ne: 'completed' } });

    if (uncompleted.length > 0) {
      return res.status(400).json({ message: `Round ${maxRound} is still in progress.` });
    }

    // 3. If all rounds done → trigger knockout
    if (maxRound >= totalRounds) {
      const knockoutExists = existingMatches.some(m => m.round === 'knockout');
      if (knockoutExists) return res.json({ message: 'Knockout stage already started.' });

      const topPlayers = await Player.find({ tournamentId }).sort({ points: -1 }).limit(8);
      if (topPlayers.length < 2) {
        return res.json({ message: '🏆 Tournament winner declared automatically', winner: topPlayers[0]?.name || null });
      }

      const today = new Date();
      const shuffledTop = shuffle(topPlayers.map(p => p.name));
      const knockoutMatches = [];

      for (let i = 0; i < shuffledTop.length; i += 2) {
        if (shuffledTop[i + 1]) {
          const match = await Match.create({
            tournamentId,
            round: 'knockout',
            player1: shuffledTop[i],
            player2: shuffledTop[i + 1],
            scheduledTime: today,
            status: 'live' // ✅ live knockout match
          });
          knockoutMatches.push(match);
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

      return res.json({ message: '✅ Knockout stage started.', matches: knockoutMatches });
    }

    // 4. Promote next round to live
    const nextRound = maxRound + 1;
    const upcomingMatches = await Match.find({ tournamentId, round: nextRound, status: 'upcoming' });
    if (upcomingMatches.length > 0) {
      await Match.updateMany({ tournamentId, round: nextRound, status: 'upcoming' }, { $set: { status: 'live' } });
      return res.json({ message: `🔄 Round ${nextRound} promoted to live.`, matches: upcomingMatches });
    }

    res.json({ message: '✅ No new matches to create. Wait for current round to complete.' });

  } catch (err) {
    console.error('AutoMatchmaking error:', err);
    res.status(500).json({ message: 'Server error during matchmaking' });
  }
};

// 4. Set Match Winner
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

// 5. Progress Knockout Rounds
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
          status: 'live' // ✅ show knockout matches as live
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

// 6. Match History
exports.getMatchHistory = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({ tournamentId }).sort({ createdAt: -1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching match history' });
  }
};

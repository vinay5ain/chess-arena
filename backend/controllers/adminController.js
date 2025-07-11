const Player = require('../models/player');
const Match = require('../models/match');
const Tournament = require('../models/tournament');

const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

// 1. Leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const players = await Player.find({ tournamentId }).sort({ points: -1 });

    let winnerName = null;
    let runnerUpName = null;
    let thirdPlaceName = null;

    const finalMatch = await Match.findOne({ tournamentId, round: 'final', status: 'completed' });
    if (finalMatch) {
      winnerName = finalMatch.winner;
      runnerUpName = finalMatch.winner === finalMatch.player1 ? finalMatch.player2 : finalMatch.player1;
    }

    const semiFinalMatch = await Match.findOne({ tournamentId, round: 'semi-final', status: 'completed' });
    if (semiFinalMatch) {
      const semiLoser = semiFinalMatch.winner === semiFinalMatch.player1 ? semiFinalMatch.player2 : semiFinalMatch.player1;
      thirdPlaceName = semiLoser;
    } else {
      const knockoutMatches = await Match.find({ tournamentId, round: 'knockout', status: 'completed' });
      const allPlayers = knockoutMatches.flatMap(m => [m.player1, m.player2]);
      const winners = knockoutMatches.map(m => m.winner);
      const losers = allPlayers.filter(p => !winners.includes(p) && p !== 'BYE');

      const sortedLosers = (await Player.find({ tournamentId }))
        .filter(p => losers.includes(p.name))
        .sort((a, b) => b.points - a.points);

      if (sortedLosers.length) thirdPlaceName = sortedLosers[0].name;
    }

    const leaderboard = players.map(p => {
      let label = p.name;
      if (label === winnerName) label += ' 👑';
      else if (label === runnerUpName) label += ' 🥈';
      else if (label === thirdPlaceName) label += ' 🥉';

      return { ...p.toObject(), name: label };
    });

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: 'Leaderboard error' });
  }
};

// 2. Lock rounds
exports.setRounds = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { rounds } = req.body;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    if (tournament.roundsLocked) {
      return res.status(400).json({ message: 'Rounds already locked' });
    }

    tournament.rounds = rounds;
    tournament.roundsLocked = true;
    await tournament.save();

    res.json({ message: 'Rounds set and locked', rounds });
  } catch (err) {
    res.status(500).json({ message: 'Set rounds error' });
  }
};

// 3. Auto Matchmaking
exports.autoMatchmaking = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findById(tournamentId);
    const players = await Player.find({ tournamentId });
    const today = new Date();

    if (!tournament || players.length < 2) return res.status(400).json({ message: 'Invalid tournament or players' });

    const totalRounds = tournament.rounds;
    const allMatches = await Match.find({ tournamentId });
    const hasNumbered = allMatches.some(m => typeof m.round === 'number');

    // 🧾 Generate rounds if not already done
    if (!hasNumbered) {
      const byeHistory = new Set();

      for (let round = 1; round <= totalRounds; round++) {
        const roundPlayers = shuffle([...players.map(p => p.name)]);
        while (roundPlayers.length >= 2) {
          const p1 = roundPlayers.pop();
          const p2 = roundPlayers.pop();
          await Match.create({
            tournamentId,
            round,
            player1: p1,
            player2: p2,
            scheduledTime: today,
            status: round === 1 ? 'live' : 'upcoming'
          });
        }

        if (roundPlayers.length === 1) {
          const byePlayer = roundPlayers.pop();
          if (!byeHistory.has(byePlayer)) {
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

            byeHistory.add(byePlayer);
            if (round === 1) {
              await Player.findOneAndUpdate({ name: byePlayer, tournamentId }, { $inc: { points: 2 } });
            }
          }
        }
      }

      return res.json({ message: '✅ All rounds generated. Round 1 is live.' });
    }

    // ✅ Advance rounds
    const numberMatches = await Match.find({ tournamentId, round: { $type: 'number' } });
    const completedRounds = [...new Set(numberMatches.map(m => m.round))]
      .filter(r => numberMatches.filter(m => m.round === r).every(m => m.status === 'completed'))
      .sort((a, b) => a - b);

    const lastCompletedRound = completedRounds.at(-1) || 0;
    const nextRound = lastCompletedRound + 1;

    // Promote next round to live
    const nextRoundMatches = await Match.find({ tournamentId, round: nextRound, status: 'upcoming' });
    if (nextRoundMatches.length) {
      await Match.updateMany({ tournamentId, round: nextRound, status: 'upcoming' }, { status: 'live' });
      return res.json({ message: `🔄 Promoted Round ${nextRound} to live.`, matches: nextRoundMatches });
    }

    // 🏁 Knockout logic
    const knockoutMatches = await Match.find({ tournamentId, round: 'knockout' });
    const semiFinalMatch = await Match.findOne({ tournamentId, round: 'semi-final' });
    const finalMatch = await Match.findOne({ tournamentId, round: 'final' });

    if (finalMatch && finalMatch.status === 'completed') {
      return res.json({ message: '🏆 Final completed', winner: finalMatch.winner });
    }

    // ➕ Final after semi-final
    if (semiFinalMatch && semiFinalMatch.status === 'completed' && !finalMatch) {
      const semiWinner = semiFinalMatch.winner;
      const topScorer = (await Player.find({ tournamentId }).sort({ points: -1 })).find(p => p.name !== semiWinner);

      if (topScorer) {
        const final = await Match.create({
          tournamentId,
          round: 'final',
          player1: topScorer.name,
          player2: semiWinner,
          scheduledTime: today,
          status: 'live'
        });

        return res.json({ message: '👑 Final match created', match: final });
      }
    }

    // ➕ Semi-final if odd winners
    if (lastCompletedRound >= totalRounds && knockoutMatches.every(m => m.status === 'completed') && !finalMatch && !semiFinalMatch) {
      const winners = knockoutMatches.map(m => m.winner).filter(w => w !== 'BYE');
      const top = await Player.find({ tournamentId }).then(all => all.filter(p => winners.includes(p.name)).sort((a, b) => b.points - a.points));

      if (winners.length === 1) {
        return res.json({ message: '🏆 Auto-winner', winner: winners[0] });
      }

      if (winners.length % 2 === 1) {
        const finalist = top[0].name;
        const [p1, p2] = shuffle(winners.filter(w => w !== finalist));
        await Match.create({ tournamentId, round: 'semi-final', player1: p1, player2: p2, scheduledTime: today, status: 'live' });
        return res.json({ message: `🔁 Semi-final match created between ${p1} and ${p2}. Finalist waiting: ${finalist}` });
      }

      const final = await Match.create({ tournamentId, round: 'final', player1: top[0].name, player2: top[1].name, scheduledTime: today, status: 'live' });
      return res.json({ message: '👑 Final match created.', match: final });
    }

    // ➕ Knockout start
    if (lastCompletedRound >= totalRounds && knockoutMatches.length === 0) {
      const topPlayers = await Player.find({ tournamentId }).sort({ points: -1 }).limit(8);
      const names = shuffle(topPlayers.map(p => p.name));

      for (let i = 0; i < names.length; i += 2) {
        if (names[i + 1]) {
          await Match.create({ tournamentId, round: 'knockout', player1: names[i], player2: names[i + 1], scheduledTime: today, status: 'live' });
        } else {
          await Match.create({ tournamentId, round: 'knockout', player1: names[i], player2: 'BYE', scheduledTime: today, status: 'completed', winner: names[i], result: 'player1' });
          await Player.findOneAndUpdate({ name: names[i], tournamentId }, { $inc: { points: 2 } });
        }
      }

      return res.json({ message: '✅ Knockout started.' });
    }

    res.json({ message: '✅ Waiting for match completions' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Auto matchmaking error' });
  }
};

// 4. Set Winner
exports.setMatchWinner = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner } = req.body;

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    match.winner = winner;
    match.result = winner === match.player1 ? 'player1' : 'player2';
    match.status = 'completed';
    await match.save();

    if (winner !== 'BYE') {
      await Player.findOneAndUpdate({ name: winner, tournamentId: match.tournamentId }, { $inc: { points: 2, wins: 1 } });

      const loser = winner === match.player1 ? match.player2 : match.player1;
      if (loser !== 'BYE') {
        await Player.findOneAndUpdate({ name: loser, tournamentId: match.tournamentId }, { $inc: { losses: 1 } });
      }
    }

    res.json({ message: 'Winner set successfully', match });
  } catch (err) {
    res.status(500).json({ message: 'Error setting winner' });
  }
};

// 5. Match History
exports.getMatchHistory = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({ tournamentId }).sort({ createdAt: -1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching matches' });
  }
};

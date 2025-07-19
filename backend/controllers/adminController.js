const Player = require('../models/player');
const Match = require('../models/match');
const Tournament = require('../models/tournament');

const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

// 1. Leaderboard with 👑 🥈 🥉
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
      const allKnockoutPlayers = knockoutMatches.flatMap(m => [m.player1, m.player2]);
      const knockoutWinners = knockoutMatches.map(m => m.winner);
      const knockoutLosers = allKnockoutPlayers.filter(p => !knockoutWinners.includes(p) && p !== 'BYE');

      const allPlayers = await Player.find({ tournamentId });
      const sortedLosers = allPlayers
        .filter(p => knockoutLosers.includes(p.name))
        .sort((a, b) => b.points - a.points);

      if (sortedLosers.length > 0) {
        thirdPlaceName = sortedLosers[0].name;
      }
    }

    const leaderboard = players.map(player => {
      let displayName = player.name;
      if (player.name === winnerName) {
        displayName += ' 👑';
      } else if (player.name === runnerUpName) {
        displayName += ' 🥈';
      } else if (player.name === thirdPlaceName) {
        displayName += ' 🥉';
      }
      return {
        ...player.toObject(),
        name: displayName
      };
    });

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// 2. Set Rounds (locked once)
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
    if (players.length < 2) return res.status(400).json({ message: 'Not enough players' });

    const totalRounds = tournament.rounds;
    const existingMatches = await Match.find({ tournamentId });
    const today = new Date();
    const hasNumberedRounds = existingMatches.some(m => typeof m.round === 'number');

    if (!hasNumberedRounds) {
      const byeHistory = new Set();
      for (let round = 1; round <= totalRounds; round++) {
        const roundPlayers = shuffle(players.map(p => p.name));
        while (roundPlayers.length >= 2) {
          const p1 = roundPlayers.pop();
          const p2 = roundPlayers.pop();
          await Match.create({ tournamentId, round, player1: p1, player2: p2, scheduledTime: today, status: round === 1 ? 'live' : 'upcoming' });
        }

        if (roundPlayers.length === 1) {
          const byePlayer = roundPlayers.pop();
          if (!byeHistory.has(byePlayer)) {
            await Match.create({
              tournamentId, round,
              player1: byePlayer, player2: 'BYE',
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

    const numberMatches = await Match.find({ tournamentId, round: { $type: 'number' } });
    const rounds = [...new Set(numberMatches.map(m => m.round))].sort((a, b) => a - b);
    let lastCompletedRound = 0;
    for (const r of rounds) {
      const matchesInRound = numberMatches.filter(m => m.round === r);
      if (matchesInRound.every(m => m.status === 'completed')) lastCompletedRound = r;
      else break;
    }

    const nextRound = lastCompletedRound + 1;

    const knockoutMatches = await Match.find({ tournamentId, round: 'knockout' });
    const finalMatch = await Match.findOne({ tournamentId, round: 'final' });
    const semiFinalMatch = await Match.findOne({ tournamentId, round: 'semi-final' });
    const knockoutCompleted = knockoutMatches.length > 0 && knockoutMatches.every(m => m.status === 'completed');

    if (finalMatch && finalMatch.status === 'completed') {
      return res.json({ message: '🏆 Tournament winner declared', winner: finalMatch.winner });
    }

    if (semiFinalMatch && semiFinalMatch.status === 'completed' && !finalMatch) {
      const semiWinner = semiFinalMatch.winner;
      const topPlayers = await Player.find({ tournamentId }).sort({ points: -1 });
      const topScorer = topPlayers.find(p => p.name !== semiWinner);

      const final = await Match.create({
        tournamentId, round: 'final',
        player1: topScorer.name, player2: semiWinner,
        scheduledTime: today, status: 'live'
      });

      return res.json({ message: '👑 Final match created (after semi-final)', match: final });
    }

    if (lastCompletedRound >= totalRounds && knockoutCompleted && !finalMatch && !semiFinalMatch) {
      const winners = knockoutMatches.filter(m => m.winner && m.winner !== 'BYE').map(m => m.winner);
      const topPlayers = await Player.find({ tournamentId });
      const sorted = topPlayers.filter(p => winners.includes(p.name)).sort((a, b) => b.points - a.points);

      if (winners.length === 1) {
        return res.json({ message: '🏆 Tournament winner declared', winner: winners[0] });
      }

      if (winners.length % 2 === 1) {
        const finalist = sorted[0].name;
        const contenders = winners.filter(w => w !== finalist);
        const [p1, p2] = shuffle(contenders);
        await Match.create({
          tournamentId, round: 'semi-final',
          player1: p1, player2: p2,
          scheduledTime: today, status: 'live'
        });
        return res.json({ message: `🔁 Semi-final: ${p1} vs ${p2}. Winner will face ${finalist}.` });
      }

      const final = await Match.create({
        tournamentId, round: 'final',
        player1: sorted[0].name, player2: sorted[1].name,
        scheduledTime: today, status: 'live'
      });
      return res.json({ message: '👑 Final match created', match: final });
    }

    // ✅ Knockout logic for unlimited players (fix applied here)
    if (lastCompletedRound >= totalRounds && knockoutMatches.length === 0) {
      const topPlayers = await Player.find({ tournamentId }).sort({ points: -1 }); // FIX: removed limit(8)

      const shuffledTop = shuffle(topPlayers.map(p => p.name));
      const matches = [];

      for (let i = 0; i < shuffledTop.length; i += 2) {
        if (shuffledTop[i + 1]) {
          const match = await Match.create({
            tournamentId, round: 'knockout',
            player1: shuffledTop[i], player2: shuffledTop[i + 1],
            scheduledTime: today, status: 'live'
          });
          matches.push(match);
        } else {
          await Match.create({
            tournamentId, round: 'knockout',
            player1: shuffledTop[i], player2: 'BYE',
            scheduledTime: today, status: 'completed',
            winner: shuffledTop[i], result: 'player1'
          });
          await Player.findOneAndUpdate({ name: shuffledTop[i], tournamentId }, { $inc: { points: 2 } });
        }
      }

      return res.json({ message: '✅ Knockout stage started.', matches });
    }

    const upcoming = await Match.find({ tournamentId, round: nextRound, status: 'upcoming' });
    if (upcoming.length > 0) {
      await Match.updateMany({ tournamentId, round: nextRound, status: 'upcoming' }, { $set: { status: 'live' } });
      return res.json({ message: `🔄 Round ${nextRound} promoted to live.`, matches: upcoming });
    }

    res.json({ message: '✅ All matches handled. Waiting for completions.' });

  } catch (err) {
    console.error('AutoMatchmaking error:', err);
    res.status(500).json({ message: 'Server error during matchmaking' });
  }
};

// 4. Set Winner
exports.setMatchWinner = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner } = req.body;

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    if (![match.player1, match.player2].includes(winner)) {
      return res.status(400).json({ message: 'Invalid winner' });
    }

    match.winner = winner;
    match.result = winner === match.player1 ? 'player1' : 'player2';
    match.status = 'completed';
    await match.save();

    if (winner !== 'BYE') {
      // Update winner
      await Player.findOneAndUpdate(
        { name: winner, tournamentId: match.tournamentId },
        { $inc: { points: 2, wins: 1 } }
      );

      // Identify and update loser
      const loser = winner === match.player1 ? match.player2 : match.player1;
      await Player.findOneAndUpdate(
        { name: loser, tournamentId: match.tournamentId },
        { $inc: { losses: 1 } }
      );
    }

    res.json({ message: 'Winner set', match });
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
    res.status(500).json({ message: 'Error fetching match history' });
  }
};

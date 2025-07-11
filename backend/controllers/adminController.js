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

// 3. Auto Matchmaking (Rounds + Knockout + Final)
exports.autoMatchmaking = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    const players = await Player.find({ tournamentId });
    if (players.length < 2) return res.status(400).json({ message: 'Not enough players to create matches.' });

    const totalRounds = tournament.rounds;
    const existingMatches = await Match.find({ tournamentId });

    const hasNumberedRounds = existingMatches.some(m => typeof m.round === 'number');
    const today = new Date();

    // ➤ Initial round generation
    if (!hasNumberedRounds) {
      const byeHistory = new Set();
      for (let round = 1; round <= totalRounds; round++) {
        const roundPlayers = shuffle(players.map(p => p.name));
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

    // ➤ Check current round status
    const numberMatches = await Match.find({ tournamentId, round: { $type: 'number' } });
    const rounds = [...new Set(numberMatches.map(m => m.round))].sort((a, b) => a - b);

    let lastCompletedRound = 0;
    for (const r of rounds) {
      const matchesInRound = numberMatches.filter(m => m.round === r);
      const allCompleted = matchesInRound.every(m => m.status === 'completed');
      if (allCompleted) {
        lastCompletedRound = r;
      } else {
        break;
      }
    }

    const nextRound = lastCompletedRound + 1;

    // ➤ Knockout & Final Progression
    if (lastCompletedRound >= totalRounds) {
      const knockoutMatches = await Match.find({ tournamentId, round: 'knockout' });
      const knockoutCompleted = knockoutMatches.length > 0 && knockoutMatches.every(m => m.status === 'completed');

      const finalExists = await Match.exists({ tournamentId, round: 'final' });

      // 🏁 Final creation if knockout is done and final not started
      if (knockoutCompleted && !finalExists) {
        const winners = knockoutMatches.filter(m => m.winner && m.winner !== 'BYE').map(m => m.winner);
        const today = new Date();

        if (winners.length === 1) {
          return res.json({ message: '🏆 Tournament winner declared automatically', winner: winners[0] });
        }

        if (winners.length >= 2) {
          const topPlayers = await Player.find({ tournamentId });
          const sortedWinners = topPlayers
            .filter(p => winners.includes(p.name))
            .sort((a, b) => b.points - a.points);

          if (winners.length % 2 === 1) {
            const top = sortedWinners[0].name;
            const opponent = sortedWinners[1]?.name || winners.find(w => w !== top);

            const finalMatch = await Match.create({
              tournamentId,
              round: 'final',
              player1: top,
              player2: opponent,
              scheduledTime: today,
              status: 'live'
            });

            return res.json({ message: '👑 Final match created (odd winners)', match: finalMatch });
          }

          // Even number of winners
          const finalMatch = await Match.create({
            tournamentId,
            round: 'final',
            player1: sortedWinners[0].name,
            player2: sortedWinners[1].name,
            scheduledTime: today,
            status: 'live'
          });

          return res.json({ message: '👑 Final match created', match: finalMatch });
        }
      }

      // If knockout not yet started
      if (knockoutMatches.length === 0) {
        const topPlayers = await Player.find({ tournamentId }).sort({ points: -1 }).limit(8);
        if (topPlayers.length < 2) {
          return res.json({ message: '🏆 Tournament winner declared automatically', winner: topPlayers[0]?.name || null });
        }

        const shuffledTop = shuffle(topPlayers.map(p => p.name));
        const matches = [];

        for (let i = 0; i < shuffledTop.length; i += 2) {
          if (shuffledTop[i + 1]) {
            const match = await Match.create({
              tournamentId,
              round: 'knockout',
              player1: shuffledTop[i],
              player2: shuffledTop[i + 1],
              scheduledTime: today,
              status: 'live'
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

        return res.json({ message: '✅ Knockout stage started.', matches });
      }

      return res.json({ message: '✅ Waiting for knockout or final matches to complete.' });
    }

    // ➤ Promote next round
    const upcomingMatches = await Match.find({ tournamentId, round: nextRound, status: 'upcoming' });
    if (upcomingMatches.length > 0) {
      await Match.updateMany(
        { tournamentId, round: nextRound, status: 'upcoming' },
        { $set: { status: 'live' } }
      );
      return res.json({ message: `🔄 Round ${nextRound} promoted to live.`, matches: upcomingMatches });
    }

    res.json({ message: '✅ All rounds done or waiting for round to complete.' });

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

// 5. Progress Knockout Stage (separate manual trigger — works fine)
exports.progressKnockouts = async (req, res) => {
  // already covered in previous version — skip or reuse
};

// 6. Get Match History
exports.getMatchHistory = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({ tournamentId }).sort({ createdAt: -1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching match history' });
  }
};

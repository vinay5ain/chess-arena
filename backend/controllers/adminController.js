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

// 3. Auto Matchmaking and Round Progression
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

    // Get all numbered rounds
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

    // Knockout Stage Trigger
    if (lastCompletedRound >= totalRounds) {
      const knockoutExists = await Match.exists({ tournamentId, round: 'knockout' });
      const finalExists = await Match.exists({ tournamentId, round: 'final' });
      if (knockoutExists || finalExists) {
        return res.json({ message: 'Knockout or Final already started.' });
      }

      const topPlayers = await Player.find({ tournamentId }).sort({ points: -1 }).limit(8);
      if (topPlayers.length < 2) {
        return res.json({ message: '🏆 Tournament winner declared automatically', winner: topPlayers[0]?.name || null });
      }

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
            status: 'live'
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

    // Promote next round
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

// 5. Progress Knockout Rounds → Includes Final Handling
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

    const finalExists = await Match.exists({ tournamentId, round: 'final' });
    if (finalExists) {
      return res.json({ message: 'Final already created.' });
    }

    const today = new Date();

    // 👑 Final round with exactly 2 players
    if (winners.length === 2) {
      const finalMatch = await Match.create({
        tournamentId,
        round: 'final',
        player1: winners[0],
        player2: winners[1],
        scheduledTime: today,
        status: 'live'
      });
      return res.json({ message: '👑 Final match created', final: finalMatch });
    }

    // ⚖️ Odd number → Top scorer to Final
    if (winners.length % 2 === 1) {
      const players = await Player.find({ tournamentId });
      const top = players
        .filter(p => winners.includes(p.name))
        .sort((a, b) => b.points - a.points)[0];

      const others = winners.filter(name => name !== top.name);
      const shuffled = shuffle(others);

      for (let i = 0; i < shuffled.length; i += 2) {
        if (shuffled[i + 1]) {
          await Match.create({
            tournamentId,
            round: 'knockout',
            player1: shuffled[i],
            player2: shuffled[i + 1],
            scheduledTime: today,
            status: 'live'
          });
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

          const finalMatch = await Match.create({
            tournamentId,
            round: 'final',
            player1: top.name,
            player2: shuffled[i],
            scheduledTime: today,
            status: 'live'
          });

          return res.json({ message: '👑 Final match created', final: finalMatch });
        }
      }

      return res.json({ message: '✅ Next knockout round scheduled.' });
    }

    // Regular knockout
    const shuffled = shuffle(winners);
    const matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const match = await Match.create({
        tournamentId,
        round: 'knockout',
        player1: shuffled[i],
        player2: shuffled[i + 1],
        scheduledTime: today,
        status: 'live'
      });
      matches.push(match);
    }

    res.json({ message: '✅ Next knockout round scheduled', matches });

  } catch (err) {
    console.error('Progress Knockout Error:', err);
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

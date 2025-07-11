const Player = require('../models/player');
const Match = require('../models/match');
const Tournament = require('../models/tournament');

const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

// 1. Leaderboard with 👑 🥈 🥉
exports.getLeaderboard = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const players = await Player.find({ tournamentId }).sort({ points: -1 });

    let winnerName = null, runnerUpName = null, thirdPlaceName = null;

    const final = await Match.findOne({ tournamentId, round: 'final', status: 'completed' });
    if (final) {
      winnerName = final.winner;
      runnerUpName = final.winner === final.player1 ? final.player2 : final.player1;
    }

    const semi = await Match.findOne({ tournamentId, round: 'semi-final', status: 'completed' });
    if (semi) {
      const loser = semi.winner === semi.player1 ? semi.player2 : semi.player1;
      thirdPlaceName = loser;
    } else {
      const km = await Match.find({ tournamentId, round: 'knockout', status: 'completed' });
      const losers = km
        .flatMap(m => [m.player1, m.player2])
        .filter(p => !km.map(x => x.winner).includes(p) && p !== 'BYE');
      const topLoser = (await Player.find({ tournamentId }))
        .filter(p => losers.includes(p.name))
        .sort((a, b) => b.points - a.points)[0];
      if (topLoser) thirdPlaceName = topLoser.name;
    }

    const board = players.map(p => {
      let n = p.name;
      if (n === winnerName) n += ' 👑';
      else if (n === runnerUpName) n += ' 🥈';
      else if (n === thirdPlaceName) n += ' 🥉';
      return { ...p.toObject(), name: n };
    });

    res.json(board);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// 2. Set Rounds
exports.setRounds = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { rounds } = req.body;
    const t = await Tournament.findById(tournamentId);
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (t.roundsLocked) return res.status(400).json({ message: 'Locked' });
    t.rounds = rounds; t.roundsLocked = true;
    await t.save();
    res.json({ message: 'Rounds set and locked', rounds });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// 3. Auto Matchmaking — includes knockout ⇒ semi ⇒ final logic
exports.autoMatchmaking = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tour = await Tournament.findById(tournamentId);
    if (!tour) return res.status(404).json({ message: 'Tournament not found' });
    const players = await Player.find({ tournamentId });
    if (players.length < 2) return res.status(400).json({ message: 'Not enough players' });

    const totalRounds = tour.rounds;
    const today = new Date();

    const existing = await Match.find({ tournamentId });
    const roundNumberedExists = existing.some(m => typeof m.round === 'number');

    // 1️⃣ Generate numbered rounds:
    if (!roundNumberedExists) {
      const bye = new Set();
      for (let r = 1; r <= totalRounds; r++) {
        const arr = shuffle(players.map(p => p.name));
        while (arr.length >= 2) {
          const p1 = arr.pop(), p2 = arr.pop();
          await Match.create({ tournamentId, round: r, player1: p1, player2: p2,
            scheduledTime: today, status: (r === 1 ? 'live' : 'upcoming') });
        }
        if (arr.length === 1) {
          const p = arr.pop();
          if (!bye.has(p)) {
            await Match.create({
              tournamentId, round: r, player1: p, player2: 'BYE',
              scheduledTime: today,
              status: (r === 1 ? 'completed' : 'upcoming'),
              winner: (r === 1 ? p : null),
              result: (r === 1 ? 'player1' : null)
            });
            bye.add(p);
            if (r === 1) await Player.findOneAndUpdate({ tournamentId, name: p }, { $inc: { points: 2 } });
          }
        }
      }

      return res.json({ message: '✅ All rounds created, Round 1 is live' });
    }

    // 2️⃣ Promote numbered rounds to live
    const numberedMatches = await Match.find({ tournamentId, round: { $type: 'number' } });
    const completedNumbers = [...new Set(numberedMatches.map(m => m.round))]
      .filter(r => numberedMatches.filter(m => m.round === r).every(m => m.status === 'completed'))
      .sort((a, b) => a - b);
    const lastNum = completedNumbers.pop() || 0;
    const nextNum = lastNum + 1;
    const nextBatch = await Match.find({ tournamentId, round: nextNum, status: 'upcoming' });
    if (nextBatch.length) {
      await Match.updateMany({ tournamentId, round: nextNum, status: 'upcoming' }, { status: 'live' });
      return res.json({ message: `🔁 Round ${nextNum} is now live`, matches: nextBatch });
    }

    // 3️⃣ Knockout ⇒ semi ⇒ final
    const knockoutMatches = await Match.find({ tournamentId, round: 'knockout' });
    const semi = await Match.findOne({ tournamentId, round: 'semi-final' });
    const final = await Match.findOne({ tournamentId, round: 'final' });

    if (final && final.status === 'completed') {
      return res.json({ message: '🏆 Tournament concluded', winner: final.winner });
    }

    if (semi && semi.status === 'completed' && !final) {
      const semiWin = semi.winner;
      const compKnockout = await Match.find({ tournamentId, round: 'knockout', status: 'completed' });
      const survivors = [...new Set(compKnockout.map(m => m.winner))].filter(n => n !== semiWin);

      if (survivors.length === 1) {
        const finMatch = await Match.create({
          tournamentId, round: 'final', player1: survivors[0], player2: semiWin,
          scheduledTime: today, status: 'live'
        });
        return res.json({ message: '👑 Final created', match: finMatch });
      }
    }

    // Who's left?
    const winnersSoFar = (await Match.find({
      tournamentId,
      round: { $in: ['knockout', 'semi-final'] },
      status: 'completed'
    })).map(m => m.winner).filter(w => w && w !== 'BYE');
    let active = [...new Set(winnersSoFar)];

    if (knockoutMatches.length === 0 && active.length === 0) {
      const top8 = await Player.find({ tournamentId }).sort({ points: -1 }).limit(8);
      active = top8.map(p => p.name);
    }

    if (active.length === 1) {
      return res.json({ message: '🏆 Winner declared', winner: active[0] });
    }

    if (active.length === 2 && !final) {
      const [p1, p2] = shuffle(active);
      const fn = await Match.create({
        tournamentId, round: 'final', player1: p1, player2: p2,
        scheduledTime: today, status: 'live'
      });
      return res.json({ message: '👑 Final created', match: fn });
    }

    if (active.length === 3 && !semi && !final) {
      const [finalist, a, b] = shuffle(active);
      const sf = await Match.create({
        tournamentId, round: 'semi-final', player1: a, player2: b,
        scheduledTime: today, status: 'live'
      });
      return res.json({ message: `🔁 Semi: ${a} vs ${b}`, match: sf });
    }

    if (active.length > 3 && knockoutMatches.every(m => m.status === 'completed')) {
      const arr = shuffle(active);
      const created = [];
      for (let i = 0; i < arr.length; i += 2) {
        if (arr[i + 1]) {
          created.push(await Match.create({
            tournamentId, round: 'knockout',
            player1: arr[i], player2: arr[i + 1],
            scheduledTime: today, status: 'live'
          }));
        } else {
          await Match.create({
            tournamentId, round: 'knockout',
            player1: arr[i], player2: 'BYE',
            scheduledTime: today, status: 'completed',
            winner: arr[i], result: 'player1'
          });
          await Player.findOneAndUpdate({ tournamentId, name: arr[i] }, { $inc: { points: 2 } });
        }
      }
      return res.json({ message: '🎯 Next knockout round begun', matches: created });
    }

    return res.json({ message: '⏳ Waiting for ongoing matches' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during matchmaking' });
  }
};

// 4. Set Winner (tracks wins, points, losses)
exports.setMatchWinner = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { winner } = req.body;
    const m = await Match.findById(matchId);
    if (!m) return res.status(404).json({ message: 'Match not found' });

    if (![m.player1, m.player2].includes(winner)) return res.status(400).json({ message: 'Invalid winner' });

    m.winner = winner;
    m.result = winner === m.player1 ? 'player1' : 'player2';
    m.status = 'completed';
    await m.save();

    if (winner !== 'BYE') {
      await Player.findOneAndUpdate(
        { tournamentId: m.tournamentId, name: winner },
        { $inc: { points: 2, wins: 1 } }
      );
      const loser = winner === m.player1 ? m.player2 : m.player1;
      if (loser && loser !== 'BYE') {
        await Player.findOneAndUpdate(
          { tournamentId: m.tournamentId, name: loser },
          { $inc: { losses: 1 } }
        );
      }
    }

    res.json({ message: '✅ Winner set', match: m });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error setting winner' });
  }
};

// 5. Match history
exports.getMatchHistory = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const h = await Match.find({ tournamentId }).sort({ createdAt: -1 });
    res.json(h);
  } catch {
    res.status(500).json({ message: 'Error fetching history' });
  }
};
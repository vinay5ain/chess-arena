const Player = require('../models/player');
const Match = require('../models/match');
const Tournament = require('../models/tournament');

exports.runTournament = async (req, res) => {
  try {
    const { tournamentId, qualifyingCount } = req.body;
    if (!tournamentId || !qualifyingCount) {
      return res.status(400).json({ message: 'Provide tournamentId and qualifyingCount.' });
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found.' });

    // 1. Get all players and sort by points
    let players = await Player.find({ tournamentId }).sort({ points: -1 });
    if (players.length < 3) {
      return res.status(400).json({ message: 'At least 3 players are required.' });
    }

    const qualifiers = players.slice(0, qualifyingCount);
    const lastScore = qualifiers[qualifyingCount - 1].points;
    const tied = players.filter(p => p.points === lastScore && !qualifiers.includes(p));

    // 2. If there's a tie for the last qualifying spot → tie-breaker knockout
    if (tied.length > 0) {
      let winners = await runKnockoutTieBooster(qualifyingCount - tied.length, tied, tournamentId);
      players = players.filter(p => !tied.includes(p));
      players = players.concat(winners);
    }

    // 3. Trim to qualifyingCount
    const finalPool = players.slice(0, qualifyingCount);

    // 4. Handle top-3 logic
    if (finalPool.length === 3) {
      const [p1, p2, p3] = finalPool;
      const match1 = await createMatch(p1.name, p2.name, tournamentId, 'top3');
      const winner1 = await waitForCompletion(match1);

      const loser1 = winner1 === p1.name ? p2.name : p1.name;
      const match2 = await createMatch(loser1, p3.name, tournamentId, 'top3-decider');
      const winner2 = await waitForCompletion(match2);

      const finalMatch = await createMatch(winner1, winner2, tournamentId, 'final');
      const champion = await waitForCompletion(finalMatch);

      return res.json({ message: 'Tournament finished', champion });
    }

    // 5. Handle knockout rounds for >3 players
    let contenders = finalPool.map(p => p.name);
    while (contenders.length > 2) {
      const matches = await scheduleKnockoutRound(contenders, tournamentId);
      const winners = [];
      for (let m of matches) {
        winners.push(await waitForCompletion(m));
      }
      contenders = winners;
    }

    // 6. Final match
    const finalMatch = await createMatch(contenders[0], contenders[1], tournamentId, 'final');
    const champion = await waitForCompletion(finalMatch);

    res.json({ message: 'Tournament finished', champion });
  } catch (err) {
    console.error('Tournament run error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

async function runKnockoutTieBooster(freeSlots, tiedPlayers, tournamentId) {
  // Recursively eliminate tied players until freeSlots are filled
  let names = tiedPlayers.map(p => p.name);
  const winners = [];
  while (winners.length < freeSlots) {
    let m = await createMatch(names[0], names[1] || names[0], tournamentId, 'tie-breaker');
    const win = await waitForCompletion(m);
    winners.push(win);
    names = names.filter(n => n !== win);
    if (names.length === 1 && winners.length < freeSlots) {
      winners.push(names[0]);
    }
  }
  return winners.map(name => tiedPlayers.find(p => p.name === name));
}

async function createMatch(player1, player2, tournamentId, roundLabel) {
  return Match.create({
    tournamentId,
    player1,
    player2,
    scheduledTime: new Date(),
    status: 'upcoming',
    round: roundLabel
  });
}

async function waitForCompletion(match) {
  // Poll match until it's completed
  while (true) {
    await new Promise(r => setTimeout(r, 1000));
    const m = await Match.findById(match._id);
    if (m.status === 'completed' && m.winner) {
      return m.winner;
    }
  }
}

async function scheduleKnockoutRound(names, tournamentId) {
  const matches = [];
  for (let i = 0; i < names.length; i += 2) {
    const p1 = names[i];
    const p2 = names[i + 1] || names[i]; // if odd, rematch or self-play
    matches.push(await createMatch(p1, p2, tournamentId, 'knockout'));
  }
  return matches;
}

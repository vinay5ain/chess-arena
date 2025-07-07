const Player = require('../models/Player');
const Match = require('../models/Match');

// Helper to shuffle players randomly
const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

// Create knockout matches
const generateKnockoutMatches = async (req, res) => {
  try {
    const { tournamentId, topN } = req.body;

    if (!tournamentId || !topN) {
      return res.status(400).json({ message: 'tournamentId and topN are required' });
    }

    // Get topN players by points
    const topPlayers = await Player.find({ tournamentId })
      .sort({ points: -1 })
      .limit(topN);

    if (topPlayers.length < 2) {
      return res.status(400).json({ message: 'Not enough players for knockout' });
    }

    const shuffledPlayers = shuffle(topPlayers.map(p => p.name));

    const matches = [];
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      if (!shuffledPlayers[i + 1]) {
        // Odd player out gets a bye (auto-wins to next round)
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

module.exports = { generateKnockoutMatches };

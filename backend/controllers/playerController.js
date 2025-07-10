const Match = require('../models/match');
const mongoose = require('mongoose');

// ✅ Create Match
const createMatch = async (req, res) => {
  try {
    const { tournamentId, player1, player2, scheduledTime, round, status } = req.body;

    if (!tournamentId || !player1 || !player2 || !scheduledTime || round === undefined) {
      return res.status(400).json({ message: 'All fields including round are required.' });
    }

    const match = new Match({
      tournamentId,
      player1,
      player2,
      scheduledTime,
      round,
      status: status || 'upcoming'
    });

    await match.save();
    res.status(201).json({ message: 'Match created.', matchId: match._id });
  } catch (err) {
    console.error('Error creating match:', err.message);
    res.status(500).json({ message: 'Server error while creating match.' });
  }
};

// ✅ Get Live Matches
const getLiveMatches = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({
      tournamentId,
      status: 'live',
      winner: { $in: [null, '', undefined] },
      round: { $ne: null }
    });
    res.status(200).json(matches);
  } catch (err) {
    console.error('Error fetching live matches:', err);
    res.status(500).json({ message: 'Error fetching live matches.' });
  }
};

// ✅ Get Upcoming Matches
const getUpcomingMatches = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({
      tournamentId,
      status: 'upcoming',
      round: { $ne: null }
    });
    res.status(200).json(matches);
  } catch (err) {
    console.error('Error fetching upcoming matches:', err);
    res.status(500).json({ message: 'Error fetching upcoming matches.' });
  }
};

// ✅ Get Completed Matches
const getPastMatches = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({
      tournamentId,
      status: 'completed'
    });
    res.status(200).json(matches);
  } catch (err) {
    console.error('Error fetching past matches:', err);
    res.status(500).json({ message: 'Error fetching past matches.' });
  }
};

// ✅ Get Match by ID
const getMatchById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid match ID.' });
    }

    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ message: 'Match not found.' });

    res.status(200).json(match);
  } catch (err) {
    console.error('Error fetching match by ID:', err);
    res.status(500).json({ message: 'Error fetching match.' });
  }
};

// ✅ Update Match Result
const updateMatchResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { result } = req.body;

    if (!['player1', 'player2', 'draw'].includes(result)) {
      return res.status(400).json({ message: 'Invalid result.' });
    }

    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ message: 'Match not found.' });

    let winner = '';
    if (result === 'player1') winner = match.player1;
    else if (result === 'player2') winner = match.player2;

    match.result = result;
    match.winner = winner;
    match.status = 'completed';
    await match.save();

    res.status(200).json({ message: 'Match result updated.', match });
  } catch (err) {
    console.error('Error updating match result:', err);
    res.status(500).json({ message: 'Error updating match result.' });
  }
};

// ✅ Get Matches for a Tournament
const getMatchesByTournament = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({ tournamentId });
    res.status(200).json(matches);
  } catch (err) {
    console.error('Error fetching tournament matches:', err);
    res.status(500).json({ message: 'Error fetching matches for tournament.' });
  }
};

// ✅ Get Matches for a Player (grouped)
const getMatchesForPlayer = async (req, res) => {
  try {
    const { playerId } = req.params;

    const matches = await Match.find({
      $or: [{ player1: playerId }, { player2: playerId }]
    }).lean();

    const grouped = {
      ongoing: [],
      upcoming: [],
      history: []
    };

    for (const match of matches) {
      const m = {
        matchId: match._id,
        player1Name: match.player1 || 'Player 1',
        player2Name: match.player2 || 'Player 2',
        round: match.round ?? 'N/A',
        status: match.status || 'upcoming',
        winner: match.winner || null
      };

      if (m.status === 'live' && !m.winner) grouped.ongoing.push(m);
      else if (m.status === 'upcoming') grouped.upcoming.push(m);
      else if (m.status === 'completed') grouped.history.push(m);
    }

    res.status(200).json(grouped);
  } catch (err) {
    console.error('Error fetching matches by player ID:', err);
    res.status(500).json({ message: 'Failed to load player matches.' });
  }
};

module.exports = {
  createMatch,
  getLiveMatches,
  getUpcomingMatches,
  getPastMatches,
  getMatchById,
  updateMatchResult,
  getMatchesByTournament,
  getMatchesForPlayer
};

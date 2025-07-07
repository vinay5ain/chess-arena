const Match = require('../models/match');
const mongoose = require('mongoose');

// ✅ Create Match (Manual or Custom)
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
      status: 'live',
      tournamentId,
      winner: { $in: [null, '', undefined] },
      round: { $ne: null }
    });
    res.status(200).json(matches);
  } catch (err) {
    console.error('Error fetching live matches:', err);
    res.status(500).json({ message: 'Error fetching live matches.' });
  }
};

// ✅ Get Upcoming Matches (Fixed)
const getUpcomingMatches = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await Match.find({
      status: 'upcoming',
      tournamentId
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
      status: 'completed',
      tournamentId
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
    if (!match) {
      return res.status(404).json({ message: 'Match not found.' });
    }

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
    const { result, winner } = req.body;

    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ message: 'Match not found.' });

    const resolvedWinner = winner || (result === 'player1' ? match.player1 : result === 'player2' ? match.player2 : null);
    if (!resolvedWinner) return res.status(400).json({ message: 'Invalid winner.' });

    match.winner = resolvedWinner;
    match.status = 'completed';
    await match.save();

    res.status(200).json({ message: 'Match result updated.', match });
  } catch (err) {
    console.error('Error updating match result:', err);
    res.status(500).json({ message: 'Error updating match result.' });
  }
};

// ✅ Get All Matches by Tournament
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

// ✅ Get Matches by Player ID (live, upcoming, past)
const getMatchesForPlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    if (!playerId) return res.status(400).json({ message: 'Missing playerId' });

    const allMatches = await Match.find({
      $or: [{ player1: playerId }, { player2: playerId }]
    }).lean();

    const ongoing = allMatches.filter(m => m.status === 'live' && !m.winner);
    const upcoming = allMatches.filter(m => m.status === 'upcoming');
    const history = allMatches.filter(m => m.status === 'completed');

    res.status(200).json({
      ongoing,
      upcoming,
      history
    });
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

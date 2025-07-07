const mongoose = require('mongoose');
const Tournament = require('../models/tournament');
const Player = require('../models/player');

// ✅ Admin login
const adminLogin = async (req, res) => {
  try {
    const { tournamentName, password } = req.body;
    if (!tournamentName || !password) {
      return res.status(400).json({ message: 'Tournament name and password required.' });
    }

    const tournament = await Tournament.findOne({ tournamentName, password });
    if (!tournament) {
      return res.status(401).json({ message: 'Invalid tournament name or password.' });
    }

    res.status(200).json({ message: 'Login successful.', tournament });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during admin login.' });
  }
};

// ✅ Create tournament
const createTournament = async (req, res) => {
  try {
    const {
      tournamentName,
      organizerName,
      isPrivate,
      entryFee,
      accessKey,
      mode,
      password
    } = req.body;

    if (!tournamentName || !organizerName || !password) {
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    if (isPrivate && !accessKey) {
      return res.status(400).json({ message: 'Access key required for private tournaments.' });
    }

    if (!isPrivate && (entryFee === undefined || isNaN(Number(entryFee)))) {
      return res.status(400).json({ message: 'Valid entry fee required for public tournaments.' });
    }

    const tournament = new Tournament({
      tournamentName,
      organizerName,
      isPrivate: Boolean(isPrivate),
      entryFee: isPrivate ? 0 : Number(entryFee),
      accessKey: isPrivate ? accessKey : null,
      mode: mode || 'offline',
      password
    });

    await tournament.save();
    res.status(201).json({ message: 'Tournament created.', tournament });

  } catch (err) {
    console.error('Error creating tournament:', err.message);
    res.status(500).json({ message: 'Server error while creating tournament.' });
  }
};

// ✅ Join tournament (by name, not ID)
const joinTournament = async (req, res) => {
  try {
    let { playerName, email, tournamentName, isPrivate, accessKey } = req.body;

    if (!playerName || !email || !tournamentName)
      return res.status(400).json({ message: 'Missing required fields.' });

    // 🧠 Fix: Auto-append @gmail.com if user entered only username
    if (!email.includes('@')) {
      email = `${email}@gmail.com`;
    }

    const tournament = await Tournament.findOne({ tournamentName });
    if (!tournament)
      return res.status(404).json({ message: 'Invalid tournament name.' });

    if (isPrivate && tournament.accessKey !== accessKey)
      return res.status(403).json({ message: 'Invalid access key.' });

    const playerId = `${playerName.toLowerCase().replace(/\s+/g, '')}_${Date.now()}`;

    const newPlayer = new Player({
      name: playerName,
      email,
      playerId,
      tournamentId: tournament._id
    });

    await newPlayer.save();

    res.status(201).json({ message: 'Joined successfully.', player: newPlayer });
  } catch (err) {
    console.error('Error in joinTournament:', err.message);
    res.status(500).json({ message: 'Server error while joining tournament.' });
  }
};

// ✅ Other CRUD handlers
const getAllTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find().sort({ createdAt: -1 });
    res.status(200).json(tournaments);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tournaments.' });
  }
};

const getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid tournament ID.' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found.' });
    }

    res.status(200).json(tournament);
  } catch (err) {
    console.error('Error fetching tournament by ID:', err.message);
    res.status(500).json({ message: 'Server error fetching tournament by ID.' });
  }
};

const deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid tournament ID.' });
    }

    const deleted = await Tournament.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Tournament not found.' });

    res.status(200).json({ message: 'Tournament deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting tournament.' });
  }
};

const getTournamentsByOrganizer = async (req, res) => {
  try {
    const { name } = req.params;
    const tournaments = await Tournament.find({ organizerName: name }).sort({ createdAt: -1 });
    res.status(200).json(tournaments);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching organizer tournaments.' });
  }
};

const filterTournaments = async (req, res) => {
  try {
    const isPrivate = req.params.type === 'private';
    const tournaments = await Tournament.find({ isPrivate }, '-password -accessKey');
    res.status(200).json(tournaments);
  } catch (err) {
    res.status(500).json({ message: 'Error filtering tournaments.' });
  }
};

module.exports = {
  createTournament,
  getAllTournaments,
  getTournamentById,
  joinTournament,
  deleteTournament,
  getTournamentsByOrganizer,
  filterTournaments,
  adminLogin
};

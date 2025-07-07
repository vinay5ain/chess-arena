const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  playerId: { type: String, unique: true, required: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  points: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  isDisqualified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Player', playerSchema);

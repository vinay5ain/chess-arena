const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  player1: { type: String, required: true },
  player2: { type: String, required: true },
  scheduledTime: { type: Date, required: true },
  round: { type: mongoose.Schema.Types.Mixed, required: true }, // 🔧 Changed to support 'knockout' as string
  result: { type: String, enum: ['player1', 'player2', 'draw', null], default: null },
  status: { type: String, enum: ['upcoming', 'live', 'completed'], default: 'upcoming' },
  winner: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);

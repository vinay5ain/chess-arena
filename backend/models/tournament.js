const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  tournamentName: { type: String, required: true },
  organizerName: { type: String },
  isPrivate: { type: Boolean },
  entryFee: { type: Number },
  accessKey: { type: String },
  password: { type: String },
  mode: { type: String, default: 'offline' },
  rounds: { type: Number },
  roundsLocked: { type: Boolean, default: false } // ✅ Lock flag
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);

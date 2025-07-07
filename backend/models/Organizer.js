const mongoose = require('mongoose');

const organizerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  tournamentName: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  tournamentType: {
    type: String,
    enum: ['public', 'private'],
    required: true,
  },
  entryFee: {
    type: Number,
    default: 0,
  },
  accessKey: {
    type: String,
    default: null,
  },
  mode: {
    type: String,
    enum: ['offline', 'online'],
    default: 'offline',
  }
}, { timestamps: true });

module.exports = mongoose.model('Organizer', organizerSchema);

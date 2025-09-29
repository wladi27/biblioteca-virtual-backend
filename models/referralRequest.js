const mongoose = require('mongoose');

const referralRequestSchema = new mongoose.Schema({
  solicitante_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  referido_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aceptado', 'rechazado'],
    default: 'pendiente'
  },
  fecha: {
    type: Date,
    default: Date.now,
    index: true
  },
  requestType: {
    type: String,
    enum: ['referrer_initiated', 'referred_initiated'],
    default: 'referrer_initiated'
  }
});

module.exports = mongoose.model('ReferralRequest', referralRequestSchema);
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
  }
});

module.exports = mongoose.model('ReferralRequest', referralRequestSchema);
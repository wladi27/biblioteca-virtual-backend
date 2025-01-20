const mongoose = require('mongoose');

const referralCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true, // Asegura que el código sea único
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario', // Referencia al modelo de usuario
    required: true,
  },
  used: {
    type: Boolean,
    default: false, // Indica si el código ha sido utilizado
  },
  createdAt: {
    type: Date,
    default: Date.now, // Fecha de creación
  },
});

const ReferralCode = mongoose.model('ReferralCode', referralCodeSchema);

module.exports = ReferralCode;

const mongoose = require('mongoose');

const billeteraSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    unique: true
  },
  saldo: {
    type: Number,
    default: 0
  },
  activa: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});


module.exports = mongoose.models.Billetera || mongoose.model('Billetera', billeteraSchema);
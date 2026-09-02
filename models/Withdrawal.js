const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  monto: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pendiente', 'completado', 'rechazado', 'pagado'], 
    default: 'pendiente',
    index: true
  },
  notas: {
    type: String,
    default: ''
  },
  idempotencyKey: {
    type: String,
    index: true,
    sparse: true
  },
  banco: {
    type: String,
    default: ''
  },
  cuenta_numero: {
    type: String,
    default: ''
  },
  titular_cuenta: {
    type: String,
    default: ''
  },
  transaccionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaccion'
  },
  motivo_rechazo: {
    type: String,
    default: ''
  },
  fecha: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);

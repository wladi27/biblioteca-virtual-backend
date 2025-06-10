const mongoose = require('mongoose');

const transaccionSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
  },
  tipo: {
    type: String,
    enum: ['recarga', 'envio', 'retiro', 'recibido'],
    required: true,
  },
  monto: {
    type: Number,
    required: true,
  },
  fecha: {
    type: Date,
    default: Date.now,
  },
  descripcion: {
    type: String,
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aprobado'],
    default: 'pendiente', // Estado por defecto
  },
});

module.exports = mongoose.model('Transaccion', transaccionSchema);

const mongoose = require('mongoose');

const transaccionSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true, // <--- Índice para búsquedas rápidas por usuario
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
    index: true, // <--- Índice para ordenar por fecha
  },
  descripcion: {
    type: String,
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aprobado', 'rechazado'],
    default: 'pendiente',
  },
});

module.exports = mongoose.model('Transaccion', transaccionSchema);

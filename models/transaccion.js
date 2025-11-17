const mongoose = require('mongoose');

const transaccionSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true,
  },
  tipo: {
    type: String,
    enum: ['recarga', 'envio', 'retiro', 'recibido', 'recarga_masiva'],
    required: true,
  },
  monto: {
    type: Number,
    required: true,
  },
  fecha: {
    type: Date,
    default: Date.now,
    index: true,
  },
  descripcion: {
    type: String,
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aprobado', 'rechazado'],
    default: 'pendiente',
  },
  recarga_masiva_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecargaMasiva',
    default: null
  },
  es_recarga_masiva: {
    type: Boolean,
    default: false
  }
});

// Índice para búsquedas por tipo
transaccionSchema.index({ tipo: 1 });

// Índice compuesto para búsquedas frecuentes por usuario y tipo
transaccionSchema.index({ usuario_id: 1, tipo: 1, fecha: -1 });

// Índice para recargas masivas
transaccionSchema.index({ recarga_masiva_id: 1 });
transaccionSchema.index({ es_recarga_masiva: 1 });

module.exports = mongoose.model('Transaccion', transaccionSchema);
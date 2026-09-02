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
    enum: [
      'recarga',
      'recarga_diaria',
      'recarga_masiva',
      'recarga_individual',
      'comision_nivel',
      'comision_referido',
      'aporte_aprobado',
      'retiro',
      'envio',
      'recibido'
    ],
    required: true,
    index: true,
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
    enum: ['pendiente', 'aprobado', 'rechazado', 'completado'],
    default: 'aprobado',
    index: true,
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
}, {
  timestamps: true
});

// Índices compuestos para consultas rápidas
transaccionSchema.index({ usuario_id: 1, fecha: -1 });
transaccionSchema.index({ usuario_id: 1, tipo: 1, fecha: -1 });
transaccionSchema.index({ usuario_id: 1, estado: 1 });
transaccionSchema.index({ recarga_masiva_id: 1 });
transaccionSchema.index({ es_recarga_masiva: 1 });

module.exports = mongoose.model('Transaccion', transaccionSchema);
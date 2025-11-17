const mongoose = require('mongoose');

const recargaMasivaSchema = new mongoose.Schema({
  monto_individual: {
    type: Number,
    required: true
  },
  total_billeteras: {
    type: Number,
    required: true
  },
  monto_total: {
    type: Number,
    required: true
  },
  fecha_ejecucion: {
    type: Date,
    default: Date.now
  },
  ejecutado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  estado: {
    type: String,
    enum: ['completado', 'fallido', 'procesando'],
    default: 'procesando'
  },
  transaccion_principal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaccion'
  },
  revertida: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
recargaMasivaSchema.index({ fecha_ejecucion: -1 });
recargaMasivaSchema.index({ estado: 1 });
recargaMasivaSchema.index({ ejecutado_por: 1 });

module.exports = mongoose.models.RecargaMasiva || mongoose.model('RecargaMasiva', recargaMasivaSchema);
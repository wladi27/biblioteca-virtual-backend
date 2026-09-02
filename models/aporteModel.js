const mongoose = require('mongoose');

const aporteSchema = new mongoose.Schema({
    usuarioId: { type: String, required: true, index: true },
    aporte: { type: Boolean, default: false, index: true },
    monto: { type: Number, default: 0 },
    fecha_creacion: { type: Date, default: Date.now },
    fecha_aprobacion: { type: Date },
    notas: { type: String }
}, {
    timestamps: true
});

aporteSchema.index({ usuarioId: 1, aporte: 1 });

const Aporte = mongoose.models.Aporte || mongoose.model('Aporte', aporteSchema);

module.exports = Aporte;

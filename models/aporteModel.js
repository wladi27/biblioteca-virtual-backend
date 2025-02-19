// models/aporteModel.js
const mongoose = require('mongoose');

const aporteSchema = new mongoose.Schema({
    usuarioId: { type: String, required: true },
    aporte: { type: Boolean, default: false }
});

const Aporte = mongoose.model('Aporte', aporteSchema);

module.exports = Aporte;

const mongoose = require('mongoose');

const nivelSchema = new mongoose.Schema({
  numero_nivel: { type: Number, required: true, unique: true },
  comision: { type: mongoose.Types.Decimal128, required: true }
});

module.exports = mongoose.model('Nivel', nivelSchema);
